import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,applyCampaignAction} from '../src/campaign.js';
import {createBattle,stepBattle,battleCommand,inner} from '../src/battle.js';
import {BOSSES,BOSS_FORM_HEALTH} from '../src/boss-content.js';
import {ENEMIES,ZONES} from '../src/content.js';
import {leaveHouse} from '../src/shelter.js';
import {skillInfo} from '../client/skills.js';

function fixture(day=1){
 let state=applyCampaignAction(initialCampaign(53),{type:'chooseRole',role:'watchman'});state.day=day;state.flags.centralFire=false;state.resources.materials=100;
 const b=createBattle(applyCampaignAction(state,{type:'prepare'}),'strike',{autoPause:false});b.people[0].fear=0;b.schedule=[{at:9999,type:'walker',zone:'gate'}];b.challenge=null;b.paused=false;
 return {b,p:b.people[0]};
}
const enemy=(type='walker',extra={})=>({id:'foe',type,zone:'gate',x:ZONES[0].x,y:ZONES[0].y,hp:ENEMIES[type].hp,max:ENEMIES[type].hp,mode:'attack',attack:0,progress:0,stun:0,...extra});
function bossFixture(day){
 const {b,p}=fixture(day),def=BOSSES[day];p.nightRole='sleep';b.schedule=[{at:.05,type:def.id,zone:def.zone}];stepBattle(b);
 b.schedule=[{at:9999,type:'walker',zone:'gate'}];const e=b.enemies.find(e=>e.boss),z=ZONES.find(z=>z.id===e.zone);Object.assign(e,{x:z.x,y:z.y,mode:'attack'});
 return {b,p,e};
}
function readyActor(b,p,e){leaveHouse(b,p);Object.assign(p,inner(ZONES.find(z=>z.id===e.zone)),{zone:e.zone,nightRole:'guard',cooldown:0});}

test('patrol, explicit guard and stationary move orders share the inclusive 50-distance attack limit',()=>{
 for(const mode of ['patrol','guard','move'])for(const range of [49.99,50,50.01,81]){
  const {b,p}=fixture();b.enemies=[enemy('walker',{x:p.x+range,y:p.y})];
  if(mode==='guard')battleCommand(b,{type:'guard',person:p.id,target:'gate'});
  if(mode==='move')battleCommand(b,{type:'move',person:p.id,target:{x:p.x,y:p.y}});
  const e=b.enemies[0];stepBattle(b);const hits=b.events.filter(e=>e.type==='attack');assert.equal(hits.length,range<=50?1:0,`${mode} at ${range}`);
  assert.equal(e.hp,ENEMIES.walker.hp-(range<=50?13:0));
  if(hits.length)assert.ok(Math.hypot(hits[0].source.x-e.x,hits[0].source.y-e.y)<=50);
 }
});

test('ordinary strikes preserve windup and only stun ordinary species and brood offspring for 0.5 seconds',()=>{
 for(const type of ['walker','skitter','climber','rammer','caller','burrower','quencher','bladebeast','shellcrab','sporetoad','echomantis','broodmother']){
  const {b,p}=fixture();const e=enemy(type,{x:p.x+40,y:p.y,hp:1000,max:1000,...(type==='broodmother'?{bossBrood:true}:{}),progress:1});b.enemies=[e];
  const stamina=p.stamina;stepBattle(b);assert.equal(e.stun,.5,type);assert.ok(e.hp<e.max);assert.equal(p.stamina,stamina-7);assert.equal(p.cooldown,1.8);assert.equal(b.work.hero,2);
  const windsUp=['climber','caller','burrower','quencher','bladebeast','sporetoad'].includes(type);assert.equal(e.progress,windsUp?1.05:1,type);
  p.nightRole='sleep';const attack=e.attack,progress=e.progress;for(let tick=0;tick<9;tick++)stepBattle(b);assert.equal(e.attack,attack,type);assert.equal(e.progress,progress,type);
  stepBattle(b);assert.equal(e.stun,0,type);assert.ok(e.attack>attack,type);assert.equal(e.progress,windsUp?progress+.05:progress,type);
 }
});

test('a caller completes its accumulated windup despite repeated ordinary attacks',()=>{
 const {b,p}=fixture(),e=enemy('caller',{x:p.x+40,y:p.y,hp:1000,max:1000,progress:1});b.enemies=[e];
 for(let i=0;i<70&&!e.called;i++)stepBattle(b);
 assert.ok(b.events.filter(v=>v.type==='attack'&&v.enemyId===e.id).length>=2);assert.equal(e.called,true);assert.equal(b.reinforcements,1);
});

