import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,applyCampaignAction} from '../src/campaign.js';
import {createBattle,battleCommand,stepBattle} from '../src/battle.js';
import {yardFires,CENTRAL_FIRE,campfireActive} from '../src/campfire.js';
import {ENEMIES,ZONES} from '../src/content.js';
import {enemyFeedback} from '../client/combat-feedback.js';
import {createWalkMap} from '../src/yard-geometry.js';
import {walkablePoint} from '../src/movement.js';

function day(){return applyCampaignAction(initialCampaign(53),{type:'chooseRole',role:'repairman'});}
test('old perimeter installations cannot create extra fires or consume extra fuel',()=>{
 const s=day();for(const z of s.zones)Object.assign(z,{brazier:true,shade:true,lit:true});const old=structuredClone(s);
 const ready=applyCampaignAction(s,{type:'prepare'}),b=createBattle(ready,'central-only');
 assert.deepEqual(b.fires.map(f=>({id:f.id,x:f.x,y:f.y})),[CENTRAL_FIRE]);assert.equal(b.resources.fuel,ready.resources.fuel);assert.deepEqual(s,old);
 assert.deepEqual(yardFires(s).map(f=>f.id),['central']);assert.deepEqual(yardFires(s,b).map(f=>f.id),['central']);
 const before=structuredClone(b);for(const type of ['fire','clearWet'])assert.throws(()=>battleCommand(b,{type,person:'hero',target:'left'}),/中央篝火/);assert.deepEqual(b,before);
 assert.equal(createWalkMap(s).obstacles.length,2,'legacy braziers do not leave invisible navigation obstacles');
 assert.equal(walkablePoint(CENTRAL_FIRE,createWalkMap(s)),false);
});
test('only the central fire can be enabled and perimeter fire construction is rejected atomically',()=>{
 const s=day(),before=structuredClone(s);
 for(const feature of ['brazier','shade'])assert.throws(()=>applyCampaignAction(s,{type:'defense',zone:'left',feature}),/中央篝火/);
 assert.throws(()=>applyCampaignAction(s,{type:'toggleFire',target:'left'}),/中央篝火/);assert.deepEqual(s,before);
 const off=applyCampaignAction(s,{type:'toggleFire',target:'central'}),ready=applyCampaignAction(off,{type:'prepare'}),b=createBattle(ready,'unlit');
 assert.equal(b.fires.length,1);assert.equal(b.fires[0].heat,0);assert.equal(b.resources.fuel,ready.resources.fuel);
 b.fires[0].wood=1;b.schedule=[{at:9999,type:'walker',zone:'gate'}];b.challenge=null;b.paused=false;b.people[0].nightRole='sleep';battleCommand(b,{type:'fire',person:'hero',target:'central'});
 for(let i=0;i<400&&b.people[0].task;i++)stepBattle(b);
 assert.equal(b.people[0].task,null);assert.ok(b.fires[0].heat>30);assert.equal(b.fires.length,1);
});

function quietNight(s=day()){
 const base=applyCampaignAction(s,{type:'prepare'}),b=createBattle(base,'wood',{autoPause:false});
 b.schedule=[{at:9999,type:'walker',zone:'gate'}];b.challenge=null;b.people.forEach(p=>p.nightRole='sleep');
 return {base,b};
}
function finishOrder(b,type){
 battleCommand(b,{type,person:'hero',target:'central'});b.paused=false;
 for(let i=0;i<1600&&b.people[0].task;i++)stepBattle(b);
 assert.equal(b.people[0].task,null);
}
test('adding fire directly deducts one material and lights an empty hearth',()=>{
 const s=applyCampaignAction(day(),{type:'toggleFire',target:'central'}),{b}=quietNight(s),stock=structuredClone(b.resources);
 finishOrder(b,'addWood');assert.equal(b.resources.materials,stock.materials-1);assert.equal(b.resources.fuel,stock.fuel);
 assert.equal(b.fires[0].wood,1);assert.ok(b.fires[0].heat>=60);assert.equal(yardFires(s)[0].heat,0);
});
test('extinguishing preserves wood, relighting is free, and only active burning depletes the pile',()=>{
 const {b}=quietNight();finishOrder(b,'extinguish');const wood=b.fires[0].wood,stock=structuredClone(b.resources);
 for(let i=0;i<100;i++)stepBattle(b);
 assert.equal(b.fires[0].wood,wood);assert.equal(b.fires[0].heat,0);
 finishOrder(b,'fire');assert.deepEqual(b.resources,stock);assert.equal(b.fires[0].wood,wood);
 stepBattle(b);assert.ok(b.fires[0].wood<wood);
 b.fires[0].wood=.00001;stepBattle(b);assert.equal(b.fires[0].wood,0);assert.equal(b.fires[0].heat,0);
 assert.throws(()=>battleCommand(b,{type:'fire',person:'hero',target:'central'}),/余柴/);
});
test('adding wood and cancelling transfers are accounted once and unused wood survives settlement',async()=>{
 const {settleNight}=await import('../src/campaign.js');const {validateClientResult}=await import('../src/client-result.js');
 const {base,b}=quietNight();finishOrder(b,'extinguish');b.fires[0].wood=.2;const wood=b.fires[0].wood,materials=b.resources.materials;
 battleCommand(b,{type:'addWood',person:'hero',target:'central'});battleCommand(b,{type:'cancel',person:'hero'});
 assert.equal(b.resources.materials,materials);assert.equal(b.fires[0].wood,wood);
 finishOrder(b,'addWood');assert.equal(b.fires[0].wood,1);assert.equal(b.resources.materials,materials-1);
 const result=settleNight(base,b);validateClientResult(base,result);assert.equal(result.flags.campfireWood,1);
 const bad=structuredClone(result);bad.flags.campfireWood+=5;assert.throws(()=>validateClientResult(base,bad),/柴料/);
});
test('quencher spray reduces heat without destroying stored wood',()=>{
 const {b}=quietNight();b.paused=false;
 b.enemies=[{id:'spray',type:'quencher',zone:'gate',x:240,y:390,hp:100,max:100,mode:'attack',stun:0,attack:0,progress:8}];
 const wood=b.fires[0].wood,heat=b.fires[0].heat;stepBattle(b);
 assert.ok(b.fires[0].heat<heat-8);assert.ok(Math.abs(b.fires[0].wood-(wood-.05*.006))<1e-9);
});

