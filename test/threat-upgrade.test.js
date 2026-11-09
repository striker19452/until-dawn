import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialCampaign,applyCampaignAction as act} from '../src/campaign.js';
import {createBattle,stepBattle} from '../src/battle.js';
import {leaveHouse} from '../src/shelter.js';
import {ENEMIES,ENEMY_WINDUP,ZONES} from '../src/content.js';
import {BOSSES,BOSS_FORM_HEALTH,BOSS_BURST_DAMAGE} from '../src/boss-content.js';
import {bossRenderPoint,bossPose,spriteBodyBounds} from '../client/boss-motion.js';
import {artPoint} from '../src/yard-geometry.js';

function fixture(type,extra={}){
 let s=act(initialCampaign(53),{type:'chooseRole',role:'repairman'});s.day=28;s.flags.centralFire=false;s.people[0].nightRole='sleep';
 const b=createBattle(act(s,{type:'prepare'}),'threat-upgrade',{autoPause:false});b.schedule=[{at:9999,type:'walker',zone:'gate'}];b.challenge=null;b.boss=null;b.paused=false;b.fires=[];b.zones.forEach(z=>z.hp=100);
 const z=ZONES[0],e={id:'attacker',type,zone:z.id,x:z.x,y:z.y,hp:1000,max:1000,mode:'attack',attack:0,progress:0,stun:0,called:false,...extra};b.enemies=[e];return {b,e};
}
const advance=(b,seconds)=>{for(let i=0;i<Math.round(seconds*20);i++)stepBattle(b);};

test('all ordinary species first strike at half the old windup and HUD tracks the same clock',()=>{
 const previous={walker:3.1,climber:3,rammer:8,caller:4,burrower:4,quencher:5};
 for(const [type,old]of Object.entries(previous)){
  const {b}=fixture(type);assert.equal(ENEMIES[type].interval,old/2);
  advance(b,old/2-.05);assert.equal(b.zones[0].hp,100,type);stepBattle(b);
  assert.equal(b.zones[0].hp,100-ENEMIES[type].damage,type);
 }
});

test('climbing, digging, summoning and spraying complete at their configured thresholds',()=>{
 for(const [type,seconds,event]of [['climber',6,'vault'],['burrower',3,'dig'],['caller',3.5,'call'],['quencher',4,'wet']]){
  const {b,e}=fixture(type);if(type==='quencher')b.fires=[{id:'central',x:240,y:390,wood:1,heat:80,wet:0}];
  advance(b,seconds-.05);assert.ok(!b.events.some(e=>e.type===event),type);stepBattle(b);
  assert.ok(b.events.some(e=>e.type===event),type);if(['climber','burrower'].includes(type))assert.equal(e.mode,'inside');
 }
 assert.deepEqual(ENEMY_WINDUP,{climb:6,dig:3,call:3.5,spray:4});
});

test('boss attacks keep their doubled values while twin health receives its additional 50 percent increase',()=>{
 for(const [day,hp,damage]of [[7,114,18],[14,129,3],[21,144,3.5],[28,150,4]]){
  assert.equal(BOSSES[day].hp,hp*2*(day===28?1.5:1));assert.equal(BOSSES[day].damage,damage*2);
 }
 assert.deepEqual(BOSS_FORM_HEALTH,{brood:42,twin:108,revive:54});assert.equal(BOSS_BURST_DAMAGE,24);
 for(const extra of [{boss:true},{bossBrood:true}]){
  const {b,e}=fixture('broodmother',{...extra,mode:'inside',x:240,y:350,targetId:'house',targetPoint:{x:240,y:350}});
  stepBattle(b,.1);assert.ok(Math.abs(b.house-99.64)<1e-8);assert.equal(b.events.find(e=>e.targetId==='house').damageRate,3.6);
  const p=b.people[0];leaveHouse(b,p);Object.assign(p,{nightRole:'guard',x:400,y:400,cooldown:99});Object.assign(e,{x:400,y:400,targetPoint:{x:400,y:400}});const health=p.health;stepBattle(b,.1);assert.ok(Math.abs(health-p.health-(extra.bossBrood?.12:.24))<1e-8);
 }
});

const registration=JSON.parse(readFileSync(new URL('../client/assets/bosses-v1/registration.json',import.meta.url)));
test('large gate bodies remain outside the gate through approach, charge, full roll and recovery',()=>{
 const sheet=registration.bastion,wall=artPoint(ZONES[0]);
 for(const [mode,worldY,phase,elapsed,clock]of [['approach',510,'approach',1,0],['attack',475,'charge',5,4.9],...Array.from({length:25},(_,i)=>['attack',475,'exposed',10+i*.025,7-i*.025]),['attack',475,'exposed',16.9,.1]]){
  const e={id:'boss',type:'bastion',boss:true,zone:'gate',x:240,y:worldY,mode},b={boss:{phase,clock,exposedAt:10},elapsed,events:[]},p=bossRenderPoint(e,artPoint,sheet);
  const pose=bossPose(b,e,elapsed),scale=104/sheet.frames[0].rect[3];
  const sprite={frame:{cutWidth:1381,cutHeight:943},originX:.5,originY:.5,x:p.x+pose.dx,y:p.y-52+pose.dy,scaleX:scale*pose.sx,scaleY:scale*pose.sy,rotation:pose.angle*Math.PI/180};
  const bounds=spriteBodyBounds(sprite,[0,0,1381,943]);assert.ok(bounds.top>=wall.y+1,`${mode}/${phase}/${elapsed}: ${bounds.top}`);
 }
 const e={type:'bastion',mode:'inside',x:240,y:400,zone:'gate'};assert.deepEqual(bossRenderPoint(e,artPoint,sheet),artPoint(e));
});

test('weak point is a persistent overturned pose, reduced motion retains the readable state, and phase exit restores it',()=>{
 const e={id:'boss',type:'bastion',boss:true,zone:'gate',mode:'attack'},b={elapsed:11,boss:{phase:'exposed',clock:6,exposedAt:10},events:[]};
 const pose=bossPose(b,e,11);assert.equal(pose.roll,1);assert.ok(Math.abs(pose.angle-180)<3);assert.deepEqual(bossPose(b,e,11),pose);
 const reduced=bossPose(b,e,11,true);assert.equal(reduced.angle,180);assert.equal(reduced.roll,1);
 b.boss.phase='charge';assert.equal(bossPose(b,e,11).roll,0);
 e.bossDormant=true;assert.equal(bossPose(b,e,11).phase,'dormant');
});