test('throwing and triggered traps reset ordinary windups and attack timers',()=>{
 for(const type of ['climber','rammer','caller','burrower','quencher','bladebeast','sporetoad'])for(const counter of ['throw','trap']){
  const {b,p}=fixture(),e=enemy(type,{progress:1,attack:1});p.nightRole='sleep';b.enemies=[e];
  if(counter==='throw'){
   battleCommand(b,{type:'throw',person:p.id,target:'gate'});b.people[0].task.stage='work';b.people[0].task.progress=100;
  }else{b.zones[0].traps=1;e.mode='approach';}
  stepBattle(b);const actual=b.enemies.find(v=>v.id===e.id);
  assert.equal(actual.progress,0,`${type} ${counter}`);assert.equal(actual.attack,0,`${type} ${counter}`);assert.equal(actual.stun,2,`${type} ${counter}`);
  assert.ok(b.events.some(v=>v.type===counter));if(counter==='trap')assert.equal(b.zones[0].traps,0);
 }
});

test('ordinary strikes preserve a longer trap stun rather than reducing it to 0.5 seconds',()=>{
 const {b,p}=fixture();const e=enemy('walker',{x:p.x+40,y:p.y,stun:2});b.enemies=[e];stepBattle(b);
 assert.equal(e.stun,1.95);assert.equal(e.hp,ENEMIES.walker.hp-13);
});

test('all four real bosses take ordinary damage without any new ordinary-attack stun',()=>{
 for(const day of [7,14,21,28])for(const existingStun of [0,.1,2]){
  const {b,p,e}=bossFixture(day);readyActor(b,p,e);e.stun=existingStun;
  const hp=e.hp;stepBattle(b);assert.ok(e.hp<hp,`day ${day}`);assert.equal(e.stun,Math.max(0,existingStun-.05),`day ${day}, prior stun ${existingStun}`);
 }
});

test('both real split bodies and a revived twin retain boss immunity to ordinary-attack stun',()=>{
 for(const form of [1,2]){
  const {b,p,e}=bossFixture(28);e.hp=BOSSES[28].hp/2;stepBattle(b);const twin=b.enemies.find(e=>e.bossForm===form);assert.ok(twin.boss);
  twin.stun=0;readyActor(b,p,twin);stepBattle(b);assert.equal(twin.hp,BOSS_FORM_HEALTH.twin-13);assert.equal(twin.stun,0);
 }
 const {b,p,e}=bossFixture(28);e.hp=BOSSES[28].hp/2;stepBattle(b);e.hp=0;stepBattle(b);
 for(let i=0;i<245;i++)stepBattle(b);assert.equal(b.boss.revives,1);assert.equal(e.hp,BOSS_FORM_HEALTH.revive);assert.ok(e.boss);
 e.stun=0;readyActor(b,p,e);stepBattle(b);assert.equal(e.hp,BOSS_FORM_HEALTH.revive-13);assert.equal(e.stun,0);
});

test('a real throw and a real trap still interrupt and stun a boss, surviving a follow-up ordinary strike',()=>{
 for(const counter of ['throw','trap']){
  let {b,p,e}=bossFixture(7);readyActor(b,p,e);
  if(counter==='throw'){
   battleCommand(b,{type:'throw',person:p.id,target:e.zone});p=b.people[0];e=b.enemies.find(e=>e.boss);for(let i=0;i<40;i++)stepBattle(b);
  }else{p.nightRole='sleep';b.zones[0].traps=1;e.mode='approach';stepBattle(b);}
  assert.equal(b.boss.phase,'exposed');assert.equal(e.stun,2);assert.ok(b.events.some(event=>event.type===counter));
  readyActor(b,p,e);const hp=e.hp;stepBattle(b);assert.ok(e.hp<hp);assert.equal(e.stun,1.95);
 }
});

test('guard skill help exposes the actual range, short stun, preserved windup and boss immunity',()=>{
 const {p}=fixture(),info=skillInfo(p,'guard');assert.match(info.note,/攻击距离50/);assert.match(info.note,/0\.5秒/);assert.match(info.note,/不削减蓄力进度/);assert.match(info.note,/首领及双脉分裂体免疫/);assert.match(info.note,/重击、陷阱/);
});
