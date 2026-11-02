import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {openStore} from '../src/store.js';
import {openCampaignStore} from '../src/campaign-store.js';
import {createBattle,stepBattle} from '../src/battle.js';
import {settleNight} from '../src/campaign.js';
import {bestiaryEntries} from '../src/bestiary.js';

test('a real skitter encounter, trap kill and discovery survive a client-result save, restart and replay',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'dawn-skitter-')),path=join(dir,'game.sqlite'),legacy=openStore(path),observer=new DatabaseSync(path);let store=openCampaignStore(path);
 t.after(()=>{store.close();observer.close();legacy.close();rmSync(dir,{recursive:true,force:true});});
 const player=legacy.createPlayer();let snap=store.ensure(player.userId,player.snapshot);const action=a=>{snap=store.action(player.userId,{runId:snap.runId,revision:snap.revision,requestId:randomUUID(),action:a});};action({type:'chooseRole',role:'repairman'});
 const state=structuredClone(snap.state);state.day=5;state.flags.centralFire=false;state.people[0].nightRole='sleep';state.zones.forEach(z=>z.hp=100);Object.assign(state.zones[2],{hp:18,traps:1});observer.prepare('UPDATE campaigns SET state_json=? WHERE user_id=?').run(JSON.stringify(state),player.userId);snap=store.snapshot(player.userId);action({type:'prepare'});
 const b=createBattle(snap.state,`local-${snap.runId}-${snap.revision}`,{autoPause:false});b.schedule=[{at:.05,type:'skitter',zone:'gate'}];b.paused=false;for(let i=0;i<300&&!b.finished;i++)stepBattle(b);
 assert.equal(b.finished,true);assert.ok(b.events.some(e=>e.type==='trap'&&e.defeated));assert.equal(bestiaryEntries(store.snapshot(player.userId).state).find(e=>e.id==='skitter').known,false,'discovery remains unsaved during play');
 const request={runId:snap.runId,revision:snap.revision,nightId:b.id,orderModel:'temporary-v1',result:settleNight(snap.state,b)};
 const saved=store.finishClient(player.userId,request);assert.equal(bestiaryEntries(saved.state).find(e=>e.id==='skitter').known,true);assert.equal(saved.state.zones[2].traps,0);
 store.close();store=openCampaignStore(path);assert.deepEqual(store.snapshot(player.userId),saved);const replay=store.finishClient(player.userId,request);assert.equal(replay.replayed,true);assert.equal(replay.revision,saved.revision);
});
