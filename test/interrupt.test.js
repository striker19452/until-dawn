import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestSession} from '../src/test-mode.js';
import {createBattle,battleCommand,stepBattle,inner} from '../src/battle.js';
import {windupInfo,planInterrupt} from '../src/interrupt.js';
import {pickWindupEnemy,pickEnemy} from '../client/enemy-input.js';
import {orderStatus} from '../client/orders.js';
import {ZONES} from '../src/content.js';
import {leaveHouse} from '../src/shelter.js';
function fixture(){
 const base=createTestSession({day:22}).snapshot.state;base.people.forEach(p=>p.nightRole='sleep');
 const b=createBattle(base,'interrupt',{autoPause:false});b.challenge=null;b.boss=null;b.schedule=[{at:9999,type:'walker',zone:'gate'}];
 const e={id:'leaper',type:'bladebeast',zone:'gate',x:ZONES[0].x,y:ZONES[0].y,hp:1000,max:1000,mode:'attack',progress:1,attack:0,stun:0};b.enemies=[e];b.zones[0].mesh=true;
 const wake=(i,patch={})=>{const p=b.people[i];leaveHouse(b,p);Object.assign(p,inner(ZONES[0]),{nightRole:'guard',fatigue:0},patch);return p;};
 return {b,e,wake};
}
test('automatic dispatch picks the fastest reachable eligible actor, including fatigue, without mutating the preview',()=>{
 const {b,e,wake}=fixture();wake(0,{fatigue:100});const near=wake(1,{x:230});const before=structuredClone(b),plan=planInterrupt(b,e.id);
 assert.equal(plan.allowed,true);assert.equal(plan.person,near.id);assert.deepEqual(b,before);
});
test('a click queues a real stamina-based heavy strike, duplicate clicks cannot queue again, and the real strike resets the windup',()=>{
 const {b,e,wake}=fixture();const p=wake(1),before=b.resources.materials,plan=planInterrupt(b,e.id);battleCommand(b,{type:'interrupt',enemyId:e.id});
 assert.equal(b.people.find(q=>q.id===p.id).task.type,'heavy');assert.equal(b.resources.materials,before);assert.equal(b.paused,true);assert.equal(b.events.at(-1).personId,p.id);
 const queued=structuredClone(b);assert.throws(()=>battleCommand(b,{type:'interrupt',enemyId:e.id}),/已有成员/);assert.deepEqual(b,queued);
 b.paused=false;for(let tick=0;tick<300&&!b.events.some(e=>e.type==='heavy');tick++)stepBattle(b);
 assert.ok(b.events.some(e=>e.type==='heavy'));assert.equal(b.enemies[0].progress,0);assert.equal(b.enemies[0].stun,1.2);assert.ok(Math.abs(b.elapsed-plan.eta)<.11);
});
test('sleepers, severe injuries, retreat and other manual work are not automatically interrupted',()=>{
 const {b,e,wake}=fixture();wake(0,{task:{type:'repair',target:'gate'}});wake(1,{wound:'severe'});const retreat=wake(2);b.fearRetreats[retreat.id]={stage:'travel'};
 const before=structuredClone(b);assert.equal(planInterrupt(b,e.id).allowed,false);assert.throws(()=>battleCommand(b,{type:'interrupt',enemyId:e.id}),/暂无可派成员/);assert.deepEqual(b,before);
});
test('insufficient resources, finished windups, dead targets and inside targets never spend materials',()=>{
 for(const patch of [{called:true,type:'caller'},{hp:0},{mode:'inside'},{type:'walker'}]){const {b,e,wake}=fixture();wake(0);Object.assign(e,patch);const before=structuredClone(b);assert.throws(()=>battleCommand(b,{type:'interrupt',enemyId:e.id}),/没有可打断/);assert.deepEqual(b,before);}
 const {b,e,wake}=fixture();wake(0,{stamina:0});b.resources.materials=0;const before=structuredClone(b);assert.throws(()=>battleCommand(b,{type:'interrupt',enemyId:e.id}),/暂无可派成员/);assert.deepEqual(b,before);
});
test('a late dispatch is explicit rather than promising an instantaneous interrupt',()=>{
 const {b,e,wake}=fixture();wake(0);b.zones[0].mesh=false;e.progress=4.4;const plan=planInterrupt(b,e.id);assert.equal(plan.late,true);battleCommand(b,{type:'interrupt',enemyId:e.id});assert.match(b.events.at(-1).text,/可能赶不上/);
});
test('only actual interruptible abilities have click targets, including boss charges',()=>{
 const {b,e}=fixture();
 for(const type of ['climber','burrower','caller','quencher','bladebeast','sporetoad','rammer']){Object.assign(e,{type,progress:1,attack:1});b.zones[0].mesh=false;assert.ok(windupInfo(b,e),type);}
 e.type='climber';b.zones[0].spikes=true;assert.equal(windupInfo(b,e),null);
 Object.assign(e,{boss:true,type:'bastion'});b.boss={phase:'charge',clock:1};assert.ok(windupInfo(b,e));b.boss.phase='exposed';assert.equal(windupInfo(b,e),null);
 e.type='cinderwhale';b.boss.phase='siphon';assert.ok(windupInfo(b,e));
});
test('painted airborne bodies are picked before their original wall position, with bounded touch padding',()=>{
 const {b,e}=fixture(),tokens=new Map([['e-'+e.id,{bodyBounds:{left:100,top:200,width:30,height:40},sprite:{visible:true,alpha:1}}]]);
 assert.equal(pickWindupEnemy(b,tokens,{x:110,y:220}),e.id);assert.equal(pickWindupEnemy(b,tokens,{x:95,y:220}),null);assert.equal(pickWindupEnemy(b,tokens,{x:95,y:220},7),e.id);
 assert.equal(pickWindupEnemy(b,tokens,{x:e.x,y:e.y}),null);tokens.get('e-'+e.id).sprite.alpha=0;assert.equal(pickWindupEnemy(b,tokens,{x:110,y:220}),null);
});
test('explicit selection uses that person against ordinary creatures, replacing a move without choosing a nearer teammate',()=>{
 const {b,e,wake}=fixture();const hero=wake(0,{x:100,y:350}),near=wake(1);Object.assign(e,{type:'walker',mode:'inside',stun:1000});
 battleCommand(b,{type:'move',person:hero.id,target:{x:120,y:360}});
 const before=structuredClone(b),plan=planInterrupt(b,e.id,hero.id);assert.equal(plan.allowed,true);assert.equal(plan.person,hero.id);assert.ok(plan.travel>0);assert.deepEqual(b,before);
 battleCommand(b,{type:'interrupt',person:hero.id,enemyId:e.id});const actor=()=>b.people.find(p=>p.id===hero.id);
 assert.equal(actor().task.type,'heavy');assert.equal(actor().task.enemyId,e.id);assert.equal(b.people.find(p=>p.id===near.id).task,null);assert.equal(b.events.at(-1).explicit,true);
 assert.match(orderStatus(actor(),b).current,/靠近灰行者.*到达后蓄力重击.*已暂停/);
 b.paused=false;for(let i=0;i<400&&actor().task?.stage!=='work';i++)stepBattle(b);
 assert.equal(actor().task.stage,'work');assert.match(orderStatus(actor(),b).current,/正在蓄力重击灰行者/);assert.equal(b.events.some(e=>e.type==='heavy'),false);
 for(let i=0;i<60&&!b.events.some(e=>e.type==='heavy');i++)stepBattle(b);
 assert.ok(b.events.some(e=>e.type==='heavy'&&e.personId===hero.id));
});
test('failed explicit heavy orders preserve the old task and never substitute another ready actor',()=>{
 for(const patch of [{stamina:0},{wound:'severe'},{cooldown:true}]){
  const {b,e,wake}=fixture(),p=wake(0);wake(1);battleCommand(b,{type:'move',person:p.id,target:{x:120,y:360}});
  const actor=b.people[0];if(patch.cooldown)b.heavyCooldowns[p.id]=2;else Object.assign(actor,patch);
  const before=structuredClone(b);assert.throws(()=>battleCommand(b,{type:'interrupt',person:p.id,enemyId:e.id}),/体力不足|重伤|冷却/);assert.deepEqual(b,before);
 }
});
test('ordinary and occluded visible enemies consume a body click, while hidden bodies and dormant targets do not',()=>{
 const {b,e}=fixture();Object.assign(e,{type:'walker',mode:'inside'});
 const obj={bodyBounds:{left:100,top:200,width:30,height:40},sprite:{visible:false,alpha:1},outline:{visible:true}},tokens=new Map([['e-'+e.id,obj]]);
 assert.equal(pickEnemy(b,tokens,{x:110,y:220}),e.id);assert.equal(pickWindupEnemy(b,tokens,{x:110,y:220}),null);
 obj.outline.visible=false;assert.equal(pickEnemy(b,tokens,{x:110,y:220}),null);
 obj.sprite.visible=true;e.bossDormant=true;assert.equal(pickEnemy(b,tokens,{x:110,y:220}),null);
});
