import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,applyCampaignAction as act,makePerson,settleNight} from '../src/campaign.js';
import {createBattle,stepBattle,battleCommand} from '../src/battle.js';
import {approachCombat,COMBAT_DISTANCE} from '../src/combat-spacing.js';
import {nearestWalkablePoint,walkablePoint} from '../src/movement.js';
import {validateClientResult} from '../src/client-result.js';
import {ZONES} from '../src/content.js';
import {isIndoors} from '../src/shelter.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function fixture(){const s=act(initialCampaign(53),{type:'chooseRole',role:'watchman'});s.flags.centralFire=false;const base=act(s,{type:'prepare'}),b=createBattle(base,'spacing',{autoPause:false});b.schedule=[{at:9999,type:'walker',zone:'gate'}];b.challenge=null;b.fires=[];b.paused=false;Object.assign(b.people[0],{x:140,y:400,fear:0});return {base,b,p:b.people[0]};}
const foe=(extra={})=>({id:'foe',type:'walker',zone:'gate',x:220,y:400,hp:1000,max:1000,mode:'attack',attack:0,progress:0,stun:999,...extra});
const run=(b,n)=>{for(let i=0;i<n;i++)stepBattle(b,.05);};

test('patrol and drive orders stop within striking distance instead of walking into the creature',()=>{
 for(const manual of [false,true]){const {b,p}=fixture();b.enemies=[foe()];if(manual)battleCommand(b,{type:'guard',person:'hero',target:'gate'});run(b,140);const actor=b.people[0],e=b.enemies[0],point={x:actor.x,y:actor.y};assert.ok(distance(actor,e)>=36&&distance(actor,e)<=46);assert.ok(e.hp<1000);assert.ok(b.events.filter(e=>e.type==='attack').every(e=>distance(e,e.source)<=50));run(b,30);assert.deepEqual({x:actor.x,y:actor.y},point,'a settled stance must not orbit or jitter');assert.ok(walkablePoint(actor,b.walkMap));}
});

test('an overlapping intruder still deals contact damage, while the guard takes bounded steps back and keeps fighting',()=>{
 const {b,p}=fixture();Object.assign(p,{x:380,y:410,zone:'right'});const e=foe({zone:'right',x:p.x,y:p.y,mode:'inside',stun:0,targetId:'house',targetPoint:{x:p.x,y:p.y}});b.enemies=[e];let last={x:p.x,y:p.y};for(let i=0;i<80;i++){stepBattle(b,.05);assert.ok(distance(p,last)<2.5,'spacing cannot teleport');last={x:p.x,y:p.y};assert.ok(walkablePoint(p,b.walkMap));}assert.ok(p.health<100&&p.health>20);assert.ok(distance(p,e)>=36&&distance(p,e)<=46);assert.ok(e.hp<1000);assert.equal(p.wound,'none');
});

test('several guards fan out without changing a shared creature position or pushing each other through the yard',()=>{
 const {b,p}=fixture();Object.assign(p,{x:380,y:410,cooldown:100,zone:'right'});for(const id of ['lin','chen']){const q=makePerson(id,id,'幸存者','guard');Object.assign(q,{x:p.x,y:p.y,cooldown:100,zone:'right'});b.people.push(q);b.work[id]=0;}const e=foe({zone:'right',x:p.x,y:p.y});b.enemies=[e];run(b,180);assert.deepEqual({x:e.x,y:e.y},{x:380,y:410});for(const actor of b.people){assert.ok(distance(actor,e)>=36&&distance(actor,e)<=46);assert.ok(walkablePoint(actor,b.walkMap));}for(let i=0;i<b.people.length;i++)for(let j=i+1;j<b.people.length;j++)assert.ok(distance(b.people[i],b.people[j])>=18);assert.equal(COMBAT_DISTANCE,42);
});

test('combat placement respects every fence, the house, fire and facilities',()=>{
 for(const zone of ZONES){const {b,p}=fixture();const e=foe({zone:zone.id,x:zone.x,y:zone.y});b.enemies=[e];p.zone=zone.id;Object.assign(p,nearestWalkablePoint({x:240,y:350},b.walkMap));for(let i=0;i<350;i++){stepBattle(b,.05);assert.ok(walkablePoint(p,b.walkMap),zone.id);}assert.ok(distance(p,e)>30,zone.id);assert.ok(distance(p,e)<=50,zone.id);}
 const {b,p}=fixture();b.enemies=[foe({x:240,y:245})];for(let i=0;i<300;i++){approachCombat(b,p,b.enemies[0],43,.05);assert.ok(walkablePoint(p,b.walkMap));}assert.ok(distance(p,b.enemies[0])>20,'a blocked ring cannot pull a person into the house');
});

test('tracking a moving target keeps the guard within actual 50-range, and pause freezes spacing',()=>{
 const {b,p}=fixture();b.enemies=[foe()];run(b,80);const e=b.enemies[0];for(let i=0;i<100;i++){e.x+=.15;stepBattle(b,.05);assert.ok(distance(p,e)>=34);assert.ok(distance(p,e)<=50);}b.paused=true;const frozen=structuredClone(b);run(b,20);assert.deepEqual(b,frozen);
});

test('manual holds, productive work, severe wounds and saved results retain their original rules',()=>{
 const {base,b}=fixture();battleCommand(b,{type:'move',person:'hero',target:{x:350,y:410}});run(b,200);const p=b.people[0],point={x:p.x,y:p.y};b.enemies=[foe({x:p.x+10,y:p.y})];run(b,20);assert.deepEqual({x:p.x,y:p.y},point);assert.ok(b.enemies[0].hp<1000);
 const severe=fixture().b;Object.assign(severe.people[0],{wound:'severe',health:18,x:250,y:350});run(severe,80);assert.ok(isIndoors(severe,severe.people[0]));
 const result=settleNight(base,b);validateClientResult(base,result);assert.equal(result.people[0].combatTarget,undefined);assert.equal(result.people[0].x,undefined);
});
