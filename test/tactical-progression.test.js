import test from 'node:test';
import assert from 'node:assert/strict';
import {tacticalNight} from './support/tactical-night.js';
import {createTestSession} from '../src/test-mode.js';
import {createBattle,stepBattle,battleCommand,inner} from '../src/battle.js';
import {settleNight,applyCampaignAction} from '../src/campaign.js';
import {validateClientResult} from '../src/client-result.js';
import {ENEMIES,ZONES,enemyTypes} from '../src/content.js';
import {PHASE_CREATURES,creatureAfterBoss} from '../src/phase-creatures.js';
import {phaseCreatureDamage} from '../src/phase-creature-combat.js';
import {leaveHouse} from '../src/shelter.js';

function fixture(type,zone='right'){
 const base=createTestSession({day:28,preset:'solo'}).snapshot.state;
 base.flags.centralFire=false;base.people[0].nightRole='sleep';
 const b=createBattle(base,'species-test',{autoPause:false});b.boss=null;b.challenge=null;b.schedule=[{at:9999,type:'walker',zone:'gate'}];b.paused=false;b.fires=[];
 const z=ZONES.find(z=>z.id===zone),e={id:'test',type,zone,x:z.x,y:z.y,hp:ENEMIES[type].hp,max:ENEMIES[type].hp,mode:'attack',attack:0,progress:0,stun:0,called:false};b.enemies=[e];return {base,b,e};
}
const advance=(b,seconds)=>{for(let i=0;i<Math.round(seconds*20)&&!b.finished;i++)stepBattle(b);};

