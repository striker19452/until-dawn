import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,applyCampaignAction,settleNight} from '../src/campaign.js';
import {dailyConsumption} from '../src/rules.js';
import {createDog,advanceDog,stepDog,stepDogRetreat,DOG_RULES} from '../src/dog.js';
import {createBattle,stepBattle,battleCommand} from '../src/battle.js';
import {createWalkMap} from '../src/yard-geometry.js';
import {walkablePoint} from '../src/movement.js';
import {validateClientResult} from '../src/client-result.js';
import {createTestSession} from '../src/test-mode.js';

const home=()=>applyCampaignAction(initialCampaign(53),{type:'chooseRole',role:'repairman'});
const adopt=s=>applyCampaignAction(s,{type:'adoptDog'});

test('one dog joins free without using a bed, persists through preparation and cannot be ordered',()=>{
 const before=home(),s=adopt(before);assert.deepEqual(s.resources,before.resources);assert.equal(s.ap,before.ap);assert.deepEqual(s.people,before.people);assert.equal(s.beds,before.beds);
 assert.equal(s.flags.dog.name,'小麦');assert.throws(()=>adopt(s),/已经收留/);
 const ready=applyCampaignAction(s,{type:'prepare'});assert.throws(()=>adopt(ready),/只能在白天/);assert.deepEqual(applyCampaignAction(ready,{type:'backDay'}).flags.dog,s.flags.dog);
 const b=createBattle(ready,'dog-orders');assert.ok(b.dog);assert.deepEqual(b.rationNeed,{food:dailyConsumption(ready).food,water:dailyConsumption(ready).water});assert.deepEqual(b.schedule,createBattle(applyCampaignAction(before,{type:'prepare'}),'no-dog').schedule);assert.throws(()=>battleCommand(b,{type:'move',person:'dog',target:{x:100,y:400}}),/成员不存在/);
 const frozen=structuredClone(b);stepBattle(b);assert.deepEqual(b,frozen);
});

test('dog adds exactly one food, never water, and cooking discounts only the people',()=>{
 const s=home();s.people[0].nightRole='sleep';s.buildings=[{type:'stove',level:2,branch:'yield',hp:100}];s.flags.cookedDay=s.day;
 const noDog=dailyConsumption(s),withDog=dailyConsumption(adopt(s));assert.equal(withDog.food,noDog.food+1);assert.equal(withDog.dogFood,1);assert.equal(withDog.water,noDog.water);
});

test('daytime random actions include affectionate visits and stay on walkable ground',()=>{
 const map=createWalkMap(home()),dog=createDog(53,map),actions=new Set();let cuddles=0;
 for(let i=0;i<7200;i++){advanceDog(dog,.05,{people:[{id:'hero',x:215,y:350,wound:'none'}],walkMap:map});actions.add(dog.action);if(dog.cuddling)cuddles++;assert.ok(walkablePoint(dog,map));}
 for(const action of ['wander','roll','nap','stretch','greet','tilt'])assert.ok(actions.has(action),action);
 assert.ok(cuddles>0);
});

test('barks randomly select one live creature, may fail, and do not alter health or resources',()=>{
 const s=applyCampaignAction(adopt(home()),{type:'prepare'}),b=createBattle(s,'random-barks'),picks=new Set();let success=0,failed=0,lastSuccess=false;
 b.enemies=['walker','climber','caller'].map((type,i)=>({id:String(i),type,hp:100,mode:'attack',zone:'gate',x:240+i*10,y:475}));
 b.enemies.push({id:'dead',type:'walker',hp:0,mode:'attack'},{id:'dormant',type:'walker',hp:100,bossDormant:true});
 const resources=structuredClone(b.resources),people=structuredClone(b.people);
 for(let i=0;i<300;i++){
  for(const e of b.enemies)if(e.mode==='retreat')e.mode='attack';b.dog.barkIn=0;b.elapsed=i*20;
  stepDog(b,.05,{event:(_b,_type,_x,_y,_text,detail)=>{picks.add(detail.enemyId);lastSuccess=detail.success;if(detail.success)success++;else failed++;},note:()=>{}});
  assert.equal(b.enemies.filter(e=>e.mode==='retreat').length,Number(lastSuccess));
 }
 assert.equal(picks.size,3);assert.ok(success>60&&success<150);assert.ok(failed>0);assert.deepEqual(b.resources,resources);assert.deepEqual(b.people,people);
});

test('ordinary creatures briefly back off without leaving or losing health, bosses ignore barks',()=>{
 const b={elapsed:0},ordinary={hp:12,mode:'retreat',dogPreviousMode:'attack',dogRetreatUntil:2,zone:'gate',x:240,y:475};
 for(let i=0;i<41;i++){b.elapsed=i*.05;stepDogRetreat(b,ordinary,.05);}
 assert.equal(ordinary.mode,'approach');assert.equal(ordinary.hp,12);assert.ok(ordinary.y>475&&ordinary.y<=503.1);
 const state=applyCampaignAction(adopt(home()),{type:'prepare'}),night=createBattle(state,'boss-barks');
 night.enemies=[{id:'boss',boss:true,type:'bastion',hp:228,mode:'attack',zone:'gate',x:240,y:475}];
 const boss=structuredClone(night.enemies[0]);for(let i=0;i<100;i++){night.dog.barkIn=0;stepDog(night,.05,{event:()=>{},note:()=>{}});}
 assert.deepEqual(night.enemies[0],boss);assert.equal(night.dog.barks,100);assert.equal(night.dog.retreats,0);
});

for(const day of [1,7,28])test(`night ${day}: dog results settle, validate and preserve adoption`,()=>{
 const session=createTestSession({day}),base=applyCampaignAction(adopt(applyCampaignAction(session.snapshot.state,{type:'backDay'})),{type:'prepare'}),b=createBattle(base,'dog-night',{autoPause:false});
 b.paused=false;for(let i=0;i<20000&&!b.finished;i++)stepBattle(b);
 assert.ok(b.finished);const result=settleNight(base,b);assert.equal(validateClientResult(base,result),result);assert.deepEqual(result.flags.dog,base.flags.dog);
 assert.equal(result.report.dog.foodUsed,DOG_RULES.food);assert.ok(result.report.dog.barks>0);assert.equal(result.report.foodUsed,dailyConsumption({...result,weather:b.weather}).food);
 const changed=structuredClone(result);changed.flags.dog.name='different';assert.throws(()=>validateClientResult(base,changed),/不能修改日间剧情/);
 if(result.phase==='report')assert.deepEqual(applyCampaignAction(result,{type:'nextDay'}).flags.dog,base.flags.dog);
});
