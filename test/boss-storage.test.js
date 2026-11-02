import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {openStore} from '../src/store.js';
import {openCampaignStore} from '../src/campaign-store.js';
import {createBattle,stepBattle,battleCommand} from '../src/battle.js';
import {settleNight} from '../src/campaign.js';
import {BOSSES} from '../src/boss-content.js';

test('a prepared veteran watchman can defeat all four strengthened bosses with real orders, then save and replay across a store restart',t=>{
 const dir=mkdtempSync(join(tmpdir(),'dawn-bosses-')),path=join(dir,'game.sqlite'),legacy=openStore(path),observer=new DatabaseSync(path);let store=openCampaignStore(path);
 t.after(()=>{observer.close();store.close();legacy.close();rmSync(dir,{recursive:true,force:true});});
 for(const day of [7,14,21,28]){
  const user=legacy.createPlayer();let snap=store.ensure(user.userId,user.snapshot);snap=store.action(user.userId,{runId:snap.runId,revision:snap.revision,requestId:randomUUID(),action:{type:'chooseRole',role:'watchman'}});
  const state=structuredClone(snap.state);state.day=day;state.resources.materials=30;state.zones.forEach(z=>z.hp=100);state.people[0].zone=BOSSES[day].zone;state.people[0].skills.guard=3;state.zones.forEach(z=>{z.spikes=true;z.mesh=true;});
  observer.prepare('UPDATE campaigns SET state_json=? WHERE user_id=?').run(JSON.stringify(state),user.userId);snap=store.snapshot(user.userId);snap=store.action(user.userId,{runId:snap.runId,revision:snap.revision,requestId:randomUUID(),action:{type:'prepare'}});
  const battle=createBattle(snap.state,`local-${snap.runId}-${snap.revision}`,{autoPause:false});battle.schedule=[{at:24,type:BOSSES[day].id,zone:battle.boss.zone,challenge:true}];battle.paused=false;const used=[];
  for(let i=0;i<4000&&!battle.finished;i++){
   const p=battle.people[0],bs=battle.boss;
   if(i%10===0&&!p.task&&!bs.defeated){let action=null;
    if(bs.phase==='charge'&&bs.clock>2.5&&p.stamina>=24&&(battle.braceCooldowns[p.id]||0)<=0)action={type:'brace',target:bs.zone};
    else if(bs.mounds.length)action={type:'compact',target:bs.mounds[0].zone};
    else if(bs.phase==='siphon'&&battle.resources.materials>0)action={type:'throw',target:bs.zone};
    else if(bs.split){const target=battle.enemies.filter(e=>e.boss&&e.hp>0).sort((a,b)=>a.hp-b.hp)[0];if(target&&target.zone!==p.zone)action={type:'guard',target:target.zone};}
    if(action){try{battleCommand(battle,{...action,person:p.id});used.push(action.type);}catch{}}
   }stepBattle(battle);
  }
  assert.equal(battle.finished,true,`day ${day} converges`);assert.equal(battle.boss.defeated,true,`day ${day}: ${JSON.stringify({boss:battle.boss,used})}`);assert.equal(battle.challenge.status,'cleared',`day ${day}: ${battle.challenge.feedback}`);if(day===7)assert.ok(used.includes('brace'));if(day===14)assert.ok(battle.boss.sealed>0);if(day===21)assert.ok(used.includes('throw'));if(day===28)assert.equal(battle.boss.split,true);
  const request={runId:snap.runId,revision:snap.revision,nightId:battle.id,orderModel:'temporary-v1',result:settleNight(snap.state,battle)};
  const saved=store.finishClient(user.userId,request);assert.equal(saved.state.report.boss.defeated,true);assert.equal(saved.state.report.boss.id,BOSSES[day].id);assert.ok(saved.state.flags.seenTypes.includes(BOSSES[day].id));assert.ok(!Object.hasOwn(saved.state,'boss'));
  store.close();store=openCampaignStore(path);assert.deepEqual(store.snapshot(user.userId),saved);const replay=store.finishClient(user.userId,request);assert.equal(replay.replayed,true);assert.equal(replay.revision,saved.revision);assert.deepEqual(replay.state,saved.state);
 }
});

test('an already-open old seventh-night page may still settle without any boss fields',t=>{
 const dir=mkdtempSync(join(tmpdir(),'dawn-old-boss-')),path=join(dir,'game.sqlite'),legacy=openStore(path),user=legacy.createPlayer(),store=openCampaignStore(path),db=new DatabaseSync(path);t.after(()=>{db.close();store.close();legacy.close();rmSync(dir,{recursive:true,force:true});});let snap=store.ensure(user.userId,user.snapshot);
 snap=store.action(user.userId,{runId:snap.runId,revision:snap.revision,requestId:randomUUID(),action:{type:'chooseRole',role:'watchman'}});snap.state.day=7;db.prepare('UPDATE campaigns SET state_json=? WHERE user_id=?').run(JSON.stringify(snap.state),user.userId);snap=store.action(user.userId,{runId:snap.runId,revision:snap.revision,requestId:randomUUID(),action:{type:'prepare'}});
 const b=createBattle(snap.state,'old-page',{autoPause:false});b.boss=null;b.challenge={...b.challenge,title:'第一次迁徙',goal:'house',strength:1.6};delete b.challenge.boss;delete b.challenge.replacementSlots;b.schedule=[];b.enemies=[];b.paused=false;b.elapsed=180;stepBattle(b);const result=settleNight(snap.state,b);assert.ok(!Object.hasOwn(result.report,'boss'));assert.equal(store.finishClient(user.userId,{runId:snap.runId,revision:snap.revision,nightId:`local-${snap.runId}-${snap.revision}`,result}).state.phase,'report');
});
