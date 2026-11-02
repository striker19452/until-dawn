import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,applyCampaignAction as act,makePerson,settleNight} from '../src/campaign.js';
import {createBattle,stepBattle,battleCommand,inner} from '../src/battle.js';
import {createLocalNight} from '../src/local-night.js';
import {nightProgress} from '../src/night-progress.js';
import {ENEMIES,ZONES} from '../src/content.js';
import {BOSSES} from '../src/boss-content.js';
import {validateClientResult} from '../src/client-result.js';

function fixture(day=1){let s=act(initialCampaign(53),{type:'chooseRole',role:'watchman'});s.day=day;s.people[0].nightRole='sleep';s.flags.centralFire=false;const base=act(s,{type:'prepare'}),b=createBattle(base,'clear',{autoPause:false});b.schedule=[];b.paused=false;return {base,b};}
function enemy(type='walker',extra={}){return {id:type,type,zone:'gate',x:240,y:475,hp:ENEMIES[type].hp,max:ENEMIES[type].hp,mode:'attack',attack:0,progress:0,stun:0,called:false,...extra};}

test('the first arrival and later scheduled waves prevent an empty yard from ending the night',()=>{
 const {b}=fixture();b.challenge=null;b.schedule=[{at:1,type:'walker',zone:'gate'},{at:3,type:'climber',zone:'left'}];
 for(let i=0;i<10;i++)stepBattle(b);assert.deepEqual(nightProgress(b),{active:0,pending:2,remaining:2,cleared:false});
 for(let i=0;i<12;i++)stepBattle(b);assert.equal(b.enemies.length,1);b.enemies[0].hp=0;stepBattle(b);
 assert.equal(b.finished,false);assert.equal(nightProgress(b).pending,1);
 while(b.elapsed<3.1)stepBattle(b);assert.equal(b.enemies[0].type,'climber');assert.equal(nightProgress(b).pending,0);
 b.enemies[0].hp=0;stepBattle(b);assert.equal(b.finished,true);assert.ok(b.elapsed<4);assert.equal(nightProgress(b).cleared,true);
});

test('the actual final strike ends the night that frame and refunds unfinished work exactly once',()=>{
 const {base,b}=fixture();base.people[0].nightRole=b.people[0].nightRole='guard';delete b.indoorPeople.hero;Object.assign(b.people[0],inner(ZONES[0]));
 const ally=makePerson('lin','林禾','园艺师','survival');ally.nightRole='sleep';base.people.push(structuredClone(ally));b.people.push({...ally,x:100,y:350});b.work.lin=0;
 b.enemies=[enemy('walker',{hp:1,challenge:true})];b.challenge.spawned=1;
 const stock=b.resources.materials;battleCommand(b,{type:'repair',person:'lin',target:'left'});assert.equal(b.resources.materials,stock-1);
 stepBattle(b);assert.equal(b.finished,true);assert.equal(b.paused,true);assert.ok(b.elapsed<1);assert.equal(b.resources.materials,stock);assert.equal(b.people[1].task,null);assert.equal(b.challenge.status,'cleared');
 assert.ok(b.events.some(e=>e.type==='attack'));assert.ok(b.log.some(line=>line.includes('全部击退')));
 const frozen=structuredClone(b);stepBattle(b);assert.deepEqual(b,frozen);assert.throws(()=>battleCommand(b,{type:'resume'}),/已经结束/);
 const result=settleNight(base,b);assert.equal(result.report.elapsed,b.elapsed);assert.equal(validateClientResult(base,result),result);
});

test('live ordinary enemies keep fighting beyond 120 seconds and only their defeat ends the night',()=>{
 const {b}=fixture();b.challenge=null;b.elapsed=180;b.enemies=[enemy('rammer')];stepBattle(b);
 assert.equal(b.finished,false);assert.equal(b.enemies[0].mode,'attack');assert.ok(b.enemies[0].attack>0);
 b.enemies[0].hp=0;stepBattle(b);assert.equal(b.finished,true);assert.ok(b.elapsed>180);
});

test('all four bosses must be defeated even beyond 150 seconds, including all three split bodies',()=>{
 for(const day of [7,14,21,28]){
  const {b}=fixture(day),def=BOSSES[day];b.schedule=[{at:.05,type:def.id,zone:def.zone,challenge:true}];stepBattle(b);
  b.elapsed=180;stepBattle(b);assert.equal(b.finished,false);assert.equal(b.boss.defeated,false);assert.notEqual(b.enemies[0].mode,'retreat');
  b.enemies[0].hp=0;stepBattle(b);
  if(day===28){assert.equal(b.finished,false);assert.equal(nightProgress(b).remaining,3);b.enemies[0].hp=0;stepBattle(b);assert.equal(b.finished,false);b.enemies[1].hp=0;stepBattle(b);assert.equal(b.finished,false);assert.equal(b.boss.defeated,false);for(const e of b.enemies)e.hp=0;stepBattle(b);}
  assert.equal(b.boss.defeated,true);assert.equal(b.finished,true);assert.equal(b.challenge.status,'cleared');
 }
});

test('caller reinforcements must also be cleared after the caller dies',()=>{
 const {b}=fixture();b.challenge=null;b.enemies=[enemy('caller',{progress:99})];stepBattle(b);assert.equal(b.reinforcements,1);
 b.enemies.find(e=>e.type==='caller').hp=0;stepBattle(b);assert.equal(b.finished,false);assert.equal(b.enemies.length,1);assert.equal(b.enemies[0].type,'walker');
 b.enemies[0].hp=0;stepBattle(b);assert.equal(b.finished,true);
});

test('house loss ends immediately even with future waves remaining',()=>{
 const {b}=fixture();b.schedule=[{at:90,type:'walker',zone:'gate'}];b.house=0;stepBattle(b);assert.equal(b.finished,true);assert.equal(b.challenge.status,'missed');assert.equal(b.schedule.length,1);
});

test('the local runner publishes the early result and stops resource and time updates',()=>{
 const {base}=fixture();let time=0;const sent=[],runner=createLocalNight({state:base,runId:'early',revision:2},{now:()=>time,emit:m=>sent.push(structuredClone(m))});runner.battle.schedule=[{at:.05,type:'walker',zone:'gate'}];runner.command({type:'autoPause',enabled:false});runner.command({type:'resume'});
 time=100;runner.tick();runner.battle.enemies[0].hp=0;time+=100;runner.tick();assert.ok(runner.result);assert.ok(runner.battle.elapsed<1);assert.ok(sent.at(-1).result);
 const finished=structuredClone(runner.result),elapsed=runner.battle.elapsed;time+=30000;runner.tick();assert.deepEqual(runner.result,finished);assert.equal(runner.battle.elapsed,elapsed);
 assert.equal(validateClientResult(base,structuredClone(finished)).report.elapsed,finished.report.elapsed);
 const legacy=structuredClone(finished);delete legacy.report.elapsed;assert.equal(validateClientResult(base,legacy),legacy);
 for(const elapsed of [-1,NaN,Infinity]){const invalid=structuredClone(finished);invalid.report.elapsed=elapsed;assert.throws(()=>validateClientResult(base,invalid),/守夜用时/);}
});
