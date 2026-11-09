import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestSession} from '../src/test-mode.js';
import {createBattle,battleCommand,stepBattle,inner} from '../src/battle.js';
import {COMBAT} from '../src/balance.js';
import {ZONES} from '../src/content.js';
import {ROBOT_RULES,defaultRobotPlan} from '../src/robots.js';
import {planInterrupt} from '../src/interrupt.js';
import {leaveHouse} from '../src/shelter.js';
import {settleNight} from '../src/campaign.js';
import {validateClientResult} from '../src/client-result.js';
function fixture(robotType=null){
 const base=createTestSession({day:8}).snapshot.state;base.people.forEach(p=>p.nightRole='sleep');
 if(robotType)base.robots=[{id:'robot-test',name:'测试防卫机',type:robotType,hp:100,enabled:true,poweredDay:8,plan:defaultRobotPlan()}];
 base.zones[0].mesh=true;
 const b=createBattle(base,'heavy',{autoPause:false});Object.assign(b,{paused:false,challenge:null,schedule:[{at:9999,type:'walker',zone:'gate'}]});b.resources.materials=0;
 const e={id:'charging',type:'bladebeast',zone:'gate',x:ZONES[0].x,y:ZONES[0].y,hp:1000,max:1000,mode:'attack',progress:1,attack:0,stun:0};b.enemies=[e];b.zones[0].mesh=true;
 return {base,b,e};
}
const advance=(b,s)=>{for(let i=0;i<Math.round(s*20);i++)stepBattle(b);};
test('human heavy strike charges first, hits only one target, costs stamina but no materials, and has a cooldown',()=>{
 const {b,e}=fixture(),p=b.people[1];leaveHouse(b,p);Object.assign(p,inner(ZONES[0]),{nightRole:'guard',stamina:100});b.paused=true;
 const other={...e,id:'other'};b.enemies.push(other);battleCommand(b,{type:'interrupt',enemyId:e.id});assert.equal(b.resources.materials,0);assert.equal(b.people[1].stamina,100);
 b.paused=false;advance(b,1.15);assert.equal(b.enemies[0].hp,1000);const beforeHit=b.people[1].stamina;advance(b,.05);
 assert.equal(b.enemies[0].hp,1000-COMBAT.heavy.damage);assert.equal(b.enemies[0].progress,0);assert.equal(b.enemies[1].hp,1000);assert.ok(b.enemies[1].progress>1);assert.ok(Math.abs(b.people[1].stamina-(beforeHit+.1-COMBAT.heavy.stamina))<1e-8);assert.equal(b.heavyCooldowns[p.id],COMBAT.heavy.cooldown);assert.equal(b.resources.materials,0);
 assert.throws(()=>battleCommand(b,{type:'heavy',person:p.id,target:'gate',enemyId:e.id}),/冷却/);
});
test('charge is canceled safely if target dies, and moving out of melee range resets charge instead of landing a remote hit',()=>{
 const {b,e}=fixture(),p=b.people[1];leaveHouse(b,p);Object.assign(p,inner(ZONES[0]),{nightRole:'guard'});battleCommand(b,{type:'heavy',person:p.id,target:'gate',enemyId:e.id});advance(b,.5);
 Object.assign(b.enemies[0],{x:500,y:200,mode:'inside'});stepBattle(b);assert.equal(b.people[1].task.progress,0);assert.equal(b.events.some(e=>e.type==='heavy'),false);
 b.enemies[0].hp=0;stepBattle(b);assert.equal(b.people[1].task,null);assert.equal(b.heavyCooldowns[p.id],0);
});
test('defense robot autonomously charges and interrupts with zero materials while other robot types cannot',()=>{
 for(const type of ['defense','repair','dispatch']){
  const {b,e}=fixture(type),r=b.robots[0];Object.assign(r,inner(ZONES[0]));advance(b,1.3);
  if(type==='defense'){assert.ok(b.events.some(v=>v.type==='heavy'&&v.robotId===r.id));assert.equal(e.progress,0);assert.ok(r.heavyCooldown>5);assert.ok(e.stun>1.9&&e.stun<=2);assert.equal(e.hp,970);}
  else assert.equal(b.events.some(v=>v.type==='heavy'),false,type);
  assert.equal(b.resources.materials,0);
 }
});
test('robot heavy hit lands after charging for 30 damage and two seconds of stun, resetting one target only',()=>{
 const {b,e}=fixture('defense'),r=b.robots[0];Object.assign(r,inner(ZONES[0]));const other={...e,id:'other'};b.enemies.push(other);
 stepBattle(b);assert.equal(r.task.type,'heavy');advance(b,ROBOT_RULES.heavySeconds-.05);assert.equal(e.hp,1000);
 stepBattle(b);assert.equal(e.hp,970);assert.equal(e.stun,2);assert.equal(e.progress,0);assert.equal(e.attack,0);assert.equal(r.heavyCooldown,6);
 assert.equal(other.hp,1000);assert.equal(other.stun,0);assert.ok(other.progress>1);
 assert.equal(b.events.find(v=>v.type==='heavy'&&v.robotId===r.id).damage,30);
});
test('one-click dispatch can choose a ready defense robot, respects route, fuel and opt-out, and preserves saved robot identity',()=>{
 const {base,b,e}=fixture('defense'),r=b.robots[0];Object.assign(r,inner(ZONES[0]));b.paused=true;
 const plan=planInterrupt(b,e.id);assert.equal(plan.allowed,true);assert.equal(plan.kind,'robot');battleCommand(b,{type:'interrupt',enemyId:e.id});assert.equal(r.task.type,'heavy');assert.throws(()=>battleCommand(b,{type:'interrupt',enemyId:e.id}),/已有成员/);
 b.paused=false;advance(b,1.2);assert.ok(b.events.some(v=>v.type==='heavy'&&v.robotId===r.id));assert.equal(planInterrupt(b,e.id).allowed,false);
 const result=settleNight(base,b);validateClientResult(base,result);assert.equal(result.robots[0].poweredDay,base.robots[0].poweredDay);assert.equal(Object.hasOwn(result.robots[0],'heavyCooldown'),false);
 for(const patch of [{powered:false},{enabled:false},{hp:0},{plan:{...defaultRobotPlan(),route:['left']}},{plan:{...defaultRobotPlan(),acceptDispatch:false}}]){const f=fixture('defense');Object.assign(f.b.robots[0],patch);assert.equal(planInterrupt(f.b,f.e.id).allowed,false);}
});
test('robot heavy cooldown prevents repeated heavy hits and damaged machines cannot finish their charge',()=>{
 const {b,e}=fixture('defense'),r=b.robots[0];Object.assign(r,inner(ZONES[0]));advance(b,.5);assert.equal(r.task.type,'heavy');r.hp=0;advance(b,1);assert.equal(b.events.some(v=>v.type==='heavy'),false);assert.ok(e.progress>1);
 const f=fixture('defense');Object.assign(f.b.robots[0],inner(ZONES[0]));advance(f.b,1.3);const first=f.b.events.filter(v=>v.type==='heavy').length;advance(f.b,2);assert.equal(f.b.events.filter(v=>v.type==='heavy').length,first);
});
test('human and defense robot heavy hits both expose a charging boss without a materials cost',()=>{
 for(const robot of [false,true])for(const day of [7,21]){
  const base=createTestSession({day}).snapshot.state;base.people.forEach(p=>p.nightRole='sleep');
  if(robot)base.robots=[{id:'counter-robot',name:'破招防卫机',type:'defense',hp:100,enabled:true,poweredDay:day,plan:defaultRobotPlan()}];
  const b=createBattle(base,'boss-heavy',{autoPause:false});b.challenge=null;b.paused=false;b.schedule=[{at:0,type:day===7?'bastion':'cinderwhale',zone:'gate'}];stepBattle(b);
  b.schedule=[{at:9999,type:'walker',zone:'gate'}];const e=b.enemies.find(e=>e.boss);Object.assign(e,{x:ZONES[0].x,y:ZONES[0].y,mode:'attack'});Object.assign(b.boss,{phase:day===7?'charge':'siphon',clock:0});b.resources.materials=0;
  if(robot)Object.assign(b.robots[0],inner(ZONES[0]));else{const p=b.people[0];leaveHouse(b,p);Object.assign(p,inner(ZONES[0]),{nightRole:'guard'});battleCommand(b,{type:'heavy',person:p.id,target:'gate',enemyId:e.id});}
  advance(b,1.3);assert.equal(b.boss.phase,'exposed',`day ${day} ${robot?'robot':'human'}`);assert.equal(b.resources.materials,0);assert.ok(b.events.some(v=>v.type==='heavy'));
 }
});
