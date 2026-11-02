import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createGameServer } from '../server.js';
import http from 'node:http';

async function start(path, options = {}) {
  const { server } = createGameServer({ dbPath: path, publicOrigin: null, ...options });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return { server, url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => server.close(resolve)) };
}
async function request(app, path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(app.url + path, { method: options.method || 'GET', headers: { Connection: 'close', ...options.headers } }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk)); res.on('error', reject);
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        const response = { status: res.statusCode, headers: { get(name) { const value = res.headers[name.toLowerCase()]; return Array.isArray(value) ? value.join('; ') : value ?? null; } } };
        const data = response.headers.get('Content-Type')?.includes('json') ? JSON.parse(text) : text;
        resolve({ response, data });
      });
    });
    req.on('error', reject); req.end(options.body);
  });
}
function actionBody(snapshot, action) { return { runId: snapshot.runId, revision: snapshot.revision, requestId: randomUUID(), action }; }
function post(app, cookie, body, headers = {}) { return request(app, '/api/action', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }); }

test('HTTP gameplay, two-tab conflict, request replay, server restart, isolation and security', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'dawn-http-')), dbPath = join(dir, 'game.sqlite'); let app = await start(dbPath);
  t.after(async () => { if (app) await app.close(); rmSync(dir, { force: true, recursive: true }); });
  const page = await request(app, '/'); assert.equal(page.response.status, 200); assert.match(page.data, /等到天亮/);
  for (const path of ['/app.js', '/styles.css', '/scene.js', '/icons.js']) assert.equal((await request(app, path)).response.status, 200);
  const opened = await request(app, '/api/game');
  const cookie = opened.response.headers.get('set-cookie').split(';')[0];
  assert.match(opened.response.headers.get('set-cookie'), /HttpOnly/); assert.match(opened.response.headers.get('set-cookie'), /SameSite=Strict/);
  const other = await request(app, '/api/game');
  assert.notEqual(other.data.runId, opened.data.runId);
  const listen = actionBody(opened.data, { type: 'listen', mat: 999999, state: { food: 999999 } });
  let result = await post(app, cookie, listen); assert.equal(result.response.status, 200); assert.equal(result.data.state.mat, 6);
  let current = result.data;
  const duplicate = await post(app, cookie, listen); assert.equal(duplicate.data.replayed, true); assert.equal(duplicate.data.revision, current.revision);
  const attempts = await Promise.all([
    post(app, cookie, actionBody(current, { type: 'repair' })),
    post(app, cookie, actionBody(current, { type: 'repair' })),
  ]);
  assert.deepEqual(attempts.map(x => x.response.status).sort(), [200, 409]);
  current = attempts.find(x => x.response.status === 200).data;
  assert.equal(current.state.mat, 4); assert.equal(current.state.gate, 70); assert.equal(current.state.ap, 5);
  assert.equal((await post(app, cookie, actionBody(current, { type: 'repair' }), { Origin: 'https://foreign.example' })).response.status, 403);
  assert.equal((await post(app, '', actionBody(current, { type: 'repair' }))).response.status, 401);
  const invalid = await request(app, '/api/action', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: '{' });
  assert.equal(invalid.response.status, 400);
  assert.equal((await request(app, '/data/game.sqlite')).response.status, 404);
  await app.close(); app = await start(dbPath);
  const resumed = await request(app, '/api/game', { headers: { Cookie: cookie } });
  const { replayed, ...savedSnapshot } = current;
  assert.deepEqual(resumed.data, savedSnapshot);
  const stranger = await request(app, '/api/game', { headers: { Cookie: other.response.headers.get('set-cookie').split(';')[0] } });
  assert.equal(stranger.data.state.phase, 'morning');
  const phases = ['prepare', 'startNight', 'wave1'];
  for (const type of phases) { result = await post(app, cookie, actionBody(current, { type })); assert.equal(result.response.status, 200); current = result.data; }
  const beforeChoice = await request(app, '/api/game', { headers: { Cookie: cookie } }); assert.equal(beforeChoice.data.state.phase, 'event');
  for (const action of [{ type: 'decide', choice: 'brace' }, { type: 'wave2' }, { type: 'finish' }]) {
    result = await post(app, cookie, actionBody(current, action)); assert.equal(result.response.status, 200); current = result.data;
  }
  assert.equal(current.state.phase, 'complete'); assert.equal(current.state.food, 2);
  const retry = await post(app, cookie, actionBody(current, { type: 'retry' }));
  assert.equal(retry.data.state.phase, 'morning'); assert.equal(retry.data.state.mat, 6); assert.ok(retry.data.revision > current.revision);
});

