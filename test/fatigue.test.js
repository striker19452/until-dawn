import test from 'node:test';
import assert from 'node:assert/strict';
import {fatigueEffects} from '../src/fatigue.js';
import {initialCampaign,applyCampaignAction as act,settleNight} from '../src/campaign.js';
import {createBattle,battleCommand,stepBattle,inner} from '../src/battle.js';
import {orderDuration} from '../src/night-orders.js';
import {orderStatus} from '../client/orders.js';
import {ZONES} from '../src/content.js';
import {validateClientResult} from '../src/client-result.js';

const close=(actual,expected,tolerance=1e-7)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} != ${expected}`);
function fixture(fatigue=0,role='guard'){
 let s=act(initialCampaign(53),{type:'chooseRole',role:'repairman'});s.people[0].fatigue=fatigue;
 s=act(s,{type:'nightRole',person:'hero',role});const base=act(s,{type:'prepare'});
 const b=createBattle(base,'fatigue',{autoPause:false});b.schedule=[{at:9999,type:'walker',zone:'gate'}];b.challenge=null;b.paused=false;
 b.supportBudget={materials:0,firewood:0};return {base,b};
}

test('fatigue applies continuously from point one, without a discontinuity at 70 or an unusable maximum',()=>{
 assert.deepEqual(fatigueEffects(0),{movement:1,work:1,recovery:1});
 assert.deepEqual(fatigueEffects(50),{movement:.85,work:.8,recovery:.75});
 assert.deepEqual(fatigueEffects(100),{movement:.7,work:.6,recovery:.5});
 let previous=fatigueEffects(0);
 for(let f=1;f<=100;f++){
  const current=fatigueEffects(f);for(const key of Object.keys(current))assert.ok(current[key]<previous[key]&&current[key]>0);
  previous=current;
 }
 for(const key of Object.keys(previous))assert.ok(Math.abs(fatigueEffects(70.001)[key]-fatigueEffects(69.999)[key])<.00002);
 assert.deepEqual(fatigueEffects(-20),fatigueEffects(0));assert.deepEqual(fatigueEffects(120),fatigueEffects(100));
});

test('all outdoor movement paths respect fatigue, including automatic return, sleep and severe retreat',()=>{
 const travel=(fatigue,mode)=>{
  const {b}=fixture(fatigue),p=b.people[0];Object.assign(p,inner(ZONES[0]));p.zone='left';
  if(mode==='move')battleCommand(b,{type:'move',person:'hero',target:inner(ZONES[1])});
  if(mode==='sleep')p.nightRole='sleep';
  if(mode==='severe')p.wound='severe';
  if(mode==='chase'||mode==='guard'){
   b.enemies=[{id:'target',type:'walker',zone:'left',...inner(ZONES[1]),hp:100,max:100,mode:'attack',stun:0,progress:0,attack:0}];
   if(mode==='guard'){battleCommand(b,{type:'guard',person:'hero',target:'left'});b.people[0].task.stage='work';}
  }
  const before={x:b.people[0].x,y:b.people[0].y};stepBattle(b);
  return Math.hypot(b.people[0].x-before.x,b.people[0].y-before.y);
 };
 for(const mode of ['move','return','sleep','severe','chase','guard']){
  const fresh=travel(0,mode);assert.ok(fresh>1,mode);
  for(const fatigue of [1,25,50,70,71,100])close(travel(fatigue,mode)/fresh,1-.003*fatigue);
 }
});

test('fatigue scales actual work duration and its visible countdown; timed holds never become longer bonuses',()=>{
 const measured=[];
 for(const fatigue of [0,25,50,75,100]){
  const {b}=fixture(fatigue),p=b.people[0];b.zones[0].hp=30;
  battleCommand(b,{type:'repair',person:'hero',target:'gate'});
  b.people[0].task.stage='work';const duration=orderDuration(p,'repair');
  close(duration,4/(1-.004*fatigue));
  assert.match(orderStatus(b.people[0],b).current,new RegExp(`剩余${Math.ceil(duration)}秒`));
  for(let i=0;i<400&&b.people[0].task;i++)stepBattle(b);
  assert.equal(b.people[0].task,null);assert.equal(b.zones[0].hp,59);
  assert.ok(b.elapsed>=duration&&b.elapsed<duration+.051);measured.push(b.elapsed);
  for(const type of ['move','retreat','brace'])assert.equal(orderDuration({...p,fear:90},type),8);
  close(orderDuration({...p,fear:90},'throw'),2/(1-.004*fatigue));
 }
 assert.ok(measured.every((n,i)=>!i||n>measured[i-1]));
});

test('fatigue reduces regeneration with and without fire, pause stays frozen and personal capacity still caps it',()=>{
 for(const fatigue of [0,1,25,50,75,100])for(const warm of [false,true]){
  const {b}=fixture(fatigue),p=b.people[0];if(!warm)b.fires=[];
  p.stamina=40;stepBattle(b);close(p.stamina,40+.05*(warm?2:1.6)*(1-.005*fatigue));
  b.paused=true;const frozen=p.stamina;stepBattle(b);assert.equal(p.stamina,frozen);
  b.paused=false;p.stamina=109.999;stepBattle(b);assert.equal(p.stamina,110);
 }
});

test('guard/support receive no fatigue recovery, uninterrupted sleep restores 22 and morning recovers exactly 10',()=>{
 for(const role of ['guard','support','sleep'])for(const workload of [0,50,200])for(const stove of [false,true]){
  const {base,b}=fixture(50,role);if(stove)base.buildings=[{id:'stove',type:'stove',level:2,branch:'steady'}];
  b.work.hero=workload;if(role==='sleep'&&workload>0)b.sleepInterrupted.hero=true;const result=settleNight(base,b);
  const expected=50+Math.min(38,workload*.22)-(role==='sleep'&&!workload?22:0)-(stove?6:0);
  close(result.people[0].fatigue,expected);validateClientResult(base,result);
  const morning=act(result,{type:'nextDay'});close(morning.people[0].fatigue,Math.max(0,expected-10));
  assert.deepEqual(act(result,{type:'nextDay'}),morning,'retrying from the same report does not compound recovery');
 }
 const {base,b}=fixture(95);b.work.hero=200;const tired=settleNight(base,b);assert.equal(tired.people[0].fatigue,100);
 assert.equal(act(tired,{type:'nextDay'}).people[0].fatigue,90);
 const severe=fixture(50);Object.assign(severe.b.people[0],{wound:'severe',health:15,deadline:3});
 const report=settleNight(severe.base,severe.b);assert.equal(act(report,{type:'nextDay'}).people[0].fatigue,50);
});

test('rest and rotating a working companion lower fatigue at a real production cost over several days',()=>{
 function days(rotate){
  let s=act(initialCampaign(53),{type:'chooseRole',role:'repairman'});s=act(s,{type:'recruit',person:'lin'});
  s.people[1].fatigue=50;s.resources.food=100;s.resources.water=100;
  for(let d=0;d<4;d++){
   const rest=rotate&&d%2===1;
   s=act(s,{type:'assign',person:'lin',job:rest?'rest':'forage'});
   s=act(s,{type:'nightRole',person:'lin',role:rest?'sleep':'guard'});
   const base=act(s,{type:'prepare'}),b=createBattle(base,'rotation');b.challenge=null;b.work.lin=rest?0:100;
   s=act(settleNight(base,b),{type:'nextDay'});
  }
  return s;
 }
 const constant=days(false),rotated=days(true),tired=constant.people[1],rested=rotated.people[1];
 assert.equal(tired.fatigue,90);assert.equal(rested.fatigue,0);
 assert.equal(constant.resources.fuel-rotated.resources.fuel,8);
 for(const key of ['movement','work','recovery'])assert.ok(fatigueEffects(rested.fatigue)[key]>fatigueEffects(tired.fatigue)[key]);
 const {base}=fixture(50);base.phase='day';const active=act(base,{type:'rest'});assert.equal(active.people[0].fatigue,22);
});
