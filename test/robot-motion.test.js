import test from 'node:test';
import assert from 'node:assert/strict';
import {robotPose} from '../client/robot-motion.js';
import {createTestSession} from '../src/test-mode.js';
import {createBattle,stepBattle} from '../src/battle.js';
const base=type=>({id:'r1',type,hp:100,enabled:true,powered:true,cooldown:1,task:null});
const battle=()=>({elapsed:10,paused:false,events:[],enemies:[]});

test('walking gait is distance-driven, wheeled motion differs, and reduced motion removes body sway',()=>{
 const b=battle(),leg=base('repair'),wheel=base('dispatch');
 assert.equal(robotPose(b,leg,10,{moving:true,distance:0}).frame,0);assert.equal(robotPose(b,leg,10,{moving:true,distance:8}).frame,1);
 const a=robotPose(b,leg,10,{moving:true,distance:4}),c=robotPose(b,wheel,10,{moving:true,distance:4});assert.notEqual(a.angle,c.angle);assert.notEqual(a.dy,c.dy);
 const reduced=robotPose(b,leg,10,{moving:true,distance:4,reduced:true});assert.equal(reduced.angle,0);assert.equal(reduced.dy,0);assert.equal(reduced.phase,'travel');
});
test('repair action follows actual work, distinguishes winding from contact and faces its wall',()=>{
 const b=battle(),r=base('repair');r.task={type:'repair',zone:'gate',progress:.1};
 let p=robotPose(b,r,10);assert.equal(p.phase,'repair');assert.equal(p.frame,2);assert.equal(p.aim.id,'gate');
 r.task.progress=.4;p=robotPose(b,r,10);assert.equal(p.frame,3);assert.ok(p.work>0);assert.equal(robotPose(b,r,10,{moving:true,distance:1}).phase,'travel');
});
test('robot service aims and swings at the real recipient, preserves reduced-motion feedback and freezes on pause',()=>{
 const b=battle(),r=base('repair'),target={...base('defense'),id:'recipient',x:200,y:430,servicedBy:r.id};b.robots=[r,target];r.task={type:'robot-repair',zone:'gate',robotId:target.id,progress:.1};
 const lifted=robotPose(b,r,10);assert.equal(lifted.phase,'repair');assert.equal(lifted.aim,target);assert.equal(lifted.targetRobotId,target.id);assert.equal(lifted.frame,2);
 r.task.progress=.4;const contact=robotPose(b,r,10);assert.equal(contact.frame,3);assert.ok(contact.work>0);assert.equal(robotPose(b,target,10).phase,'receiving-repair');
 assert.equal(robotPose(b,r,10,{moving:true,distance:1}).phase,'travel');
 const reduced=robotPose(b,r,10,{reduced:true});assert.equal(reduced.phase,'repair');assert.equal(reduced.targetRobotId,target.id);assert.equal(reduced.angle,0);assert.equal(reduced.dx,0);assert.equal(reduced.work,contact.work);
 b.paused=true;assert.deepEqual(robotPose(b,r,10),robotPose(b,r,90));
});
test('a defense strike needs a real matching attack, persists through task completion, and then recovers',()=>{
 const b=battle(),r=base('defense');b.events=[{type:'attack',robotId:'other',time:9.9,x:2,y:3}];assert.equal(robotPose(b,r,10).phase,'idle');
 b.events.push({type:'attack',robotId:r.id,time:9.9,x:2,y:3,zone:'left'});const hit=robotPose(b,r,10);assert.equal(hit.phase,'strike');assert.equal(hit.frame,7);assert.ok(hit.dx>0);assert.equal(robotPose(b,r,10.6).phase,'idle');
});
test('radio visuals use actual sender and perceived cues; receivers cannot impersonate the dispatcher',()=>{
 const b=battle(),r=base('dispatch');r.lastSignal={at:9.9,kind:'bell',point:{x:70,y:310}};assert.equal(robotPose(b,r,10).phase,'listen');assert.equal(robotPose(b,r,10).frame,10);
 b.events=[{type:'robot-dispatch',dispatcherId:r.id,robotId:'worker',time:9.9,target:{x:90,y:300}}];const p=robotPose(b,r,10);assert.equal(p.phase,'transmit');assert.equal(p.frame,11);assert.equal(p.signal.robotId,'worker');
 assert.equal(robotPose(b,{...r,id:'worker',lastSignal:null},10).phase,'idle');assert.equal(robotPose(b,r,11.3).phase,'idle');
});
test('pause freezes event ages and all poses; reduced motion preserves legible working states',()=>{
 const b=battle(),r=base('dispatch');b.paused=true;b.events=[{type:'robot-dispatch',dispatcherId:r.id,robotId:'worker',time:9.8,target:{x:2,y:3}}];
 assert.deepEqual(robotPose(b,r,10),robotPose(b,r,90));const reduced=robotPose(b,r,10,{reduced:true});assert.equal(reduced.phase,'transmit');assert.equal(reduced.angle,0);
 for(const type of ['repair','defense','dispatch']){const stopped=robotPose(b,{...r,type,powered:false},10);assert.equal(stopped.phase,'offline');assert.equal(robotPose(b,{...r,type,hp:0},10).phase,'broken');}
});
test('presentation leaves the running simulation and its resource budget untouched',()=>{
 const session=createTestSession({day:1,preset:'robots'}),b=createBattle(session.snapshot.state,'motion');b.paused=false;for(let i=0;i<135;i++)stepBattle(b);
 const before=structuredClone(b);for(const r of b.robots)for(let frame=0;frame<60;frame++)robotPose(b,r,b.elapsed+frame/60,{moving:true,distance:frame});assert.deepEqual(b,before);
 assert.ok(b.events.some(e=>e.type==='robot-dispatch'&&e.dispatcherId==='robot-3'&&e.signal==='铃绳'));assert.equal(b.robots[2].lastSignal.kind,'bell');
});

test('articulated joints distinguish walking, a lifted tool, tool contact, shield strikes and listening',async()=>{
 const {robotJointPose,ROBOT_PARTS}=await import('../client/robot-rig.js');
 assert.equal(ROBOT_PARTS.repair.length,4);assert.equal(ROBOT_PARTS.dispatch.length,2);
 const walk=robotJointPose('repair',{phase:'travel'},4);assert.ok(walk.legL.angle>0);assert.ok(walk.legR.angle<0);assert.ok(walk.tool.angle>0);
 const lift=robotJointPose('repair',{phase:'repair',beat:.2}),contact=robotJointPose('repair',{phase:'repair',beat:.7});assert.ok(lift.tool.angle<0);assert.ok(contact.tool.angle>25);
 const brace=robotJointPose('defense',{phase:'brace'}),strike=robotJointPose('defense',{phase:'strike',beat:.5});assert.ok(brace.shield.angle>0);assert.ok(strike.shield.angle<0);
 const listen=robotJointPose('dispatch',{phase:'listen'});assert.ok(listen.head.angle<0);assert.ok(listen.antenna.angle<0);
 const gentle=robotJointPose('repair',{phase:'travel'},4,true);assert.equal(gentle.legL.angle,0);assert.equal(gentle.legR.angle,0);assert.ok(robotJointPose('defense',{phase:'strike',beat:.5},4,true).shield.angle<0);
});
