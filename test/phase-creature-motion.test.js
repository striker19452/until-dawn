import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestSession} from '../src/test-mode.js';
import {createBattle,stepBattle,battleCommand,event,inner} from '../src/battle.js';
import {ENEMIES,ZONES} from '../src/content.js';
import {leapFrame} from '../src/creature-leap.js';
import {phaseCreatureDamage} from '../src/phase-creature-combat.js';
import {phaseCreaturePose} from '../client/phase-creature-motion.js';
import {phaseCreatureJoints,PHASE_PARTS} from '../client/phase-creature-rig.js';
import {bossPose} from '../client/boss-motion.js';
import {walkablePoint} from '../src/movement.js';
import {leaveHouse} from '../src/shelter.js';

function fixture(type,zone='gate'){
 const base=createTestSession({day:22,preset:'solo'}).snapshot.state;base.people[0].nightRole='sleep';
 const b=createBattle(base,'creature-motion',{autoPause:false});Object.assign(b,{paused:false,boss:null,challenge:null,schedule:[{at:9999,type:'walker',zone:'gate'}]});
 const z=ZONES.find(z=>z.id===zone),e={id:'creature',type,zone,x:z.x,y:z.y,hp:1000,max:1000,mode:'attack',progress:0,attack:0,stun:0,called:false};b.enemies=[e];return {b,e,z};
}
const advance=(b,seconds)=>{for(let i=0;i<Math.round(seconds*20);i++)stepBattle(b);};