test('explicit HTTPS tunnel origin supports saves and secure cookies without weakening direct HTTP', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'dawn-tunnel-'));
  const app = await start(join(dir, 'game.sqlite'), { publicOrigin: 'https://play.example.test' });
  t.after(async () => { await app.close(); rmSync(dir, { force: true, recursive: true }); });
  const forwarded = { Host: 'play.example.test', 'X-Forwarded-Proto': 'https', Origin: 'https://play.example.test', 'Sec-Fetch-Site': 'same-origin' };
  const opened = await request(app, '/api/game', { headers: forwarded });
  assert.equal(opened.response.status, 200);
  assert.match(opened.response.headers.get('set-cookie'), /; Secure/);
  const cookie = opened.response.headers.get('set-cookie').split(';')[0];
  const saved = await post(app, cookie, actionBody(opened.data, { type: 'listen' }), forwarded);
  assert.equal(saved.response.status, 200); assert.equal(saved.data.state.heard, true);
  const resumed = await request(app, '/api/game', { headers: { ...forwarded, Cookie: cookie } });
  assert.equal(resumed.data.revision, saved.data.revision);
  const mismatch = await post(app, cookie, actionBody(saved.data, { type: 'repair' }), { ...forwarded, Origin: 'https://another.example.test' });
  assert.equal(mismatch.response.status, 403);
  const noProxy = await post(app, cookie, actionBody(saved.data, { type: 'repair' }), { Host: 'play.example.test', Origin: 'https://play.example.test' });
  assert.equal(noProxy.response.status, 403);
  const direct = await request(app, '/api/game');
  assert.equal(direct.response.status, 200); assert.doesNotMatch(direct.response.headers.get('set-cookie'), /; Secure/);
});

test('browser migration exports the current state and original dawn without issuing a new identity',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'dawn-export-')),app=await start(join(dir,'game.sqlite'));
 t.after(async()=>{await app.close();rmSync(dir,{force:true,recursive:true});});
 const empty=await request(app,'/api/campaign/export');assert.equal(empty.response.status,200);assert.equal(empty.data,null);assert.equal(empty.response.headers.get('set-cookie'),null);
 const first=await request(app,'/api/campaign'),cookie=first.response.headers.get('set-cookie').split(';')[0];let snap=first.data;
 async function act(action){const r=await request(app,'/api/campaign/action',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(actionBody(snap,action))});assert.equal(r.response.status,200);snap=r.data;}
 await act({type:'chooseRole',role:'repairman'});const dawn=structuredClone(snap.state);await act({type:'search',site:'shed'});
 const exported=await request(app,'/api/campaign/export',{headers:{Cookie:cookie}});assert.equal(exported.response.status,200);assert.deepEqual(exported.data.state,snap.state);assert.deepEqual(exported.data.dawn,dawn);assert.equal(exported.data.revision,snap.revision);assert.equal(exported.response.headers.get('set-cookie'),null);assert.equal(exported.response.headers.get('cache-control'),'no-store');
 assert.deepEqual((await request(app,'/api/campaign/export',{headers:{Cookie:cookie}})).data,exported.data);
 assert.equal((await request(app,'/api/campaign/export',{headers:{Cookie:cookie,Origin:'https://foreign.example'}})).response.status,403);
 assert.deepEqual((await request(app,'/api/campaign',{headers:{Cookie:cookie}})).data,{...snap,nightRuntime:'client'});
});