function foe(type,zone,extra={}){const p=ZONES.find(z=>z.id===zone);return {id:type+'-'+zone,type,zone,x:p.x,y:p.y,hp:ENEMIES[type].hp,max:ENEMIES[type].hp,mode:'attack',stun:0,attack:0,progress:0,called:false,...extra};}
const fireStates=[{heat:60,wet:0,active:true},{heat:60,wet:4,active:false},{heat:15,wet:0,active:false},{heat:0,wet:0,active:false}];
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);

test('one central fire reduces every species attack in all five sectors, with matching feedback and loss of protection',()=>{
 for(const state of fireStates)for(const [type,def] of Object.entries(ENEMIES))for(const zone of ZONES){
  const {b}=quietNight();b.paused=false;Object.assign(b.fires[0],state);const z=b.zones.find(z=>z.id===zone.id);z.hp=100;
  const e=foe(type,zone.id,{attack:def.interval});b.enemies=[e];stepBattle(b);
  const factor=state.active?(type==='rammer'?.85:.7):1;close(z.hp,100-def.damage*factor);
  assert.equal(enemyFeedback(b,e).heat,state.active);assert.equal(b.events.find(e=>['hit','impact'].includes(e.type)).fireProtected,state.active);
 }
});

test('global warmth gives identical stamina and fear benefits near the hearth and at the back of the yard',()=>{
 for(const state of fireStates)for(const point of [{x:240,y:420},{x:110,y:205}]){
  const {b}=quietNight();b.paused=false;Object.assign(b.fires[0],state);const p=b.people[0];Object.assign(p,point,{nightRole:'guard',stamina:40,fear:30});
  stepBattle(b);close(p.stamina,40+.05*(state.active?2:1.6));close(p.fear,30-(state.active?.05*.04:0));
 }
 const {b}=quietNight();b.fires=[{...b.fires[0],id:'legacy-brazier'}];assert.equal(campfireActive(b),false);
});

test('global fire slows distant climbing and still multiplies mesh protection',()=>{
 for(const state of fireStates)for(const mesh of [false,true]){
  const {b}=quietNight();b.paused=false;Object.assign(b.fires[0],state);b.zones.find(z=>z.id==='backRight').mesh=mesh;
  const e=foe('climber','backRight');b.enemies=[e];stepBattle(b);close(e.progress,.05*(mesh?.35:1)*(state.active?.65:1));
 }
});

test('global fire also reduces house and distant survivor damage after entry',()=>{
 for(const state of fireStates){
  const {b}=quietNight();b.paused=false;Object.assign(b.fires[0],state);const p=b.people[0];Object.assign(p,{x:110,y:205,nightRole:'guard',cooldown:999});
  b.enemies=[foe('walker','gate',{x:240,y:350,mode:'inside'}),foe('rammer','backLeft',{x:p.x,y:p.y,mode:'inside'})];
  stepBattle(b);close(b.house,100-.05*1.8*(state.active?.7:1));close(p.health,100-.05*3*(state.active?.85:1));
 }
});

test('a distant quencher disables global benefits and they return when the wet timer expires',()=>{
 const {b}=quietNight();b.paused=false;const e=foe('quencher','backLeft',{progress:8});b.enemies=[e];
 assert.ok(Math.hypot(e.x-CENTRAL_FIRE.x,e.y-CENTRAL_FIRE.y)>125);stepBattle(b);
 assert.equal(b.fires[0].wet,4);assert.equal(campfireActive(b),false);assert.equal(enemyFeedback(b,e).heat,false);
 assert.equal(b.events.find(e=>e.type==='wet').targetId,'central');b.enemies=[];
 for(let i=0;i<81;i++)stepBattle(b);assert.equal(campfireActive(b),true);
 b.fires[0].wood=.00001;stepBattle(b);assert.equal(campfireActive(b),false);
});
