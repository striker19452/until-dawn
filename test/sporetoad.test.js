import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestSession} from '../src/test-mode.js';
import {createBattle,stepBattle,event,battleCommand} from '../src/battle.js';
import {stepSporeAbility} from '../src/phase-creature-combat.js';
import {PHASE_CREATURE_RULES as R} from '../src/phase-creatures.js';
import {windupInfo,planInterrupt} from '../src/interrupt.js';
import {leaveHouse,enterHouse} from '../src/shelter.js';
import {ZONES} from '../src/content.js';
import {sporeVictimFeedback,enemyFeedback} from '../client/combat-feedback.js';
import {phaseCreaturePose} from '../client/phase-creature-motion.js';
import {tacticalOpportunities} from '../client/tactics.js';

function fixture(mode='inside'){
 const state=createTestSession({day:22}).snapshot.state;state.people.forEach(p=>p.nightRole='sleep');
 const b=createBattle(state,'spore-regression',{autoPause:false});Object.assign(b,{paused:false,boss:null,challenge:null,fires:[],schedule:[{at:9999,type:'walker',zone:'gate'}]});
 b.zones.forEach(z=>Object.assign(z,{traps:0,spikes:false}));
 const e={id:'toad',type:'sporetoad',zone:'gate',x:240,y:430,hp:1000,max:1000,mode,progress:0,attack:0,stun:0};b.enemies=[e];return {b,e};
}
test('spores continue every five seconds inside the yard, including challenge counts',()=>{
 for(const mode of ['attack','inside']){
  const {b,e}=fixture(mode);if(mode==='attack')Object.assign(e,ZONES[0]);
  b.challenge={goal:'control',sporeBursts:0,starts:9999};
  for(let i=0;i<205;i++)stepBattle(b,.05);
  const bursts=b.events.filter(v=>v.type==='spores');assert.equal(bursts.length,2,mode);assert.ok(Math.abs(bursts[0].time-5)<1e-8);assert.ok(Math.abs(bursts[1].time-10)<1e-8);assert.equal(b.challenge.sporeBursts,2);
 }
});
test('entering an already broken wall or breaking it this tick never drops or doubles a spore tick',()=>{
 for(const broken of [true,false]){
  const {b,e}=fixture('attack');Object.assign(e,ZONES[0],{progress:4.9,attack:2.35});b.zones[0].hp=broken?0:.1;
  stepBattle(b,.1);assert.equal(e.mode,'inside');assert.equal(b.events.filter(v=>v.type==='spores').length,1);assert.equal(e.progress,0);
  stepBattle(b,.1);assert.equal(e.progress,.1);assert.equal(b.events.filter(v=>v.type==='spores').length,1);
 }
});
test('spores apply real capped stamina/fear changes only to living outdoor people within range, never health',()=>{
 const {b,e}=fixture();const [near,edge,far,indoor,dead]=b.people;
 for(const p of b.people){leaveHouse(b,p);Object.assign(p,{x:e.x+10,y:e.y,stamina:80,fear:20,health:100});}
 Object.assign(edge,{x:e.x+R.sporeRadius,stamina:3,fear:99});far.x=e.x+R.sporeRadius+.001;enterHouse(b,indoor);dead.dead=true;dead.health=0;
 e.progress=4.95;stepSporeAbility(b,e,.05,event);const burst=b.events.at(-1);
 assert.deepEqual(burst.people,[near.id,edge.id]);assert.equal(near.stamina,62);assert.equal(near.fear,26);assert.equal(near.health,100);
 assert.equal(edge.stamina,0);assert.equal(edge.fear,100);assert.equal(edge.health,100);assert.deepEqual(burst.targets.map(t=>[t.staminaLoss,t.fearGain]),[[18,6],[3,1]]);
 for(const p of [far,indoor,dead]){assert.equal(p.stamina,80);assert.equal(p.fear,20);}
});
test('approach, retreat, pause, stun and death cannot build or release spores',()=>{
 for(const patch of [{mode:'approach'},{mode:'retreat'},{stun:1},{hp:0}]){
  const {b,e}=fixture();Object.assign(e,{progress:4.95},patch);stepSporeAbility(b,e,.1,event);assert.equal(e.progress,4.95);assert.equal(b.events.length,0);
 }
 const {b,e}=fixture();e.progress=4.95;b.paused=true;const frozen=structuredClone(b);stepBattle(b,.1);stepSporeAbility(b,e,.1,event);assert.deepEqual(b,frozen);
 b.paused=false;e.stun=2;stepBattle(b,.1);assert.equal(e.progress,4.95);assert.equal(b.events.length,0);
});
test('an inside toad remains a real interrupt target, and a completed heavy strike resets its spores',()=>{
 const {b,e}=fixture(),p=b.people[0];leaveHouse(b,p);Object.assign(p,{x:e.x-20,y:e.y,nightRole:'guard',cooldown:100,stamina:100});e.progress=3;
 assert.equal(windupInfo(b,e).left,2);assert.equal(planInterrupt(b,e.id).allowed,true);
 assert.ok(tacticalOpportunities(b).some(o=>o.actions.some(a=>a.label==='打断孢雾')));
 battleCommand(b,{type:'heavy',person:p.id,target:e.zone,enemyId:e.id});b.people[0].task.stage='work';b.people[0].task.progress=100;stepBattle(b,.05);
 assert.ok(b.events.some(v=>v.type==='heavy'));assert.equal(b.enemies[0].progress,0);assert.ok(b.enemies[0].stun>0);assert.equal(b.events.some(v=>v.type==='spores'),false);
});
test('inside charging has an honest progress cue and matching inflation pose',()=>{
 const {b,e}=fixture();e.progress=4;assert.equal(enemyFeedback(b,e).progress,.8);assert.match(enemyFeedback(b,e).label,/院内蓄雾/);assert.equal(phaseCreaturePose(b,e,b.elapsed).phase,'inflate');assert.equal(phaseCreaturePose(b,e,b.elapsed).charge,.8);
});
test('victim readouts aggregate simultaneous clouds, show actual caps, expire and tolerate old event data',()=>{
 const events=[{type:'spores',time:10,targets:[{id:'hero',x:1,y:2,staminaLoss:3,fearGain:1},{id:'lin',x:3,y:4,staminaLoss:18,fearGain:6}]},{type:'spores',time:10.1,targets:[{id:'hero',x:1,y:2,staminaLoss:2,fearGain:0}]}],before=structuredClone(events);
 const hits=sporeVictimFeedback(events,10.2);assert.equal(hits.length,2);assert.equal(hits[0].text,'体力 −5\n恐惧 +1');assert.equal(hits[1].text,'体力 −18\n恐惧 +6');assert.deepEqual(events,before);
 assert.deepEqual(sporeVictimFeedback(events,12),[]);assert.deepEqual(sporeVictimFeedback(events,9),[]);
 assert.equal(sporeVictimFeedback([{type:'spores',time:10,targets:[{id:'hero',x:1,y:2}]}],10).at(0).text,'孢雾命中');
});
