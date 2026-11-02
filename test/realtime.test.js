import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import WebSocket from 'ws';
import { createGameServer } from '../server.js';
import { createLocalNight,localNightId } from '../src/local-night.js';
async function setup(t){
 const dir=mkdtempSync(join(tmpdir(),'dawn-local-')),dbPath=join(dir,'game.sqlite');let app,url;
 async function start(){app=createGameServer({dbPath,publicOrigin:null});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));url=`http://127.0.0.1:${app.server.address().port}`;}
 await start();const first=await fetch(url+'/api/campaign'),cookie=first.headers.get('set-cookie').split(';')[0];let state=await first.json();
 const post=async action=>{const response=await fetch(url+'/api/campaign/action',{method:'POST',headers:{Cookie:cookie,Origin:url,'Content-Type':'application/json'},body:JSON.stringify({runId:state.runId,revision:state.revision,requestId:randomUUID(),action})});const data=await response.json();assert.equal(response.status,200,JSON.stringify(data));state=data;return data;};
 await post({type:'chooseRole',role:'watchman'});await post({type:'prepare'});
 t.after(async()=>{await new Promise(r=>app.server.close(r));rmSync(dir,{recursive:true,force:true});});
 return {dbPath,cookie,post,get app(){return app;},get state(){return state;},get url(){return url;},async restart(){await new Promise(r=>app.server.close(r));await start();},async finish(payload,origin=url,session=cookie){const response=await fetch(url+'/api/campaign/night-result',{method:'POST',headers:{Cookie:session,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(payload)});return {status:response.status,data:await response.json()};}};
}
function offlineResult(base){let time=0;const runner=createLocalNight(base,{now:()=>time});runner.command({type:'autoPause',enabled:false});runner.command({type:'resume'});for(let i=0;i<5000&&!runner.battle.finished;i++){time+=50;runner.tick();}assert.ok(runner.battle.finished);return {runId:base.runId,revision:base.revision,nightId:localNightId(base),result:runner.result};}

test('entire night computes offline with no server session or SQLite writes; final upload commits exactly once',async t=>{
 const env=await setup(t),observer=new DatabaseSync(env.dbPath);t.after(()=>observer.close());const version=()=>observer.prepare('PRAGMA data_version').get().data_version,before=version(),base=structuredClone(env.state);
 assert.equal(env.app.realtime,undefined);const payload=offlineResult(base);assert.equal(version(),before);assert.equal(observer.prepare('SELECT count(*) AS n FROM night_results').get().n,0);
 const saved=await env.finish(payload);assert.equal(saved.status,200,JSON.stringify(saved.data));assert.equal(saved.data.revision,base.revision+1);assert.deepEqual(saved.data.state,payload.result);assert.ok(version()>before);
 const after=version(),duplicate=await env.finish(payload);assert.equal(duplicate.status,200);assert.equal(duplicate.data.replayed,true);assert.equal(duplicate.data.revision,saved.data.revision);assert.equal(version(),after);assert.equal(observer.prepare('SELECT count(*) AS n FROM night_results').get().n,1);
});
test('server restart during offline play leaves preparation intact and accepts the completed client result',async t=>{
 const env=await setup(t),base=structuredClone(env.state),payload=offlineResult(base);await env.restart();const response=await fetch(env.url+'/api/campaign',{headers:{Cookie:env.cookie}});const current=await response.json();assert.deepEqual(current.state,base.state);const saved=await env.finish(payload);assert.equal(saved.status,200);assert.equal(saved.data.state.phase,'report');
});
test('lost or failed end-save can be retried without repeating food, rewards or state writes',async t=>{
 const env=await setup(t),payload=offlineResult(env.state),finish=env.app.campaigns.finishClient;let attempts=0;env.app.campaigns.finishClient=(...args)=>{attempts++;if(attempts===1)throw Error('simulated disk failure');return finish(...args);};assert.equal((await env.finish(payload)).status,500);assert.equal((await env.finish(payload)).status,200);const again=await env.finish(payload);assert.equal(again.status,200);assert.equal(again.data.replayed,true);assert.equal(again.data.state.resources.food,payload.result.resources.food);
});
test('stale client results cannot overwrite a changed dawn, and corrupt or cross-origin results are rejected',async t=>{
 const env=await setup(t),payload=offlineResult(env.state);assert.equal((await env.finish(payload,'https://foreign.example')).status,403);const corrupt=structuredClone(payload);corrupt.result.resources.materials=99999;assert.equal((await env.finish(corrupt)).status,422);assert.equal((await env.finish(payload,env.url,'invalid')).status,401);await env.post({type:'backDay'});assert.equal((await env.finish(payload)).status,409);assert.equal(env.state.state.phase,'day');
});
test('the deprecated WebSocket endpoint cannot create or run a server-side night',async t=>{
 const env=await setup(t);const ws=new WebSocket(env.url.replace('http','ws')+'/ws/night',{origin:env.url,headers:{Cookie:env.cookie}});const status=await new Promise(resolve=>{ws.once('unexpected-response',(_,res)=>{resolve(res.statusCode);res.resume();ws.terminate();});ws.on('error',()=>{});});assert.equal(status,410);assert.equal(env.app.realtime,undefined);
});

test('a response lost after commit is recovered by the same night ID without applying the result twice',async t=>{
 const env=await setup(t),payload=offlineResult(env.state),finish=env.app.campaigns.finishClient;let lost=true;
 env.app.campaigns.finishClient=(...args)=>{const value=finish(...args);if(lost){lost=false;throw Error('response interrupted after commit');}return value;};
 const first=await env.finish(payload);assert.equal(first.status,500);const retry=await env.finish(payload);assert.equal(retry.status,200);assert.equal(retry.data.replayed,true);assert.equal(retry.data.revision,payload.revision+1);assert.deepEqual(retry.data.state,payload.result);
});

test('an older open page can finish while its command-induced assignment changes are discarded',async t=>{
 const env=await setup(t),base=structuredClone(env.state),payload=offlineResult(base);
 payload.result.people[0].nightRole='sleep';payload.result.people[0].zone='right';
 const saved=await env.finish(payload);assert.equal(saved.status,200,JSON.stringify(saved.data));assert.equal(saved.data.state.people[0].nightRole,base.state.people[0].nightRole);assert.equal(saved.data.state.people[0].zone,base.state.people[0].zone);
});

test('the temporary-command client cannot upload a changed long-term assignment',async t=>{
 const env=await setup(t),payload=offlineResult(env.state);payload.orderModel='temporary-v1';payload.result.people[0].nightRole='sleep';
 assert.equal((await env.finish(payload)).status,422);
});
