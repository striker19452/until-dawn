import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,applyCampaignAction,makePerson,settleNight,normalizeNutrition} from '../src/campaign.js';
import {createBattle,battleCommand} from '../src/battle.js';
import {nutritionStatus,canRecoverHealth} from '../src/rules.js';
import {validateClientResult} from '../src/client-result.js';

const act=(s,type,extra={})=>applyCampaignAction(s,{type,...extra});
const day=(seed=53)=>act(initialCampaign(seed),'chooseRole',{role:'repairman'});
function done(s){const ready=act(s,'prepare'),battle=createBattle(ready,'nutrition',{autoPause:false});battle.challenge=null;return {ready,result:settleNight(ready,battle)};}
function crew(){const s=day();s.people.push(makePerson('lin','林禾','园艺师','survival'),makePerson('zhou','老周','维修师傅','engineering'));s.people.forEach(p=>Object.assign(p,{health:50,fatigue:40,fear:40}));s.resources.food=100;s.resources.water=100;s.buildings=[{id:'clinic',type:'infirmary',level:1}];s.people[1].job='care';s.people[2].job='rest';return s;}

test('hunger and thirst are independent conditions; each shortage deals 10 health per person at every settlement',()=>{
 for(const food of [0,2])for(const water of [0,1]){const s=day();Object.assign(s.resources,{food,water});s.people[0].health=80;const before=structuredClone(s),{ready,result}=done(s),p=result.people[0];assert.equal(p.hunger,!food);assert.equal(p.thirst,!water);assert.equal(p.health,80-(food?0:10)-(water?0:10));assert.equal(result.report.nutritionDamage,(food?0:10)+(water?0:10));assert.deepEqual(s,before);validateClientResult(ready,result);}
 let s=day();Object.assign(s.resources,{food:0,water:0});for(const health of [80,60]){s=done(s).result;assert.equal(s.people[0].health,health);s=act(s,'nextDay');assert.equal(s.people[0].health,health);assert.equal(s.ap,6);}
 const group=crew();Object.assign(group.resources,{food:0,water:0});assert.ok(done(group).result.people.every(p=>p.health===30));
 const last=day();last.people[0].health=80;Object.assign(last.resources,{food:2,water:1});const report=done(last).result;assert.equal(report.resources.food,0);assert.equal(report.resources.water,0);assert.equal(report.people[0].hunger,false);assert.equal(report.people[0].thirst,false);assert.equal(report.report.nutritionDamage,0);normalizeNutrition(report);assert.equal(report.people[0].hunger,false);
 const morning=act(report,'nextDay');assert.equal(morning.people[0].hunger,true);assert.equal(morning.people[0].thirst,true);assert.equal(morning.people[0].health,80);
});

test('conditions enter on spending and clear on sufficient resupply; night reservations and refunds update them immediately',()=>{
 let s=day();s.day=8;s.resources.food=2;s=act(s,'event',{choice:'meal'});assert.equal(s.people[0].hunger,true);s=act(s,'search',{site:'alley'});assert.equal(s.people[0].hunger,false);
 s=day();s.resources.water=1;s.buildings=[{id:'garden',type:'garden',level:1,age:0}];s=act(s,'craft',{item:'medicine'});assert.equal(s.people[0].thirst,true);s=act(s,'search',{site:'clinic'});assert.equal(s.people[0].thirst,false);
 const base=act(day(),'prepare');base.resources.food=2;const battle=createBattle(base,'bait');assert.equal(battle.people[0].hunger,false);battleCommand(battle,{type:'bait',person:'hero',target:'gate'});assert.equal(battle.people[0].hunger,true);battleCommand(battle,{type:'cancel',person:'hero'});assert.equal(battle.people[0].hunger,false);
 const hot=day(7);hot.resources.water=1;assert.deepEqual(nutritionStatus(hot),{hungry:false,thirsty:true});
});

test('either missing food or water blocks morning, rest, clinic and care health recovery, while medicine still treats',()=>{
 for(const resource of ['food','water']){
  const s=crew();s.resources[resource]=0;assert.equal(canRecoverHealth(s),false);
  const rested=act(s,'rest');assert.equal(rested.people[0].health,50);assert.equal(rested.people[0].fatigue,12);
  const prepared=act(s,'prepare');assert.ok(prepared.people.every(p=>p.health===50));assert.ok(prepared.jobGains.some(line=>line.includes('暂停恢复健康')));
  const report=settleNight(prepared,createBattle(prepared,'no-heal'));const health=report.people.map(p=>p.health),morning=act(report,'nextDay');assert.deepEqual(morning.people.map(p=>p.health),health);
  assert.equal(act(s,'treat',{person:'hero'}).people[0].health,80);
 }
 const enough=act(crew(),'prepare');assert.deepEqual(enough.people.map(p=>p.health),[60,57,62]);
});

test('dusk recovery uses all completed harvests and water jobs, independent of worker ordering',()=>{
 for(const reverse of [false,true]){const s=crew();s.resources.food=8;s.resources.water=0;s.people[1].job='water';s.people[2].job='care';if(reverse)s.people=[s.people[0],s.people[2],s.people[1]];const ready=act(s,'prepare');assert.equal(ready.resources.water,3);assert.ok(ready.people.every(p=>!p.hunger&&!p.thirst));assert.equal(ready.people.find(p=>p.id==='hero').health,60);assert.equal(ready.people.find(p=>p.id==='zhou').health,57);}
});

test('legacy counters normalize without new fields, old-browser numeric results remain saveable, invalid conditions are rejected',()=>{
 const s=day();Object.assign(s.people[0],{hunger:90,thirst:80});normalizeNutrition(s);assert.equal(s.people[0].hunger,false);assert.equal(s.people[0].thirst,false);
 s.resources.food=0;const {ready,result}=done(s),legacy=structuredClone(result);Object.assign(legacy.people[0],{hunger:28,thirst:0});delete legacy.report.nutritionDamage;validateClientResult(ready,legacy);const health=legacy.people[0].health;normalizeNutrition(legacy);assert.equal(legacy.people[0].hunger,true);assert.equal(legacy.people[0].thirst,false);assert.equal(legacy.people[0].health,health);
 for(const value of ['yes',null,-1,101,NaN]){const bad=structuredClone(result);bad.people[0].hunger=value;assert.throws(()=>validateClientResult(ready,bad),/补给状态/);}
 const bad=structuredClone(result);bad.report.nutritionDamage=20;assert.throws(()=>validateClientResult(ready,bad),/补给伤害/);
});
