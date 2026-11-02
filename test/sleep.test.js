import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,applyCampaignAction,settleNight} from '../src/campaign.js';
import {createBattle,battleCommand,stepBattle} from '../src/battle.js';
import {HOUSE_DOOR,HOUSE_INTERIOR,isIndoors,sleepInterrupted} from '../src/shelter.js';
import {walkablePoint} from '../src/movement.js';
import {orderStatus} from '../client/orders.js';
import {validateClientResult} from '../src/client-result.js';

function fixture(){
 let base=applyCampaignAction(initialCampaign(53),{type:'chooseRole',role:'repairman'});
 base=applyCampaignAction(base,{type:'recruit',person:'lin'});
 base=applyCampaignAction(base,{type:'nightRole',person:'hero',role:'sleep'});
 base=applyCampaignAction(base,{type:'nightRole',person:'lin',role:'guard',zone:'right'});
 base=applyCampaignAction(base,{type:'prepare'});
 const b=createBattle(base,'sleeping',{autoPause:false});b.schedule=[{at:9999,type:'walker',zone:'gate'}];b.challenge=null;
 return {base,b};
}
const person=b=>b.people.find(p=>p.id==='hero');
const command=(b,type,target)=>battleCommand(b,{type,person:'hero',target});
function until(b,condition){for(let i=0;i<1600&&!condition();i++){stepBattle(b);if(!isIndoors(b,person(b)))assert.ok(walkablePoint(person(b),b.walkMap),'outdoor return route remains walkable');}assert.ok(condition());}

test('sleepers start inside the house before the paused night begins, while guards stay outside',()=>{
 const {b}=fixture(),p=person(b);
 assert.ok(isIndoors(b,p));assert.deepEqual({x:p.x,y:p.y},HOUSE_INTERIOR);assert.ok(!walkablePoint(p,b.walkMap));
 assert.equal(isIndoors(b,b.people[1]),false);assert.ok(walkablePoint(b.people[1],b.walkMap));
 assert.equal(orderStatus(p,b).current,'屋内睡眠');assert.equal(orderStatus(p,b).activity,'屋内睡眠');
 assert.ok(isIndoors(structuredClone(b),p),'worker snapshots retain indoor occupants');
});

test('paused orders keep sleepers inside; resuming brings them out through the door and completion sends them home',()=>{
 const {b}=fixture();command(b,'move',{x:350,y:410});
 const queued=structuredClone(person(b));stepBattle(b);
 assert.deepEqual(person(b),queued);assert.ok(isIndoors(b,person(b)));assert.match(orderStatus(person(b),b).current,/待执行/);
 command(b,'resume');stepBattle(b);
 assert.equal(isIndoors(b,person(b)),false);assert.ok(Math.hypot(person(b).x-HOUSE_DOOR.x,person(b).y-HOUSE_DOOR.y)<3);
 assert.ok(walkablePoint(person(b),b.walkMap));
 until(b,()=>person(b).task?.stage==='work');until(b,()=>!person(b).task);
 assert.equal(isIndoors(b,person(b)),false);assert.equal(orderStatus(person(b),b).current,'正在回屋休息 · 睡眠已中断');
 until(b,()=>isIndoors(b,person(b)));
 assert.equal(person(b).nightRole,'sleep');assert.equal(orderStatus(person(b),b).current,'屋内休息 · 睡眠已中断');
});

test('cancelling indoors does not wake sleepers; cancelling outdoors refunds once and resumes the return after unpausing',()=>{
 const {b}=fixture(),materials=b.resources.materials;b.zones[0].hp=40;
 command(b,'repair','gate');command(b,'cancel');assert.equal(b.resources.materials,materials);assert.ok(isIndoors(b,person(b)));
 command(b,'repair','gate');command(b,'resume');for(let i=0;i<40;i++)stepBattle(b);
 assert.ok(!isIndoors(b,person(b)));command(b,'pause');command(b,'cancel');command(b,'cancel');
 assert.equal(b.resources.materials,materials);const frozen=structuredClone(person(b));stepBattle(b);assert.deepEqual(person(b),frozen);
 command(b,'resume');until(b,()=>isIndoors(b,person(b)));assert.equal(person(b).task,null);
});

test('indoor sleepers do not attack or take courtyard contact damage, including when an order is queued',()=>{
 const {b}=fixture();command(b,'move',{x:350,y:410});
 b.enemies=[{id:'inside',type:'walker',zone:'gate',...HOUSE_INTERIOR,hp:100,max:100,mode:'inside',stun:0,attack:0,progress:0}];
 const health=person(b).health;command(b,'resume');stepBattle(b);
 assert.equal(person(b).health,health);assert.equal(b.enemies[0].hp,100);
 command(b,'cancel');until(b,()=>isIndoors(b,person(b)));b.enemies=[];
 for(let i=0;i<20;i++)stepBattle(b);assert.ok(isIndoors(b,person(b)));assert.equal(person(b).task,null);
});

