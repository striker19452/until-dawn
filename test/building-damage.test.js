import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,applyCampaignAction,settleNight,normalizeCampaign,makePerson} from '../src/campaign.js';
import {createBattle,stepBattle} from '../src/battle.js';
import {BUILDINGS,ENEMIES} from '../src/content.js';
import {buildingHealth} from '../src/building-health.js';
import {facility,needs,watchtowerRange} from '../src/rules.js';
import {PLOTS} from '../src/yard-geometry.js';
import {validateClientResult} from '../src/client-result.js';

function fixture(types=['garden','water','workshop','generator','infirmary','watchtower'],seed=53){
 let s=applyCampaignAction(initialCampaign(seed),{type:'chooseRole',role:'repairman'});
 s.buildings=types.map((type,i)=>({id:'b'+i,type,level:1,branch:'normal',age:0,enabled:true,hp:10}));
 s.resources={food:100,water:100,materials:100,fuel:100,medicine:10,parts:10};s.flags.centralFire=false;s.people[0].nightRole='sleep';
 const base=applyCampaignAction(s,{type:'prepare'}),b=createBattle(base,'damage',{autoPause:false});b.schedule=[{at:9999,type:'walker',zone:'gate'}];b.challenge=null;b.paused=false;
 return {s,base,b};
}
function enemy(id='intruder',extra={}){return {id,type:'walker',zone:'gate',x:240,y:468,hp:ENEMIES.walker.hp,max:ENEMIES.walker.hp,mode:'inside',stun:0,attack:0,progress:0,...extra};}
const advance=(b,n)=>{for(let i=0;i<n;i++)stepBattle(b,.05);};

test('regular buildings start with 10 durability; legacy saves normalize without reviving ruins',()=>{
 const s=applyCampaignAction(initialCampaign(1),{type:'chooseRole',role:'repairman'}),built=applyCampaignAction(s,{type:'build',building:'garden'});assert.equal(built.buildings[0].hp,10);
 delete built.buildings[0].hp;const before=structuredClone(built);const normalized=normalizeCampaign(structuredClone(built));assert.equal(normalized.buildings[0].hp,10);assert.deepEqual(built,before);
 normalized.buildings[0].hp=0;normalizeCampaign(normalized);assert.equal(normalized.buildings[0].hp,0);
});

test('watchtowers build, repair and rebuild to 50 and migrate legacy durability only once',()=>{
 const {s}=fixture(['watchtower']);
 const legacy=s.buildings[0];legacy.hp=6;
 const migrated=normalizeCampaign(structuredClone(s));assert.equal(migrated.buildings[0].hp,30);
 const repaired=applyCampaignAction(migrated,{type:'repairBuilding',id:legacy.id});assert.equal(repaired.buildings[0].hp,50);
 const ready=applyCampaignAction(repaired,{type:'prepare'}),battle=createBattle(ready,'tower-health');
 battle.buildings[0].hp=7;
 const result=settleNight(ready,battle);validateClientResult(ready,result);
 assert.equal(normalizeCampaign(result).buildings[0].hp,7);
 assert.ok(result.report.events.some(line=>line.includes('7/50')));
 const oldResult=structuredClone(result);delete oldResult.buildings[0].maxHp;oldResult.buildings[0].hp=7;
 assert.equal(validateClientResult(ready,oldResult).buildings[0].hp,35);
 const invalid=structuredClone(result);invalid.buildings[0].hp=51;
 assert.throws(()=>validateClientResult(ready,invalid),/设施耐久无效/);
 legacy.hp=0;assert.equal(normalizeCampaign(structuredClone(s)).buildings[0].hp,0);
 const rebuilt=applyCampaignAction(s,{type:'rebuildBuilding',id:legacy.id,building:'watchtower'});assert.equal(rebuilt.buildings[0].hp,50);
 s.buildings=[];
 const built=applyCampaignAction(s,{type:'build',building:'watchtower'});assert.equal(built.buildings[0].hp,50);
});

