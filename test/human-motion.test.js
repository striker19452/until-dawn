import test from 'node:test';
import assert from 'node:assert/strict';
import {humanPose,HUMAN_ACTIONS} from '../client/human-motion.js';
import {makePerson} from '../src/campaign.js';
import {createTestSession} from '../src/test-mode.js';
import {createBattle,stepBattle} from '../src/battle.js';
import {orderDuration} from '../src/night-orders.js';
const person=()=>Object.assign(makePerson('hero','你','幸存者','survival'),{x:240,y:450,cooldown:0});
const battle=()=>({elapsed:10,paused:false,events:[],fires:[{id:'central',x:240,y:390}]});

test('work gestures require arrival, follow real progress and use the actual order duration',()=>{
 const b=battle(),p=person();
 for(const type of Object.keys(HUMAN_ACTIONS).filter(t=>!['guard','brace'].includes(t))){
  p.task={type,target:['fire','stoke','addWood','clearWet','extinguish'].includes(type)?'central':'gate',stage:'travel',progress:0};
  assert.equal(humanPose(b,p,10,{moving:true,distance:4}).rig,false,type);
  p.task.stage='work';p.task.progress=.3;
  const pose=humanPose(b,p,10);assert.equal(pose.phase,type);assert.equal(pose.rig,true);
  assert.equal(pose.progress,.3/orderDuration(p,type));
 }
 p.task={type:'repair',target:'left',stage:'work',progress:.2};const lift=humanPose(b,p,10);
 p.task.progress=.48;const contact=humanPose(b,p,10);assert.notEqual(contact.arm,lift.arm);assert.ok(contact.contact>0);assert.equal(contact.aim.id,'left');
 p.task={type:'brace',target:'gate',stage:'work',progress:4};assert.equal(humanPose(b,p,10).workProgress,.5);
 b.events=[{type:'attack',personId:p.id,time:9.9,x:260,y:450}];assert.equal(humanPose(b,p,10).phase,'strike');assert.equal(humanPose(b,p,10).workProgress,.5);
});
test('only a matching real strike or throw event produces an attack; old saves can match exact source positions',()=>{
 const b=battle(),p=person();
 b.events=[{type:'attack',personId:'lin',time:9.9,x:230,y:450,source:p}];assert.equal(humanPose(b,p,10).phase,'idle');
 b.events.push({type:'attack',robotId:'robot-1',time:9.95,source:p});assert.equal(humanPose(b,p,10).phase,'idle');
 b.events.push({type:'attack',personId:p.id,time:9.95,x:260,y:450});assert.equal(humanPose(b,p,10).phase,'strike');assert.equal(humanPose(b,p,10.6).phase,'idle');
 b.events=[{type:'throw',time:9.9,x:240,y:480,source:{x:p.x,y:p.y}}];assert.equal(humanPose(b,p,10).phase,'release');
 p.x+=5;assert.equal(humanPose(b,p,10).phase,'idle');
});
test('strike contact starts at the hit, articulates the wrist and settles continuously into guard',()=>{
 const b=battle(),p=person();p.cooldown=1;b.events=[{type:'attack',personId:p.id,time:10,x:260,y:450}];
 const at=age=>humanPose(b,p,10+age),contact=at(0),follow=at(.075),recoil=at(.23),settled=at(.559),ready=at(.56);
 assert.equal(contact.phase,'strike');assert.ok(contact.arm<-60,'the hand must already be extended when damage occurs');assert.equal(contact.contact,1);
 assert.ok(follow.dx>contact.dx);assert.ok(follow.wrist>contact.wrist);assert.ok(recoil.wrist<contact.wrist,'wrist folds independently on recovery');
 assert.equal(ready.phase,'ready');for(const key of ['arm','wrist','dx','angle'])assert.ok(Math.abs(settled[key]-ready[key])<.01,key);
 const reduced=humanPose(b,p,10.075,{reduced:true});assert.equal(reduced.wrist,-8);assert.equal(reduced.dx,0);assert.equal(reduced.contact,0);
 b.paused=true;b.elapsed=10.23;assert.deepEqual(humanPose(b,p,11),humanPose(b,p,100));
});
test('a brief windup needs a reachable real target, available stamina and an imminent strike cooldown',()=>{
 const b=battle(),p=person();p.cooldown=.1;b.enemies=[{id:'target',hp:20,x:p.x+20,y:p.y,mode:'inside'}];
 const before=structuredClone(b),pose=humanPose(b,p,10);assert.equal(pose.phase,'windup');assert.equal(pose.aim.id,'target');assert.deepEqual(b,before);assert.equal(pose.event,undefined);
 b.enemies[0].mode='retreat';assert.equal(humanPose(b,p,10).phase,'ready');
 b.enemies[0].mode='inside';p.stamina=0;assert.equal(humanPose(b,p,10).phase,'ready');
 p.stamina=100;b.enemies[0].x+=200;assert.equal(humanPose(b,p,10).phase,'ready');
});
test('pausing freezes every gesture, and reduced motion retains distinct static action states',()=>{
 const b=battle(),p=person();b.paused=true;
 p.task={type:'stoke',target:'central',stage:'work',progress:1};assert.deepEqual(humanPose(b,p,10),humanPose(b,p,100));
 for(const phase of ['repair','throw','compact','stoke','clearWet']){
  p.task={type:phase,target:'central',stage:'work',progress:.5};const pose=humanPose(b,p,20,{reduced:true});
  assert.equal(pose.phase,phase);assert.equal(pose.angle,0);assert.equal(pose.dx,0);assert.equal(pose.dy,0);assert.equal(pose.contact,0);assert.equal(pose.sy,1);assert.ok(pose.label);
 }
});
test('wounded survivors preserve seated/crawling art and fatigue changes the resting stance',()=>{
 const b=battle(),p=person();p.stamina=10;assert.equal(humanPose(b,p,10).phase,'tired');
 p.wound='severe';p.task={type:'repair',stage:'work',progress:2};assert.equal(humanPose(b,p,10).phase,'seated');assert.equal(humanPose(b,p,10).rig,false);assert.equal(humanPose(b,p,10,{moving:true}).phase,'crawl');
});
test('actual simulation strikes identify the survivor, and evaluating poses never changes game state',()=>{
 const session=createTestSession({day:1}),b=createBattle(session.snapshot.state,'human-motion',{autoPause:false});
 b.paused=false;b.schedule=[];b.challenge=null;b.people=b.people.slice(0,1);const p=b.people[0];p.task=null;p.cooldown=0;p.nightRole='guard';
 b.enemies=[{id:'target',type:'walker',zone:'gate',x:p.x,y:p.y,hp:100,max:100,mode:'inside',attack:0,progress:0,stun:10}];stepBattle(b,.1);
 const attack=b.events.find(e=>e.type==='attack');assert.ok(attack);assert.equal(attack.personId,p.id);
 const before=structuredClone(b);for(let i=0;i<60;i++)humanPose(b,p,b.elapsed+i/60,{distance:i});assert.deepEqual(b,before);
});