test('sleeping injured people can leave for first aid and then return to indoor sleep without adding saved fields',()=>{
 const {base,b}=fixture();Object.assign(person(b),{wound:'severe',health:15,deadline:2});b.resources.medicine=3;
 command(b,'aid');command(b,'resume');until(b,()=>!person(b).task);until(b,()=>isIndoors(b,person(b)));
 assert.equal(person(b).wound,'recovering');assert.equal(person(b).health,42);
 const result=settleNight(base,b);assert.equal(result.people[0].nightRole,'sleep');assert.equal(result.indoorPeople,undefined);
 for(const key of ['indoorPeople','indoors','sleepInterrupted','x','y','task'])assert.equal(result.people[0][key],undefined);
 validateClientResult(base,result);
});

test('uninterrupted sleep restores 22 fatigue; paused, cancelled and invalid orders do not forfeit it',()=>{
 const {base,b}=fixture();base.people[0].fatigue=person(b).fatigue=60;
 command(b,'move',{x:315,y:365});assert.equal(sleepInterrupted(b,person(b)),false);
 const queued=structuredClone(b);assert.throws(()=>command(b,'move',{x:NaN,y:365}));assert.deepEqual(b,queued);
 command(b,'cancel');command(b,'cancel');command(b,'budget');command(b,'resume');stepBattle(b);
 assert.equal(sleepInterrupted(b,person(b)),false);assert.equal(orderStatus(person(b),b).current,'屋内睡眠');
 assert.equal(settleNight(base,b).people[0].fatigue,38);
});

test('zero-work movement forfeits sleep for the whole night, even after return, cancellation or another order',()=>{
 for(const stove of [false,true]){
  const {base,b}=fixture();base.people[0].fatigue=person(b).fatigue=60;
  if(stove)base.buildings=[{id:'stove',type:'stove',level:2,branch:'steady'}];
  command(b,'move',{x:315,y:365});command(b,'resume');until(b,()=>!person(b).task);until(b,()=>isIndoors(b,person(b)));
  assert.equal(b.work.hero,0);assert.ok(sleepInterrupted(b,person(b)));assert.match(orderStatus(person(b),b).after,/本夜无睡眠收益/);
  command(b,'move',{x:315,y:365});command(b,'cancel');assert.ok(sleepInterrupted(b,person(b)));
  const result=settleNight(base,b);assert.equal(result.people[0].fatigue,60-(stove?6:0));assert.equal(result.people[0].nightRole,'sleep');
  assert.equal(b.log.filter(line=>line.includes('被叫醒')).length,1);
  assert.ok(result.report.events.some(line=>line.includes('未恢复22疲劳')));assert.equal(result.sleepInterrupted,undefined);assert.equal(result.flags.sleepInterrupted,undefined);
  validateClientResult(base,result);assert.deepEqual(settleNight(base,b),result,'retries do not restore or deduct sleep twice');
  const morning=applyCampaignAction(result,{type:'nextDay'});assert.equal(morning.people[0].fatigue,50-(stove?6:0));
 }
});

test('every actual temporary order interrupts sleep and cancelling after the first tick cannot restore its benefit',()=>{
 for(const type of ['move','repair','barricade','fire','stoke','addWood','extinguish','guard','brace','throw','bait','compact','clearWet','retreat','aid']){
  const {base,b}=fixture();base.people[0].fatigue=person(b).fatigue=60;base.resources.medicine=b.resources.medicine=4;b.house=75;b.zones[0].hp=40;
  if(type==='fire')b.fires[0].heat=0;if(type==='addWood')b.fires[0].wood=.2;
  if(type==='aid')Object.assign(person(b),{wound:'severe',health:15,deadline:2});
  command(b,type,type==='move'?{x:315,y:365}:['fire','stoke','addWood','extinguish','clearWet'].includes(type)?'central':'gate');
  assert.equal(sleepInterrupted(b,person(b)),false,type);command(b,'resume');stepBattle(b);assert.ok(sleepInterrupted(b,person(b)),type);
  command(b,'cancel');assert.ok(sleepInterrupted(b,person(b)),type);
  const result=settleNight(base,b);assert.equal(result.people[0].fatigue,60+Math.min(38,b.work.hero*.22),type);validateClientResult(base,result);
 }
});

test('interrupted sleepers receive no further sleep-specific calming while returning or resting indoors',()=>{
 const {b}=fixture();b.fires=[];person(b).fear=40;command(b,'move',{x:315,y:365});command(b,'resume');stepBattle(b);command(b,'cancel');
 until(b,()=>isIndoors(b,person(b)));for(let i=0;i<20;i++)stepBattle(b);assert.equal(person(b).fear,40);
 const quiet=fixture().b;quiet.fires=[];person(quiet).fear=40;command(quiet,'resume');for(let i=0;i<20;i++)stepBattle(quiet);assert.ok(person(quiet).fear<40);
});

test('sleep eligibility resets next night without changing the configured role or persisting runtime flags',()=>{
 const {base,b}=fixture();base.people[0].fatigue=person(b).fatigue=60;command(b,'retreat');command(b,'resume');stepBattle(b);command(b,'cancel');
 const morning=applyCampaignAction(settleNight(base,b),{type:'nextDay'}),nextBase=applyCampaignAction(morning,{type:'prepare'}),next=createBattle(nextBase,'sleeping-next');
 assert.equal(person(next).nightRole,'sleep');assert.equal(sleepInterrupted(next,person(next)),false);
 assert.equal(settleNight(nextBase,next).people[0].fatigue,28);
});