test('intruders prefer an operational upgraded watchtower when choosing a structure',()=>{
 for(const branch of ['yield','steady']){
  const {b}=fixture(['garden','watchtower']),tower=b.buildings[1],e=enemy();
  Object.assign(tower,{level:2,branch});b.enemies=[e];b.rng=1;
  stepBattle(b);assert.equal(e.targetId,tower.id);assert.equal(b.house,100);
  Object.assign(e,e.targetPoint);tower.hp=.01;
  stepBattle(b);assert.equal(tower.hp,0);
  stepBattle(b);assert.notEqual(e.targetId,tower.id);
 }
});

test('seeded intruders choose both house and facilities, commit while walking, pause freezes targets and damage',()=>{
 const targets=new Set();
 for(let seed=1;seed<=35;seed++){
  const {b}=fixture(undefined,seed),e=enemy();b.enemies=[e];stepBattle(b);targets.add(e.targetId);
  const target=e.targetId,health=b.buildings.map(buildingHealth);advance(b,10);assert.equal(e.targetId,target);assert.deepEqual(b.buildings.map(buildingHealth),health,'no remote damage while walking');
  b.paused=true;const frozen=structuredClone(b);stepBattle(b);assert.deepEqual(b,frozen);
  const repeat=fixture(undefined,seed).b;repeat.enemies=[enemy()];stepBattle(repeat);assert.equal(repeat.enemies[0].targetId,target);
 }
 assert.deepEqual([...targets].sort(),['house','b0','b1','b2','b3','b4','b5'].sort());
});

test('every plot is reachable, damage stacks at 1.8/sec, zero creates a ruin and retargets',()=>{
 for(let i=0;i<6;i++){
  const {b}=fixture(),e=enemy('one',{targetId:'b'+i,targetName:BUILDINGS[b.buildings[i].type].name,targetPoint:PLOTS[i]});b.enemies=[e];
  // An actual first selection computes the reachable edge, rather than walking through buildings.
  delete e.targetId;for(let seed=1;seed<100;seed++){b.rng=seed*1000000;stepBattle(b);if(e.targetId==='b'+i)break;delete e.targetId;}
  assert.equal(e.targetId,'b'+i);const house=b.house,startingHp=b.buildings[i].hp;let ticks=0;while(b.buildings[i].hp===startingHp&&ticks++<2000)stepBattle(b);
  assert.ok(ticks<2000,`plot ${i} must be reachable`);assert.equal(b.house,house);
  const before=b.buildings[i].hp;advance(b,20);assert.ok(Math.abs(b.buildings[i].hp-(before-1.8))<1e-7);
  b.buildings[i].hp=.01;stepBattle(b);assert.equal(b.buildings[i].hp,0);assert.ok(b.events.some(v=>v.type==='destroyed'&&v.targetId==='b'+i));stepBattle(b);assert.notEqual(e.targetId,'b'+i);assert.equal(b.buildings[i].hp,0);
 }
 const {b}=fixture(['garden']);const point={x:110,y:360};b.enemies=[enemy('one',{...point,targetId:'b0',targetPoint:point}),enemy('two',{...point,targetId:'b0',targetPoint:point})];advance(b,20);assert.ok(Math.abs(b.buildings[0].hp-6.4)<1e-8);
});

test('global fire protects facilities by the same species multiplier, with no effect when weak or wet',()=>{
 for(const type of ['walker','rammer'])for(const state of [{heat:60,wet:0,factor:type==='rammer'?.85:.7},{heat:15,wet:0,factor:1},{heat:60,wet:4,factor:1}]){
  const {b}=fixture(['water']),point={x:110,y:360};b.fires=[{id:'central',heat:state.heat,wet:state.wet,wood:1}];b.enemies=[enemy(type,{type,...point,targetId:'b0',targetPoint:point})];stepBattle(b);assert.ok(Math.abs(b.buildings[0].hp-(10-.05*1.8*state.factor))<1e-9);
 }
});

