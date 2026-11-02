import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { applyAction, initialState } from './game.js';

export class StoreError extends Error {
  constructor(message, status = 409, snapshot = null) { super(message); this.status = status; this.snapshot = snapshot; }
}
const hash = token => createHash('sha256').update(token).digest('hex');
const SESSION_SECONDS = 90 * 24 * 60 * 60;
export { SESSION_SECONDS };

export function openStore(filename) {
  if (filename !== ':memory:') mkdirSync(dirname(resolve(filename)), { recursive: true });
  const db = new DatabaseSync(filename);
  const version = db.prepare('PRAGMA user_version').get().user_version;
  if (version > 1) { db.close(); throw new Error('数据库版本比当前程序更新，请使用匹配的程序版本。'); }
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE REFERENCES users(id), schema_version INTEGER NOT NULL, state_json TEXT NOT NULL, revision INTEGER NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS checkpoints (run_id TEXT PRIMARY KEY REFERENCES runs(id), day INTEGER NOT NULL, phase TEXT NOT NULL, state_json TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS action_requests (run_id TEXT NOT NULL REFERENCES runs(id), request_id TEXT NOT NULL, action_hash TEXT NOT NULL, applied_revision INTEGER NOT NULL, PRIMARY KEY (run_id,request_id));
    PRAGMA user_version=1;`);
  const queries = {
    session: db.prepare('SELECT user_id FROM sessions WHERE token_hash=? AND expires_at>?'),
    run: db.prepare('SELECT * FROM runs WHERE user_id=?'),
    checkpoint: db.prepare('SELECT state_json FROM checkpoints WHERE run_id=?'),
    request: db.prepare('SELECT * FROM action_requests WHERE run_id=? AND request_id=?'),
  };
  function transaction(fn) {
    db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  function session(token) {
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null;
    return queries.session.get(hash(token), Math.floor(Date.now() / 1000))?.user_id ?? null;
  }
  function snapshot(userId) {
    const row = queries.run.get(userId);
    if (!row) throw new StoreError('存档不存在，请刷新页面。', 404);
    if (row.schema_version !== 1) throw new StoreError('当前程序无法读取这个版本的存档。', 503);
    return { runId: row.id, revision: row.revision, updatedAt: row.updated_at, state: JSON.parse(row.state_json) };
  }
  function createPlayer() {
    return transaction(() => {
      const userId = randomUUID(), token = randomBytes(32).toString('hex'), runId = randomUUID(), now = new Date().toISOString();
      const stateJSON = JSON.stringify(initialState());
      db.prepare('INSERT INTO users VALUES (?,?)').run(userId, now);
      db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(hash(token), userId, Math.floor(Date.now() / 1000) + SESSION_SECONDS);
      db.prepare('INSERT INTO runs VALUES (?,?,?,?,?,?)').run(runId, userId, 1, stateJSON, 0, now);
      db.prepare('INSERT INTO checkpoints VALUES (?,?,?,?,?)').run(runId, 1, 'morning', stateJSON, now);
      return { userId, token, snapshot: snapshot(userId) };
    });
  }
  function act(userId, input) {
    if (!input || typeof input !== 'object' || !Number.isSafeInteger(input.revision) || input.revision < 0 || typeof input.runId !== 'string' || typeof input.requestId !== 'string' || !/^[a-zA-Z0-9_-]{16,100}$/.test(input.requestId) || !input.action || typeof input.action !== 'object' || Array.isArray(input.action)) {
      throw new StoreError('操作请求不完整，请刷新后重试。', 400);
    }
    // Canonical key ordering makes equivalent retried JSON requests identical.
    const payload = JSON.stringify(input.action, Object.keys(input.action).sort());
    const actionHash = hash(payload);
    return transaction(() => {
      const previous = snapshot(userId);
      if (input.runId !== previous.runId) throw new StoreError('玩家存档已切换，本次操作没有执行。', 409, previous);
      const applied = queries.request.get(previous.runId, input.requestId);
      if (applied) {
        if (applied.action_hash !== actionHash) throw new StoreError('请求标识已用于另一项操作。', 409, previous);
        return { ...previous, replayed: true };
      }
      if (previous.revision !== input.revision) throw new StoreError('存档已在其他页面更新，本次操作尚未执行，请查看最新进度。', 409, previous);
      let next;
      if (input.action.type === 'retry') {
        if (!['report', 'complete'].includes(previous.state.phase)) throw new StoreError('请先完成第一夜，再选择从清晨重试。', 422);
        next = JSON.parse(queries.checkpoint.get(previous.runId).state_json);
        next.message = '回到第 1 天清晨。当天物资、招募、建筑和故事进度一并还原。';
      } else next = applyAction(previous.state, input.action);
      const revision = previous.revision + 1, now = new Date().toISOString();
      db.prepare('UPDATE runs SET state_json=?, revision=?, updated_at=? WHERE id=? AND revision=?').run(JSON.stringify(next), revision, now, previous.runId, previous.revision);
      db.prepare('INSERT INTO action_requests VALUES (?,?,?,?)').run(previous.runId, input.requestId, actionHash, revision);
      return { ...snapshot(userId), replayed: false };
    });
  }
  return { session, snapshot, createPlayer, act, close: () => db.close() };
}
