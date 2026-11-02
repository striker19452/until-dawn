import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,applyCampaignAction as act} from '../src/campaign.js';
import {createBattle,stepBattle} from '../src/battle.js';
import {ENEMIES,ZONES,enemySpeed} from '../src/content.js';
import {BOSSES,BOSS_FORM_SPEED} from '../src/boss-content.js';

const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
function fixture(day=1){let s=act(initialCampaign(53),{type:'chooseRole',role:'repairman'});s.day=day;s.flags.centralFire=false;s.people[0].nightRole='sleep';const b=createBattle(act(s,{type:'prepare'}),'speed',{autoPause:false});b.schedule=[{at:9999,type:'walker',zone:'gate'}];b.challenge=null;b.paused=false;b.zones.forEach(z=>z.hp=100);return b;}
function enemy(type,extra={}){return {id:'speed',type,zone:'right',x:545,y:310,hp:ENEMIES[type].hp,max:ENEMIES[type].hp,mode:'approach',attack:0,progress:0,stun:0,called:false,...extra};}

test('nimble ground species double their movement speed and bulky species keep their pacing',()=>{
 assert.deepEqual(Object.entries(ENEMIES).filter(([,d])=>d.agile).map(([id])=>id),['climber','burrower','skitter']);
 for(const [type,speed] of Object.entries({walker:18,climber:44,rammer:12,caller:16,burrower:34,quencher:15,skitter:66,bastion:15,broodmother:15,cinderwhale:14,twinvein:16})){
  const b=fixture(),e=enemy(type);b.enemies=[e];stepBattle(b,.1);close(545-e.x,speed*.1);close(e.y,310);
 }
});

test('nimble speeds apply on approach and inside the yard, and pause and stun still stop movement',()=>{
 for(const [type,form,speed] of [['climber',{},44],['burrower',{},34],['skitter',{},66],['broodmother',{bossBrood:true},30],['twinvein',{bossForm:1},32],['twinvein',{bossForm:2},32],['twinvein',{bossForm:3},32]]){
  const b=fixture(),e=enemy(type,{...form,mode:'inside',x:315,y:440,targetId:'house',targetPoint:{x:360,y:440}});b.enemies=[e];stepBattle(b,.1);close(Math.hypot(e.x-315,e.y-440),speed*.1);
  Object.assign(e,{mode:'approach',x:545,y:310});b.elapsed=180;stepBattle(b,.1);close(545-e.x,speed*.1);assert.equal(e.mode,'approach');
  b.elapsed=1;e.mode='approach';e.stun=1;const stopped={x:e.x,y:e.y};stepBattle(b,.1);assert.deepEqual({x:e.x,y:e.y},stopped);
  b.paused=true;const frozen=structuredClone(b);stepBattle(b,.1);assert.deepEqual(b,frozen);
 }
});

test('actual brood hatching uses the smaller forms speed without accelerating the mother',()=>{
 const b=fixture(14),def=BOSSES[14];b.schedule=[{at:.05,type:def.id,zone:def.zone}];stepBattle(b);
 const mother=b.enemies.find(e=>e.boss),z=ZONES.find(z=>z.id===mother.zone);Object.assign(mother,{x:z.x,y:z.y,mode:'attack'});
 for(let i=0;i<200&&!b.enemies.some(e=>e.bossBrood);i++)stepBattle(b);
 const brood=b.enemies.find(e=>e.bossBrood);assert.ok(brood);assert.equal(enemySpeed(mother),15);assert.equal(enemySpeed(brood),BOSS_FORM_SPEED.brood);assert.equal(brood.hp,42);
 const before={x:brood.x,y:brood.y};stepBattle(b,.1);close(Math.hypot(brood.x-before.x,brood.y-before.y),3);
});

test('actual split forms retain fast movement after revival while the whole boss stays slow',()=>{
 const b=fixture(28);b.schedule=[{at:.05,type:'twinvein',zone:'gate'}];stepBattle(b);const parent=b.enemies.find(e=>e.boss);assert.equal(enemySpeed(parent),16);
 parent.hp=75;stepBattle(b);assert.equal(b.boss.split,true);
 const twins=b.enemies.filter(e=>e.boss);assert.equal(twins.length,3);assert.ok(twins.every(e=>enemySpeed(e)===32));
 twins[0].hp=0;stepBattle(b);assert.equal(twins[0].bossDormant,true);b.boss.downUntil=b.elapsed;stepBattle(b);
 assert.equal(twins[0].hp,54);assert.equal(enemySpeed(twins[0]),32);assert.equal(enemySpeed(enemy('twinvein')),16);
});
