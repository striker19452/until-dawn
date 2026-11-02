import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openStore } from '../src/store.js';
import { initialState } from '../src/game.js';

function command(snapshot, action, requestId = randomUUID()) { return { runId: snapshot.runId, revision: snapshot.revision, requestId, action: typeof action === 'string' ? { type: action } : action }; }
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'dawn-save-')), path = join(dir, 'save.sqlite');
  const store = openStore(path); let active = store;
  t.after(() => { active.close(); rmSync(dir, { recursive: true, force: true }); });
  return { path, get store() { return active; }, reopen() { active.close(); active = openStore(path); return active; } };
}
test('real SQLite file and guest session survive a closed/reopened database', t => {
  const f = fixture(t), player = f.store.createPlayer();
  let s = f.store.act(player.userId, command(player.snapshot, 'listen'));
  s = f.store.act(player.userId, command(s, { type: 'search', place: 'alley' }));
  assert.equal(readFileSync(f.path).subarray(0, 15).toString(), 'SQLite format 3');
  f.reopen();
  assert.equal(f.store.session(player.token), player.userId);
  const { replayed, ...savedSnapshot } = s;
  assert.deepEqual(f.store.snapshot(player.userId), savedSnapshot);
  const db = new DatabaseSync(f.path);
  const stored = db.prepare('SELECT state_json FROM runs WHERE user_id=?').get(player.userId);
  assert.equal(JSON.parse(stored.state_json).food, 6);
  assert.notEqual(db.prepare('SELECT token_hash FROM sessions').get().token_hash, player.token);
  db.close();
});
test('same request has one effect; stale revision or changed payload cannot spend twice', t => {
  const { store } = fixture(t), player = store.createPlayer();
  const input = command(player.snapshot, 'listen');
  const first = store.act(player.userId, input), replay = store.act(player.userId, input);
  assert.equal(first.revision, 1); assert.equal(replay.revision, 1); assert.equal(replay.replayed, true);
  assert.throws(() => store.act(player.userId, { ...input, action: { type: 'repair' } }), /另一项操作/);
  assert.throws(() => store.act(player.userId, command(player.snapshot, 'repair')), /其他页面更新/);
  assert.equal(store.snapshot(player.userId).state.mat, 6);
});
test('failed actions roll back state and request receipt atomically', t => {
  const { store } = fixture(t), p = store.createPlayer();
  const input = command(p.snapshot, 'repair');
  assert.throws(() => store.act(p.userId, input), /白天/);
  assert.deepEqual(store.snapshot(p.userId), p.snapshot);
  const success = store.act(p.userId, { ...input, action: { type: 'listen' } });
  assert.equal(success.revision, 1);
});
test('dawn retry restores the whole run and increases revision, old requests remain idempotent', t => {
  const { store } = fixture(t), p = store.createPlayer(); let s = p.snapshot;
  const listen = command(s, 'listen'); s = store.act(p.userId, listen);
  for (const action of [{ type: 'search', place: 'alley' }, { type: 'recruit', accept: true }, 'story', 'buildGarden', { type: 'setJob', job: 'plant' }, 'prepare', 'startNight', 'wave1', { type: 'decide', choice: 'retreat' }, 'wave2', 'finish']) s = store.act(p.userId, command(s, action));
  assert.equal(s.state.recruited, true); assert.equal(s.state.planted, true);
  const oldRevision = s.revision;
  s = store.act(p.userId, command(s, 'retry'));
  assert.equal(s.revision, oldRevision + 1);
  const expected = initialState(); expected.message = s.state.message; assert.deepEqual(s.state, expected);
  const repeated = store.act(p.userId, listen);
  assert.equal(repeated.state.phase, 'morning'); assert.equal(repeated.revision, s.revision);
});
test('guest data and request IDs are scoped to a run, not a global browser value', t => {
  const { store } = fixture(t), a = store.createPlayer(), b = store.createPlayer();
  const input = command(a.snapshot, 'listen');
  assert.throws(() => store.act(b.userId, input), /存档已切换/);
  store.act(a.userId, input);
  assert.equal(store.snapshot(b.userId).state.phase, 'morning');
  assert.equal(store.session('bad-token'), null);
  assert.throws(() => store.act(a.userId, { action: { type: 'listen' } }), /不完整/);
});
