import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createTestSession,testAction,finishTestNight} from '../src/test-mode.js';
import {createBattle,stepBattle} from '../src/battle.js';
import {ROLES,ENEMIES} from '../src/content.js';
import {BOSSES} from '../src/boss-content.js';
import {settleNight} from '../src/campaign.js';
import {openStore} from '../src/store.js';
import {openCampaignStore} from '../src/campaign-store.js';
import {occupiedBeds,ROBOT_RULES,validRobotPlan} from '../src/robots.js';

test('all 28 nights, three professions and the campaign presets directly create valid real encounters',()=>{
 for(let day=1;day<=28;day++)for(const role of Object.keys(ROLES))for(const preset of ['solo','crew','solo-robots']){
  const session=createTestSession({day,role,preset}),state=session.snapshot.state,b=createBattle(state,'test-level');
  assert.equal(state.day,day);assert.equal(state.phase,'ready');assert.equal(state.role,role);assert.equal(state.people.length,preset==='crew'?5:1);assert.equal(state.house,100);assert.ok(state.zones.every(z=>z.hp===100));
  assert.ok(state.people.every(p=>p.health===100&&p.fatigue===0&&p.fear===0));assert.equal(new Set(state.people.map(p=>p.zone)).size,state.people.length);
  assert.ok(state.resources.materials>=100);assert.ok(state.resources.medicine>=20);assert.equal(state.buildings.length,4);assert.ok(state.buildings.every(b=>b.hp===10));
  assert.equal(b.boss?.id,BOSSES[day]?.id);assert.ok(b.schedule.every(w=>ENEMIES[w.type].day<=day));assert.equal(b.paused,true);assert.equal(b.people.length,state.people.length);
  if(BOSSES[day])assert.equal(b.people[0].zone,BOSSES[day].zone);
  if(preset==='solo-robots'){
   assert.equal(b.people[0].nightRole,'guard');assert.equal(b.challenge.day,day);
   assert.equal(occupiedBeds(state),state.beds);
   assert.deepEqual(b.robots.map(r=>r.type),['repair','defense','defense','dispatch']);
   assert.ok(b.robots.every(r=>r.powered&&validRobotPlan(r.plan)));
   assert.equal(session.dawn.resources.fuel-state.resources.fuel,4*ROBOT_RULES.fuel);
  }else assert.equal(b.robots.length,0);
 }
});

test('invalid levels and presets are rejected instead of creating a corrupted campaign',()=>{
 for(const day of [undefined,NaN,Infinity,0,-1,1.5,29,'7',null])assert.throws(()=>createTestSession({day}),/第1～28夜/);
 for(const options of [{role:'__proto__'},{role:'bad'},{preset:'__proto__'},{preset:'bad'}])assert.throws(()=>createTestSession({day:7,...options}),/职业和小院预设/);
});

test('local preparation uses real costs and can be rolled back without mutating the starting session',()=>{
 const session=createTestSession({day:14}),before=structuredClone(session);let next=testAction(session,{type:'backDay'});assert.equal(next.snapshot.state.phase,'day');
 const stock=next.snapshot.state.resources.materials;next=testAction(next,{type:'build',building:'watchtower'});assert.equal(next.snapshot.state.resources.materials,stock-5);assert.equal(next.snapshot.state.ap,4);assert.equal(next.snapshot.state.people[0].fatigue,10);
 next=testAction(next,{type:'prepare'});assert.equal(next.snapshot.state.phase,'ready');next=testAction(next,{type:'backDay'});assert.ok(next.snapshot.state.buildings.some(b=>b.type==='watchtower'));assert.equal(next.snapshot.state.day,14);
 assert.deepEqual(session,before);assert.throws(()=>testAction(session,{type:'restart',confirm:true}),/重开本关/);
});