test('all 28 problems have an executable prepared solution across three different invasion seeds',()=>{
 for(const seed of [11,53,97])for(let day=1;day<=28;day++){
  const result=tacticalNight({day,seed});assert.ok(result.finished,`D${day}/${seed} converges`);assert.ok(result.cleared,`D${day}/${seed}: ${result.feedback}`);assert.deepEqual(result.errors,[]);
 }
});
test('identical tactics with high fatigue miss timed objectives that a rested team clears',()=>{
 let fresh=0,tired=0;
 for(const seed of [11,53,97])for(const day of [5,8,12,13,16,17,18,20,22,24,25,27]){
  const a=tacticalNight({day,seed,fatigue:0}),b=tacticalNight({day,seed,fatigue:90});fresh+=Number(a.cleared);tired+=Number(b.cleared);assert.ok(a.finished&&b.finished);
 }
 assert.equal(fresh,36);assert.ok(tired<=26,`fresh ${fresh}, tired ${tired}`);
});
test('a living hero and standing house cannot bypass a missed objective; old reports retain their behavior',()=>{
 const {base,b}=tacticalNight({day:20,policy:'stacked',debug:true});assert.ok(b.house>0&&!b.people[0].dead);assert.equal(b.challenge.status,'missed');
 const result=settleNight(base,b);validateClientResult(base,result);assert.equal(result.phase,'failed');assert.throws(()=>applyCampaignAction(result,{type:'nextDay'}));assert.ok(result.report.challenge.feedback.includes('喷污'));
 const old=structuredClone(b);delete old.challenge.required;const legacy=settleNight(base,old);assert.equal(legacy.phase,'report');validateClientResult(base,legacy);assert.equal(applyCampaignAction(legacy,{type:'nextDay'}).day,21);
});
test('each boss introduces exactly one new live species before clearing, including the final night',()=>{
 for(const day of [7,14,21,28]){
  const type=creatureAfterBoss(day),def=PHASE_CREATURES[type];assert.equal(def.afterBoss,day);assert.ok(!enemyTypes(day).includes(type));assert.ok(enemyTypes(day+1).includes(type));
  const {b}=tacticalNight({day,debug:true});assert.equal(b.finished,true);assert.ok(b.boss.followerReleased);assert.equal(b.seen.filter(id=>id===type).length,1);assert.ok(b.log.some(s=>s.includes('还有一场遭遇')));
 }
});
test('a companion death at dawn invalidates the required goal and remains saveable',()=>{
 const base=createTestSession({day:12}).snapshot.state;Object.assign(base.people[1],{wound:'severe',health:10,deadline:12});
 const b=createBattle(base,'deadline-goal');b.finished=true;b.challenge.status='cleared';
 const result=settleNight(base,b);assert.equal(result.people[1].dead,true);assert.equal(result.report.challenge.status,'missed');assert.equal(result.phase,'failed');validateClientResult(base,result);
});
test('bladebeast jumps intact spikes but mesh buys time; throwing really resets the jump',()=>{
 const a=fixture('bladebeast');a.b.zones[2].spikes=true;advance(a.b,4.5);assert.equal(a.e.mode,'inside');assert.equal(a.b.zones[2].hp>0,true);
 const c=fixture('bladebeast');c.b.zones[2].mesh=true;advance(c.b,4.5);assert.equal(c.e.mode,'attack');assert.ok(c.e.progress<2);
 const {b,e}=fixture('bladebeast');const p=b.people[0];leaveHouse(b,p);Object.assign(p,inner(ZONES[2]),{nightRole:'guard'});e.progress=2;
 battleCommand(b,{type:'throw',person:p.id,target:'right'});advance(b,2.1);assert.ok(b.enemies.find(e=>e.id==='test').progress<.5);assert.ok(b.events.some(e=>e.type==='throw'));assert.equal(b.resources.materials,119);
});
test('separated attack angles break crab armor while same-side piling does not; throws support a solo answer',()=>{
 const {b,e}=fixture('shellcrab');assert.equal(phaseCreatureDamage(b,e,10,'strike',{x:e.x-20,y:e.y}),3);
 assert.equal(phaseCreatureDamage(b,e,10,'strike',{x:e.x-30,y:e.y+5}),3);
 assert.equal(phaseCreatureDamage(b,e,10,'strike',{x:e.x,y:e.y+25}),10);
 b.elapsed=6;assert.equal(phaseCreatureDamage(b,e,18,'trap'),18);assert.equal(phaseCreatureDamage(b,e,10,'throw'),10);assert.equal(phaseCreatureDamage(b,e,10,'strike'),10);
});
test('spore pulses affect only nearby outdoor people and freeze with pause',()=>{
 const {b,e}=fixture('sporetoad');const p=b.people[0];leaveHouse(b,p);Object.assign(p,{nightRole:'sleep',x:e.x-20,y:e.y,task:{type:'move',target:{x:e.x-20,y:e.y},stage:'work',progress:0,reserved:{}},stamina:80,cooldown:100});e.progress=4.95;
 stepBattle(b);assert.ok(p.stamina<63);assert.ok(p.fear>5);assert.ok(b.events.some(e=>e.type==='spores'));
 b.paused=true;const frozen=structuredClone(b);advance(b,10);assert.deepEqual(b,frozen);
});
test('the mantis changes front once and follows the outer perimeter instead of teleporting through walls',()=>{
 const {b,e}=fixture('echomantis');e.hp=e.max/2;const before={x:e.x,y:e.y};stepBattle(b);assert.equal(e.echoShifted,true);assert.notEqual(e.zone,'right');assert.equal(e.mode,'approach');assert.ok(Math.hypot(e.x-before.x,e.y-before.y)<=48*.05+.01);const zone=e.zone;advance(b,12);assert.equal(e.zone,zone);assert.equal(b.events.filter(e=>e.type==='weakpoint').length,1,'the mantis only changes fronts once');
});
test('a drained cinderwhale enters an existing breach and the night cannot stall at a destroyed wall',()=>{
 const base=createTestSession({day:21,preset:'solo'}).snapshot.state;const b=createBattle(base,'drained',{autoPause:false});b.paused=false;b.fires=[];b.people[0].nightRole='sleep';b.schedule=[{at:.05,type:'cinderwhale',zone:'left',challenge:true}];stepBattle(b);const e=b.enemies[0];Object.assign(e,{mode:'attack',x:70,y:310});b.zones[1].hp=0;stepBattle(b);assert.equal(e.mode,'inside');
});