test('ruins stop production, garden work, medicine recipes, stove savings, watchtower and other branch benefits',()=>{
 const {s}=fixture(['garden','water','generator','infirmary','stove','exchange']);s.buildings.forEach(b=>{b.hp=0;b.branch='yield';b.level=2;});s.people[0].health=60;s.people.push(makePerson('lin','林禾','种植员','survival'));s.people[1].job='farm';
 const prepared=applyCampaignAction(s,{type:'prepare'});assert.deepEqual(prepared.resources,s.resources);assert.equal(prepared.buildings[0].age,0);assert.equal(prepared.people[0].health,60);assert.equal(needs(prepared).food,3);
 for(const type of ['garden','water','generator','infirmary','stove','exchange'])assert.equal(facility(prepared,type),undefined);
 assert.equal(watchtowerRange({type:'watchtower',branch:'yield',hp:0},'fog'),0);
 assert.throws(()=>applyCampaignAction(s,{type:'craft',item:'medicine'}));assert.throws(()=>applyCampaignAction(s,{type:'trade',offer:'materials'}));assert.throws(()=>applyCampaignAction(s,{type:'toggleGenerator'}));
});

test('durability saves without changing upgrades, old browser results retain prepared durability, forged edits fail',()=>{
 const {base,b}=fixture();b.buildings[0].hp=0;b.buildings[1].hp=4.5;const result=settleNight(base,b);validateClientResult(base,result);assert.equal(result.buildings[0].hp,0);assert.equal(result.buildings[1].hp,4.5);assert.equal(base.buildings[0].hp,10);assert.ok(result.report.events.some(s=>s.includes('已损毁')));
 for(const mutate of [s=>s.buildings[0].hp=-1,s=>s.buildings[0].hp=11,s=>s.buildings[0].hp=NaN,s=>s.buildings[0].hp=null,s=>s.buildings[0].level++,s=>s.buildings[0].branch='yield',s=>s.buildings[0].enabled=false,s=>s.buildings[0].extra=true,s=>s.buildings.reverse(),s=>s.buildings.pop()]){const corrupt=structuredClone(result);mutate(corrupt);assert.throws(()=>validateClientResult(base,corrupt));}
 base.buildings[1].hp=3;const legacy=settleNight(base,createBattle(base,'old'));legacy.buildings.forEach(b=>delete b.hp);validateClientResult(base,legacy);assert.equal(legacy.buildings[1].hp,3);
});

test('repair costs 1 AP and 2 materials for surviving buildings; ruins require rebuilding and still occupy slots',()=>{
 const {s}=fixture(['water']);Object.assign(s.buildings[0],{hp:4,level:2,branch:'steady'});const fixed=applyCampaignAction(s,{type:'repairBuilding',id:'b0'});assert.equal(fixed.ap,s.ap-1);assert.equal(fixed.resources.materials,s.resources.materials-2);assert.deepEqual(fixed.buildings[0],{...s.buildings[0],plot:0,hp:10});assert.equal(s.buildings[0].hp,4);assert.throws(()=>applyCampaignAction(fixed,{type:'repairBuilding',id:'b0'}),/已经完好/);
 s.buildings[0].hp=0;assert.throws(()=>applyCampaignAction(s,{type:'repairBuilding',id:'b0'}),/需要原址重建/);const ready=applyCampaignAction(s,{type:'prepare'}),back=applyCampaignAction(ready,{type:'backDay'});assert.equal(back.buildings[0].hp,0);assert.deepEqual(back.resources,s.resources);
 const full=fixture().s;full.buildings.forEach(b=>b.hp=0);assert.throws(()=>applyCampaignAction(full,{type:'build',building:'water'}),/位置已满/);
 const demolished=applyCampaignAction(s,{type:'demolish',id:'b0'});assert.equal(demolished.resources.materials,s.resources.materials);assert.equal(demolished.buildings.length,0);
});