test('a full real test night settles locally, retries its own dawn and keeps reports isolated',()=>{
 const session=createTestSession({day:1}),before=structuredClone(session),b=createBattle(session.snapshot.state,'local-test',{autoPause:false});b.paused=false;
 for(let i=0;i<10000&&!b.finished;i++)stepBattle(b);assert.equal(b.finished,true);
 const result=settleNight(session.snapshot.state,b),done=finishTestNight(session,result);assert.equal(done.snapshot.revision,1);assert.equal(done.snapshot.state.report.saved,true);assert.equal(done.snapshot.state.phase,'report');assert.equal(done.snapshot.state.report.elapsed,Number(b.elapsed.toFixed(2)));
 assert.deepEqual(session,before);assert.throws(()=>finishTestNight(done,result),/已经结算/);
 const day=testAction(done,{type:'retryDay'});assert.equal(day.snapshot.state.day,1);assert.equal(day.snapshot.state.resources.materials,session.dawn.resources.materials);assert.equal(day.snapshot.state.phase,'day');
 const next=testAction(done,{type:'nextDay'});assert.equal(next.snapshot.state.day,2);assert.equal(next.dawn.day,2);assert.equal(next.snapshot.runId,session.snapshot.runId);
});

test('failed local actions and invalid results preserve the entire test session',()=>{
 const session=createTestSession({day:28,preset:'solo'}),before=structuredClone(session);assert.throws(()=>testAction(session,{type:'build',building:'bad'}));
 const b=createBattle(session.snapshot.state,'test',{autoPause:false});b.house=0;b.paused=false;stepBattle(b);const result=settleNight(session.snapshot.state,b);result.day=27;
 assert.throws(()=>finishTestNight(session,result));assert.deepEqual(session,before);
});

test('test play never touches SQLite and its separate run ID cannot overwrite a formal save',t=>{
 const dir=mkdtempSync(join(tmpdir(),'dawn-test-mode-')),path=join(dir,'game.sqlite'),legacy=openStore(path),player=legacy.createPlayer(),store=openCampaignStore(path),observer=new DatabaseSync(path);
 t.after(()=>{observer.close();store.close();legacy.close();rmSync(dir,{recursive:true,force:true});});const formal=store.ensure(player.userId,player.snapshot),version=observer.prepare('PRAGMA data_version').get().data_version;
 let session=createTestSession({day:7,id:'isolation'});session=testAction(session,{type:'backDay'});session=testAction(session,{type:'search',site:'shed'});session=testAction(session,{type:'prepare'});
 const b=createBattle(session.snapshot.state,'local-test',{autoPause:false});b.house=0;b.paused=false;stepBattle(b);const result=settleNight(session.snapshot.state,b);session=finishTestNight(session,result);
 assert.equal(observer.prepare('PRAGMA data_version').get().data_version,version);assert.deepEqual(store.snapshot(player.userId),formal);
 assert.throws(()=>store.finishClient(player.userId,{runId:session.snapshot.runId,revision:0,nightId:`local-${session.snapshot.runId}-0`,result}),/编号无效/);assert.deepEqual(store.snapshot(player.userId),formal);
});

test('robot demonstration runs patrol, real repairs, defense and audible dispatch without manual help',()=>{
 const session=createTestSession({day:1,preset:'robots'}),base=structuredClone(session),b=createBattle(session.snapshot.state,'robot-demo');
 assert.deepEqual(b.robots.map(r=>r.type),['repair','defense','dispatch']);assert.ok(b.robots.every(r=>r.powered));assert.equal(b.paused,true);assert.equal(b.autoPause,false);assert.equal(b.challenge,null);assert.equal(b.zones[0].hp,42);
 b.paused=false;const events=[];let sequence=0;const start={...b.robots[2]};let patrolled=false;
 for(let i=0;i<4000&&!b.finished;i++){stepBattle(b);if(Math.hypot(b.robots[2].x-start.x,b.robots[2].y-start.y)>100)patrolled=true;for(const e of b.events)if(e.id>sequence){events.push(e);sequence=e.id;}}
 assert.ok(b.finished);assert.ok(patrolled);assert.ok(events.some(e=>e.type==='robot-dispatch'&&e.text.includes('视野')&&e.robotId==='robot-1'));assert.ok(events.some(e=>e.type==='robot-dispatch'&&e.text.includes('铃绳')&&e.robotId==='robot-2'));
 assert.ok(events.some(e=>e.type==='repair'&&e.robotId==='robot-1'));assert.ok(events.some(e=>e.type==='attack'&&e.robotId==='robot-2'));assert.ok(b.robots.every(r=>r.hp>0));assert.equal(b.people[0].health,100);assert.equal(finishTestNight(session,settleNight(session.snapshot.state,b)).snapshot.state.phase,'report');assert.deepEqual(session,base);
});