test('all five walls support crouch, airborne clearance and landing within the original 4.5-second windup',()=>{
 for(const z of ZONES){
  const {b,e}=fixture('bladebeast',z.id);advance(b,3.6);assert.equal(leapFrame(e).phase,'crouch');assert.equal(e.mode,'attack');
  advance(b,.45);const air=leapFrame(e);assert.equal(air.phase,'airborne');assert.ok(air.height>35);assert.ok(air.travel>0&&air.travel<1);
  advance(b,.35);assert.equal(leapFrame(e).phase,'land');assert.ok(walkablePoint(leapFrame(e).point,b.walkMap));assert.equal(e.mode,'attack');assert.equal(e.x,z.x);assert.equal(e.y,z.y,'animation keeps the original wall hitbox');
  advance(b,.1);assert.equal(e.mode,'inside');assert.equal(e.leap,undefined);assert.ok(b.events.some(e=>e.type==='vault'&&e.creature==='bladebeast'));assert.ok(walkablePoint(e.leapLanding.to,b.walkMap));
 }
});
test('mesh delays takeoff without putting the animal in slow motion while airborne',()=>{
 const {b,e}=fixture('bladebeast','right');b.zones[2].mesh=true;advance(b,11.85);assert.equal(e.leap,undefined);
 advance(b,.15);assert.equal(leapFrame(e).phase,'crouch');advance(b,.4);assert.equal(leapFrame(e).phase,'airborne');advance(b,.45);assert.equal(leapFrame(e).phase,'land');advance(b,.05);assert.equal(e.mode,'inside');
});
test('a real throw cancels a midair leap and creates a short falling pose without a false landing',()=>{
 const {b,e,z}=fixture('bladebeast');advance(b,4.05);assert.equal(leapFrame(e).phase,'airborne');const p=b.people[0];leaveHouse(b,p);Object.assign(p,inner(z),{nightRole:'guard',cooldown:100});
 battleCommand(b,{type:'throw',person:p.id,target:z.id});b.people[0].task.stage='work';b.people[0].task.progress=100;stepBattle(b);
 const actual=b.enemies[0];assert.equal(actual.leap,undefined);assert.equal(actual.progress,0);assert.equal(actual.mode,'attack');assert.equal(actual.x,z.x);assert.equal(actual.y,z.y);assert.ok(actual.stun>0);
 const interrupted=b.events.find(v=>v.type==='leap-cancel');assert.ok(interrupted.height>35);assert.equal(b.events.some(v=>v.type==='vault'),false);
 const pose=phaseCreaturePose(b,actual,b.elapsed);assert.equal(pose.phase,'fall');assert.ok(pose.height>0);assert.equal(phaseCreaturePose(b,actual,b.elapsed+.36).phase,'stunned');
 b.paused=true;const frozen=structuredClone(b);advance(b,1);assert.deepEqual(b,frozen);
});
test('ordinary strikes pause an airborne leap without cancelling it, and landing resumes after the stun',()=>{
 const {b,e}=fixture('bladebeast');advance(b,4);const p=b.people[0];leaveHouse(b,p);Object.assign(p,{x:e.x,y:e.y,nightRole:'guard',cooldown:0});const leap=e.leap;stepBattle(b);
 assert.equal(e.leap,leap);assert.equal(e.stun,.5);assert.ok(Math.abs(e.progress-4.05)<1e-8);assert.equal(leapFrame(e).phase,'airborne');assert.equal(b.events.some(v=>v.type==='leap-cancel'),false);
 const progress=e.progress;advance(b,.45);assert.equal(e.progress,progress);advance(b,.5);assert.equal(e.mode,'inside');assert.equal(e.leap,undefined);assert.ok(b.events.some(v=>v.type==='vault'));
});
test('retreat cannot retain a stale jump',()=>{
 const retreat=fixture('bladebeast');advance(retreat.b,4);retreat.e.mode='retreat';retreat.e.dogRetreatUntil=10;stepBattle(retreat.b);assert.equal(retreat.e.leap,undefined);
});
test('armor impact and two-angle breaking emit distinct actual events, opening only once per exposure window',()=>{
 const {b,e}=fixture('shellcrab','right');const left={x:e.x-20,y:e.y},below={x:e.x,y:e.y+20};
 assert.equal(phaseCreatureDamage(b,e,10,'strike',left,event),3);assert.ok(b.events.some(e=>e.type==='armor-hit'));
 assert.equal(phaseCreatureDamage(b,e,10,'strike',below,event),10);const opened=b.events.find(e=>e.type==='shell-break');assert.equal(opened.flankSources.length,2);
 assert.equal(phaseCreaturePose(b,e,b.elapsed+.3).phase,'open');assert.ok(phaseCreaturePose(b,e,b.elapsed+.3).open>.9);
 phaseCreatureDamage(b,e,10,'throw',below,event);assert.equal(b.events.filter(e=>e.type==='shell-break').length,1);assert.equal(phaseCreaturePose(b,e,b.elapsed+5.1).phase,'armored');
});
test('spore bursts carry only actual victims, and echo history is bounded to the real outer route',()=>{
 const {b,e}=fixture('sporetoad','right');const p=b.people[0];leaveHouse(b,p);Object.assign(p,{x:e.x-30,y:e.y,nightRole:'sleep',cooldown:100,task:{type:'move',target:{x:e.x-30,y:e.y},stage:'work',progress:0,reserved:{}}});
 e.progress=4.95;stepBattle(b);const burst=b.events.find(e=>e.type==='spores');assert.deepEqual(burst.people,['hero']);assert.equal(burst.targets[0].x,p.x);assert.equal(phaseCreaturePose(b,e,b.elapsed+.1).phase,'exhale');
 const echo=fixture('echomantis','backRight');echo.e.hp=echo.e.max/2;advance(echo.b,1.5);assert.ok(echo.e.echoTrail.length>1&&echo.e.echoTrail.length<=6);assert.ok(echo.e.echoTrail.every((p,i,all)=>!i||p.time>all[i-1].time));assert.equal(phaseCreaturePose(echo.b,echo.e,echo.b.elapsed).phase,'shift');
});
test('reduced motion preserves the airborne state with a low arc and removes fast wing vibrations',()=>{
 const {b,e}=fixture('bladebeast');advance(b,4.05);const normal=phaseCreaturePose(b,e,b.elapsed),gentle=phaseCreaturePose(b,e,b.elapsed,true);assert.equal(normal.phase,gentle.phase);assert.ok(normal.height>50);assert.ok(gentle.height<=12);assert.equal(gentle.angle,0);
 const echo=fixture('echomantis');assert.equal(phaseCreaturePose(echo.b,echo.e,1,true).angle,0);assert.equal(phaseCreaturePose(echo.b,echo.e,2,true).sx,1);
});

test('all four aliased paintings now have real opposing legs driven by travelled distance',()=>{
 for(const type of Object.keys(PHASE_PARTS)){
  const {b,e}=fixture(type);e.mode='approach';
  const a=phaseCreaturePose(b,e,10,false,{moving:true,distance:3}),c=phaseCreaturePose(b,e,10,false,{moving:true,distance:12});
  const j=phaseCreatureJoints(type,a),k=phaseCreatureJoints(type,c);assert.equal(a.locomotion,'walk');assert.ok(j.legFront.angle*j.legRear.angle<0,type);assert.notEqual(j.legFront.angle,k.legFront.angle,type);
  assert.deepEqual(phaseCreatureJoints(type,phaseCreaturePose(b,e,99,false,{moving:true,distance:3})).legFront,j.legFront,'time cannot slide a planted foot');
  const idle=phaseCreatureJoints(type,phaseCreaturePose(b,e,10));assert.ok(Math.abs(idle.legFront.angle)<1e-8);assert.ok(Math.abs(idle.legRear.angle)<1e-8);
 }
});
test('gait, wings and sacs freeze on pause and stun; reduced motion keeps gentle static limbs',()=>{
 for(const type of Object.keys(PHASE_PARTS)){
  const {b,e}=fixture(type);e.mode='approach';b.paused=true;b.elapsed=10;
  const a=phaseCreaturePose(b,e,10,false,{moving:true,distance:7}),c=phaseCreaturePose(b,e,99,false,{moving:true,distance:7});assert.deepEqual(a,c);assert.deepEqual(phaseCreatureJoints(type,a),phaseCreatureJoints(type,c));
  e.stun=2;const stopped=phaseCreatureJoints(type,phaseCreaturePose(b,e,30,false,{moving:true,distance:7}));assert.equal(stopped.legFront.dy,0);assert.equal(stopped.legRear.dy,0);
  e.stun=0;const gentle=phaseCreatureJoints(type,phaseCreaturePose(b,e,10,true,{moving:true,distance:7}),true);assert.equal(gentle.legFront.angle,0);assert.equal(gentle.legRear.angle,0);
 }
});
test('an outgoing contact moves claws, while an incoming hit only recoils the correct creature',()=>{
 for(const type of Object.keys(PHASE_PARTS)){
  const {b,e}=fixture(type);e.mode='inside';b.elapsed=10;b.events=[{type:'attack',enemyId:e.id,time:9.9,source:{x:e.x-10,y:e.y}}];
  const received=phaseCreaturePose(b,e,10);assert.ok(received.hurt>0);assert.equal(received.strike,0);assert.equal(received.attack,undefined);
  b.events.push({type:'enemy-hit',enemyId:'other',time:9.9});assert.equal(phaseCreaturePose(b,e,10).strike,0);
  b.events.push({id:7,type:'enemy-hit',enemyId:e.id,time:9.9,targetId:'hero'});const outgoing=phaseCreaturePose(b,e,10);assert.ok(outgoing.strike>0);assert.equal(outgoing.attack.targetId,'hero');
  const before=structuredClone(b);phaseCreatureJoints(type,outgoing);assert.deepEqual(b,before);
 }
});
test('all four bosses and both split forms have distance-driven locomotion and a frozen pause',()=>{
 for(const [type,bossForm]of [['bastion',0],['broodmother',0],['cinderwhale',0],['twinvein',0],['twinvein',1],['twinvein',2]]){
  const {b,e}=fixture('bladebeast');Object.assign(e,{type,bossForm,mode:'approach'});b.boss={phase:'approach'};
  const a=bossPose(b,e,10,false,true,2),c=bossPose(b,e,10,false,true,8);assert.notEqual(a.angle,c.angle,type);
  b.paused=true;b.elapsed=10;assert.deepEqual(bossPose(b,e,10,false,true,2),bossPose(b,e,99,false,true,2));
 }
});
