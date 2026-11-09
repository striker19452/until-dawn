import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,applyCampaignAction as act,settleNight,normalizeCampaign} from '../src/campaign.js';
import {createBattle,stepBattle,battleCommand,event} from '../src/battle.js';
import {ROBOT_RULES,ROBOT_TYPES,occupiedBeds,defaultRobotPlan} from '../src/robots.js';
import {stepRobots} from '../src/robot-simulation.js';
import {validateClientResult} from '../src/client-result.js';
import {needs} from '../src/rules.js';
import {worldPoint} from '../src/yard-geometry.js';
import {nearestWalkablePoint} from '../src/movement.js';
import {NIGHT_ACTIONS} from '../src/balance.js';
const day=()=>{const s=act(initialCampaign(53),{type:'chooseRole',role:'repairman'});s.resources={food:100,water:100,materials:100,fuel:100,parts:100,medicine:100};s.beds=5;s.ap=100;s.buildings=[{id:'shed',type:'workshop',level:2,branch:'yield',hp:10,plot:0}];s.flags.centralFire=false;return s;};
function add(s,type,plan){s=act(s,{type:'buildRobot',robot:type});if(plan)s=act(s,{type:'robotPlan',id:s.robots.at(-1).id,plan:{...defaultRobotPlan(),...plan}});return s;}
function night(s){const base=act(s,{type:'prepare'}),b=createBattle(base,'robot-test',{autoPause:false});b.paused=false;b.people[0].nightRole='sleep';b.schedule=[{at:999,type:'walker',zone:'gate'}];b.challenge=null;return {base,b};}
const advance=(b,seconds)=>{for(let i=0;i<Math.ceil(seconds*20);i++)stepBattle(b);};
const enemy=(id,zone,x,y)=>({id,type:'walker',zone,x,y,hp:100,max:100,mode:'attack',attack:0,progress:0,stun:0});

test('manufacture needs an operational upgraded workshop, shares beds with recruitment, and charges real resources',()=>{
 let s=day();s.buildings[0].level=1;assert.throws(()=>add(s,'repair'),/二级/);s.buildings[0].level=2;s.buildings[0].hp=0;assert.throws(()=>add(s,'repair'),/二级/);s.buildings[0].hp=10;
 const before=structuredClone(s);s=add(s,'repair');assert.equal(s.resources.parts,before.resources.parts-ROBOT_TYPES.repair.cost.parts);assert.equal(s.ap,before.ap-ROBOT_RULES.ap);assert.equal(occupiedBeds(s),2);s.beds=2;
 assert.throws(()=>add(s,'defense'),/床位/);assert.throws(()=>act(s,{type:'recruit',person:'lin'}),/床位/);
 s=act(s,{type:'scrapRobot',id:s.robots[0].id});assert.equal(occupiedBeds(s),1);s=act(s,{type:'recruit',person:'lin'});assert.equal(s.people.length,2);
});
test('daily fuel charges once, shortage and manual shutdown disable work, rollback restores fuel, robots need no rations',()=>{
 let s=add(add(add(day(),'repair'),'defense'),'dispatch');const demand=needs(s);assert.deepEqual(demand,needs({...s,robots:[]}));s.resources.fuel=1;
 let prepared=act(s,{type:'prepare'});assert.equal(prepared.resources.fuel,0);assert.deepEqual(prepared.robots.map(r=>r.poweredDay),[1,null,null]);const b=createBattle(prepared,'fuel');assert.deepEqual(b.robots.map(r=>r.powered),[true,false,false]);assert.equal(b.robots[1].status,'缺油停机');
 const back=act(prepared,{type:'backDay'});assert.equal(back.resources.fuel,1);assert.deepEqual(act(back,{type:'prepare'}).robots,prepared.robots);
 s=act(s,{type:'toggleRobot',id:s.robots[0].id});prepared=act(s,{type:'prepare'});assert.deepEqual(prepared.robots.map(r=>r.poweredDay),[null,1,null]);
});
test('both watchtower upgrades speed up all robot movement until the tower is destroyed',()=>{
 let s=day();
 for(const type of ['repair','defense','dispatch'])s=add(s,type,{route:['gate','left']});
 s=act(s,{type:'build',building:'watchtower'});
 for(const branch of ['yield','steady']){
  const {b}=night(act(s,{type:'upgradeBuilding',id:s.buildings.at(-1).id,branch}));
  const tower=b.buildings.at(-1);
  b.zones.forEach(z=>z.hp=100);
  for(const r of b.robots)Object.assign(r,{x:240,y:410,index:0});
  for(const multiplier of [1.2,1]){
   const before=b.robots.map(({x,y})=>({x,y}));
   stepBattle(b,.05);
   b.robots.forEach((r,i)=>{
    const distance=Math.hypot(r.x-before[i].x,r.y-before[i].y);
    assert.ok(Math.abs(distance-ROBOT_TYPES[r.type].speed*multiplier*.05)<1e-8,`${branch} ${r.type} moved ${distance}`);
   });
   tower.hp=0;
  }
 }
});
test('repair robot obeys route, threshold and material cap, and rejects direct human orders',()=>{
 let s=add(day(),'repair',{route:['gate'],materials:2,repairBelow:100});const {b}=night(s);b.zones.forEach(z=>z.hp=10);const fuel=b.resources.fuel,mat=b.resources.materials;
 advance(b,30);assert.equal(b.zones[0].hp,98);assert.equal(b.resources.materials,mat-2);assert.equal(b.robots[0].materialsUsed,2);assert.equal(b.zones[1].hp,10);assert.equal(b.resources.fuel,fuel);
 const r=b.robots[0],e=enemy('target','gate',r.x,r.y);b.enemies=[e];advance(b,.1);assert.equal(e.hp,100);
 assert.throws(()=>battleCommand(b,{type:'fire',person:r.id,target:'central'}),/成员不存在/);
 assert.throws(()=>battleCommand(b,{type:'robotPlan',id:r.id,plan:{...r.plan,repairBelow:75}}),/夜间无法改变/);assert.equal(r.materialsUsed,2);assert.equal(r.plan.repairBelow,100);
});
function robotCampfireNight(heat,wood,withDispatcher=false,repairBelow=75){
 const plan={route:['gate','backLeft'],repairBelow};
 let s=add(day(),'repair',plan);
 if(withDispatcher)s=add(s,'dispatch',{route:['backLeft','gate']});
 s.flags.centralFire=true;s.flags.campfireWood=wood;
 const {base,b}=night(s),fire=b.fires[0],[worker,dispatcher]=b.robots;
 b.zones.forEach(z=>z.hp=100);
 Object.assign(fire,{heat,wood});
 Object.assign(worker,nearestWalkablePoint(fire,b.walkMap));
 return {base,b,fire,worker,dispatcher};
}
test('repair machines add wood, stoke and relight with the campfire timings and budget',()=>{
 for(const [action,heat,wood] of [['addWood',10,.2],['stoke',10,.8],['fire',0,.8]]){
  const {base,b,fire,worker}=robotCampfireNight(heat,wood),materials=b.resources.materials;
  advance(b,NIGHT_ACTIONS.times[action]-.05);
  assert.equal(worker.task?.action,action);
  assert.equal(b.resources.materials,materials);
  stepBattle(b);
  const cost=action==='addWood'?NIGHT_ACTIONS.costs.addWood.materials:0;
  assert.equal(b.resources.materials,materials-cost);
  assert.equal(b.supportUsed.firewood,cost);
  assert.equal(worker.materialsUsed,0);
  assert.equal(worker.task,null);
  assert.equal(fire.heat,60);
  if(cost)assert.equal(fire.wood,1);
  assert.ok(b.events.some(e=>e.type==='fire'&&e.robotId===worker.id&&e.action===action));
  validateClientResult(base,settleNight(base,b));
 }
});
test('local and dispatched fence repairs interrupt campfire work at the configured threshold',()=>{
 for(const [remote,threshold] of [[false,75],[true,75],[false,25],[true,25]]){
  const {b,fire,worker,dispatcher}=robotCampfireNight(10,.2,remote,threshold),materials=b.resources.materials;
  advance(b,1);
  assert.equal(worker.task?.action,'addWood');
  const zone=remote?'backLeft':'gate',wall=b.zones.find(z=>z.id===zone);
  wall.hp=threshold;
  stepBattle(b);
  assert.equal(worker.task?.action,'addWood');
  wall.hp=threshold-1;
  worker.materialsUsed=worker.plan.materials;
  stepBattle(b);
  assert.equal(worker.task?.action,'addWood');
  worker.materialsUsed=0;
  stepBattle(b);
  assert.equal(worker.task?.type,'repair');
  assert.equal(worker.task?.zone,zone);
  assert.equal(worker.task?.dispatcher,dispatcher?.id);
  assert.equal(b.resources.materials,materials);
  assert.equal(b.supportUsed.firewood,0);
  assert.ok(fire.wood<.25);
  for(let i=0;i<400&&wall.hp===threshold-1;i++)stepBattle(b);
  assert.equal(wall.hp,Math.min(wall.max,threshold-1+ROBOT_RULES.repairGain));
  assert.ok(!b.events.some(e=>e.type==='fire'&&e.robotId===worker.id));
 }
});
test('robot fire tending honors shutdown, the shared budget and manual human work',()=>{
 const {b,fire,worker}=robotCampfireNight(0,.2),materials=b.resources.materials;
 fire.enabled=false;
 advance(b,5);
 assert.equal(worker.task,null);
 assert.equal(fire.heat,0);
 fire.enabled=true;b.supportBudget.firewood=0;
 stepBattle(b);
 assert.equal(worker.task?.action,'fire');
 b.supportBudget.firewood=2;
 stepBattle(b);
 assert.equal(worker.task?.action,'addWood');
 battleCommand(b,{type:'addWood',person:'hero',target:'central'});
 stepBattle(b);
 assert.equal(b.robots[0].task,null);
 assert.equal(b.resources.materials,materials-1);
 assert.equal(b.supportUsed.firewood,0);
});
function robotRepairFixture({hp=40,materials=2,parts=2,threshold=75}={}){
 let s=add(add(day(),'repair',{route:['gate'],materials,parts,repairBelow:threshold}),'defense',{route:['gate'],wait:10});s.robots[1].hp=hp;
 const {base,b}=night(s),[worker,target]=b.robots;Object.assign(target,{x:worker.x+20,y:worker.y});return {base,b,worker,target};
}
test('repair robots service another machine before the wall, spending parts only after two seconds and respecting the separate nightly budget',()=>{
 const {base,b,worker,target}=robotRepairFixture({materials:0,parts:1});b.zones[0].hp=10;const materials=b.resources.materials,parts=b.resources.parts,at={x:target.x,y:target.y};
 advance(b,1.95);assert.equal(worker.task.type,'robot-repair');assert.equal(worker.task.robotId,target.id);assert.equal(target.hp,40);assert.equal(b.resources.materials,materials);assert.equal(b.resources.parts,parts);assert.equal(target.servicedBy,worker.id);assert.deepEqual({x:target.x,y:target.y},at);
 stepBattle(b);assert.equal(target.hp,84);assert.equal(b.resources.materials,materials);assert.equal(b.resources.parts,parts-1);assert.equal(worker.partsUsed,1);assert.equal(worker.materialsUsed,0);assert.equal(b.zones[0].hp,10);
 assert.ok(b.events.some(e=>e.type==='robot-repair'&&e.targetRobotId===target.id&&e.robotId===worker.id&&e.gain===44));advance(b,8);assert.equal(target.hp,84);assert.equal(b.zones[0].hp,10);
 const result=settleNight(base,b);validateClientResult(base,result);assert.equal(result.robots[1].hp,84);assert.deepEqual(result.report.robots.repairs,[{repairerId:worker.id,targetId:target.id,gain:44}]);
 for(const mutate of [r=>r.report.robots.repairs=[],r=>r.report.robots.repairs[0].gain=45,r=>r.report.robots.repairs[0].repairerId=target.id,r=>r.resources.parts=base.resources.parts,r=>r.report.robots.repairs.push({...r.report.robots.repairs[0]})]){const fake=structuredClone(result);mutate(fake);assert.throws(()=>validateClientResult(base,fake),/机器人/);}
});
test('machine repairs revive a powered machine disabled during the night but cannot provide fuel to an unfueled one',()=>{
 for(const fueled of [true,false]){
  const {b,worker,target}=robotRepairFixture({hp:fueled?40:0,parts:1});target.hp=0;assert.equal(target.powered,fueled);
  advance(b,2);assert.equal(target.hp,44);assert.equal(target.powered,fueled);assert.equal(worker.partsUsed,1);
  const before={x:target.x,y:target.y};advance(b,1);const traveled=Math.hypot(target.x-before.x,target.y-before.y);assert.equal(traveled>0,fueled);
 }
});
test('machine service needs parts rather than materials, and both resource budgets remain independent',()=>{
 const f=robotRepairFixture({parts:1,materials:0});f.b.resources.materials=0;advance(f.b,2);assert.equal(f.target.hp,84);assert.equal(f.worker.partsUsed,1);assert.equal(f.b.resources.materials,0);
 const g=robotRepairFixture({parts:0,materials:1});g.b.zones[0].hp=10;const parts=g.b.resources.parts,materials=g.b.resources.materials;advance(g.b,7);
 assert.equal(g.target.hp,40);assert.equal(g.b.zones[0].hp,54);assert.equal(g.worker.partsUsed,0);assert.equal(g.b.resources.parts,parts);assert.equal(g.b.resources.materials,materials-1);
 const h=robotRepairFixture({parts:1});advance(h.b,1);h.b.resources.parts=0;advance(h.b,2);assert.equal(h.target.hp,40);assert.equal(h.worker.partsUsed,0);assert.equal(h.b.robotRepairs,undefined);
});
test('older robot plans receive a default parts budget, including the saved preparation rollback',()=>{
 const s=add(day(),'repair');delete s.robots[0].plan.parts;s.preparationBase=structuredClone(s);normalizeCampaign(s);
 assert.equal(s.robots[0].plan.parts,defaultRobotPlan().parts);assert.equal(s.preparationBase.robots[0].plan.parts,defaultRobotPlan().parts);
});
test('repairs respect sight, patrol scope, threshold, stock and operator power, cannot heal the operator or duplicate an assignment',()=>{
 for(const patch of ['sight','scope','threshold','stock','power','self']){
  const {b,worker,target}=robotRepairFixture();b.zones.forEach(z=>z.hp=100);
  if(patch==='sight')target.x=worker.x+ROBOT_RULES.vision+1;
  if(patch==='scope')Object.assign(target,{x:145,y:170});
  if(patch==='threshold')target.hp=75;
  if(patch==='stock')b.resources.parts=0;
  if(patch==='power')worker.powered=false;
  if(patch==='self'){worker.hp=20;target.hp=100;}
  stepBattle(b);assert.notEqual(worker.task?.type,'robot-repair',patch);assert.equal(b.robotRepairs,undefined,patch);
 }
 const {b,worker,target}=robotRepairFixture();const other={...structuredClone(worker),id:'repair-other',x:worker.x+1};b.robots.unshift(other);stepBattle(b);
 assert.equal(b.robots.filter(r=>r.task?.type==='robot-repair'&&r.task.robotId===target.id).length,1);
});
test('a moving or lost repair target resets work, cancellation spends no resources, and gains never exceed full durability',()=>{
 const {b,worker,target}=robotRepairFixture({threshold:100});const materials=b.resources.materials,parts=b.resources.parts;advance(b,1);assert.ok(worker.task.progress>0);
 target.x+=60;stepBattle(b);assert.equal(worker.task.progress,0);assert.equal(b.resources.materials,materials);assert.equal(b.resources.parts,parts);
 target.hp=100;stepBattle(b);assert.equal(worker.task,null);assert.equal(b.resources.materials,materials);assert.equal(b.resources.parts,parts);
 Object.assign(target,{hp:95,x:worker.x+10,y:worker.y});advance(b,2);assert.equal(target.hp,100);assert.equal(b.robotRepairs[0].gain,5);assert.equal(b.resources.materials,materials);assert.equal(b.resources.parts,parts-1);
});
test('defense robot attacks only seen threats in its current route, dispatch machine never attacks or repairs',()=>{
 let s=add(add(day(),'defense',{route:['gate']}),'dispatch',{route:['gate']});const {b}=night(s),r=b.robots[0];
 b.enemies=[enemy('local','gate',r.x,r.y),enemy('other','left',r.x,r.y)];const local=b.enemies[0],other=b.enemies[1];b.zones.forEach(z=>z.hp=50);
 advance(b,.1);assert.equal(local.hp,100-ROBOT_RULES.strikeDamage);assert.equal(other.hp,100);assert.equal(b.zones[0].hp,50);
});
test('defense robot deals 15 damage every second and stuns ordinary targets for one second without resetting windup',()=>{
 const {b}=night(add(day(),'defense')),r=b.robots[0];r.heavyCooldown=100;
 const e={...enemy('caller','gate',r.x,r.y),type:'caller',progress:1};b.enemies=[e];
 stepBattle(b);assert.equal(e.hp,85);assert.equal(e.stun,1);assert.equal(e.progress,1.05);const attack=e.attack;
 advance(b,.95);assert.equal(e.hp,85);assert.equal(e.progress,1.05);assert.equal(e.attack,attack);
 stepBattle(b);assert.equal(e.hp,70);assert.equal(e.stun,1);
 advance(b,1);assert.equal(e.hp,55);assert.equal(b.events.filter(v=>v.type==='attack'&&v.robotId===r.id).length,3);
});
test('defense ordinary strikes preserve longer stuns and respect boss immunity',()=>{
 for(const boss of [false,true]){
  const {b}=night(add(day(),'defense')),r=b.robots[0],e={...enemy('stunned','gate',r.x,r.y),stun:2,boss};b.enemies=[e];
  stepBattle(b);assert.equal(e.hp,85);assert.equal(e.stun,1.95);
  e.stun=0;r.cooldown=0;stepBattle(b);assert.equal(e.hp,70);assert.equal(e.stun,boss?0:1);
 }
});
test('robots advance an ordered loop and dispatch moves substantially faster',()=>{
 const {b}=night(add(add(day(),'repair',{route:['gate','left'],wait:0,materials:0}),'dispatch',{route:['gate','left'],wait:0}));b.zones.forEach(z=>z.hp=100);
 const starts=b.robots.map(r=>({...r}));advance(b,1);assert.equal(b.robots[0].index,1);assert.equal(b.robots[1].index,1);
 const distance=(r,i)=>Math.hypot(r.x-starts[i].x,r.y-starts[i].y);assert.ok(distance(b.robots[1],1)>distance(b.robots[0],0)*1.5);
});
test('dispatcher hears bells beyond sight, respects silence, scope and worker opt-out',()=>{
 const plan={route:['gate','backLeft'],wait:10};const {b}=night(add(add(day(),'defense',plan),'dispatch',plan));const [worker,dispatcher]=b.robots;Object.assign(worker,{x:240,y:455});Object.assign(dispatcher,{x:240,y:455});
 const hooks={event,note:()=>{},flow:()=>{},strike:()=>{}};
 stepRobots(b,.05,hooks);assert.equal(worker.task,null);
 event(b,'warning',145,170,'far warning',{zone:'backLeft'});stepRobots(b,.05,hooks);assert.equal(worker.task,null,'outside ordinary hearing');
 event(b,'bell',145,170,'bell',{zone:'backLeft'});stepRobots(b,.05,hooks);assert.equal(worker.task.zone,'backLeft');assert.equal(worker.task.dispatcher,dispatcher.id);assert.equal(dispatcher.dispatches,1);
 worker.task=null;worker.plan.acceptDispatch=false;dispatcher.dispatchCooldown=0;event(b,'bell',145,170,'bell',{zone:'backLeft'});stepRobots(b,.05,hooks);assert.equal(worker.task,null);
 worker.plan.acceptDispatch=true;worker.plan.route=['gate'];event(b,'bell',145,170,'bell',{zone:'backLeft'});stepRobots(b,.05,hooks);assert.equal(worker.task,null);
});
test('bell signals reach dispatchers without any distance limit while other sounds remain local',()=>{
 for(const location of [{x:450,y:455},{x:10000,y:10000}]){
  const plan={route:['gate','backLeft'],wait:10},{b}=night(add(add(day(),'defense',plan),'dispatch',plan)),[worker,dispatcher]=b.robots;
  Object.assign(dispatcher,location);const hooks={event,note:()=>{},flow:()=>{},strike:()=>{}};
  assert.ok(Math.hypot(dispatcher.x-145,dispatcher.y-170)>320);
  for(const type of ['warning','dog-bark','breach'])event(b,type,145,170,'distant sound',{zone:'backLeft'});
  stepRobots(b,.05,hooks);assert.equal(worker.task,null);assert.equal(dispatcher.lastSignal,undefined);
  event(b,'bell',145,170,'distant bell',{zone:'backLeft'});stepRobots(b,.05,hooks);
  assert.equal(worker.task.type,'defense');assert.equal(worker.task.zone,'backLeft');assert.equal(worker.task.dispatcher,dispatcher.id);assert.equal(dispatcher.lastSignal.kind,'bell');
  assert.ok(b.events.some(e=>e.type==='robot-dispatch'&&e.robotId===worker.id&&e.signal==='铃绳'));
 }
});
test('a global bell dispatches the nearest eligible idle defense robot and does not reassign busy or unavailable machines',()=>{
 const plan={route:['gate','backLeft'],wait:10},{b}=night(add(add(day(),'dispatch',plan),'defense',plan)),[dispatcher,worker]=b.robots;
 Object.assign(dispatcher,{x:450,y:455});Object.assign(worker,{x:450,y:455});
 const eligible={...structuredClone(worker),id:'nearest',x:200,y:200};
 const unavailable=[{type:'repair'},{hp:0},{powered:false},{enabled:false},{task:{type:'defense',zone:'gate'}},{plan:{...worker.plan,acceptDispatch:false}},{plan:{...worker.plan,route:['gate']}}].map((patch,i)=>({...structuredClone(worker),id:`unavailable-${i}`,x:145,y:170,...patch}));
 b.robots=[dispatcher,...unavailable,eligible,worker];const before=unavailable.map(r=>r.task?.zone??null);
 event(b,'bell',145,170,'distant bell',{zone:'backLeft'});stepRobots(b,.05,{event,note:()=>{},flow:()=>{},strike:()=>{}});
 assert.equal(eligible.task.type,'defense');assert.equal(eligible.task.zone,'backLeft');assert.equal(eligible.task.dispatcher,dispatcher.id);assert.equal(worker.task,null);
 assert.deepEqual(unavailable.map(r=>r.task?.zone??null),before);assert.equal(dispatcher.dispatches,1);
});
test('dispatch chooses the quicker walking route around obstacles',()=>{
 const {b}=night(add(add(add(day(),'dispatch'),'defense'),'defense'));
 const [dispatcher,near,quick]=b.robots;
 const polygon=points=>points.map(([x,y])=>({x,y}));
 b.walkMap={
  boundary:polygon([[0,0],[480,0],[480,600],[0,600]]),
  obstacles:[polygon([[90,320],[390,320],[390,425],[90,425]])]
 };
 Object.assign(near,worldPoint({x:240,y:315}));
 Object.assign(quick,worldPoint({x:90,y:438}));
 assert.ok(Math.hypot(near.x-240,near.y-475)<Math.hypot(quick.x-240,quick.y-475));
 event(b,'bell',240,475,'bell',{zone:'gate'});
 stepRobots(b,.05,{event,note:()=>{},flow:()=>{},strike:()=>{}});
 assert.equal(near.task,null);
 assert.equal(quick.task?.dispatcher,dispatcher.id);
 const order=b.events.find(e=>e.type==='robot-dispatch');
 assert.equal(order.robotId,quick.id);
 assert.ok(order.travel>0&&order.travel<ROBOT_RULES.assignmentSeconds);
});
test('an observed intruder takes priority over an old bell and is reported to a distant defender',()=>{
 const plan={route:['gate','backRight'],wait:10};
 const {b}=night(add(add(day(),'dispatch',plan),'defense',plan)),[dispatcher,worker]=b.robots;
 Object.assign(worker,{x:100,y:400});
 const intruder={...enemy('intruder','backRight',280,380),mode:'inside'};
 b.enemies=[intruder];
 assert.ok(Math.hypot(intruder.x-worker.x,intruder.y-worker.y)>ROBOT_RULES.vision);
 event(b,'bell',240,475,'bell',{zone:'gate'});
 let hits=0;
 const hooks={event,note:()=>{},flow:()=>{},strike:()=>{hits++;}};
 stepRobots(b,.05,hooks);
 assert.equal(worker.task?.dispatcher,dispatcher.id);
 assert.equal(worker.task?.zone,'backRight');
 assert.deepEqual(worker.task?.sighting,{x:intruder.x,y:intruder.y});
 for(let i=0;i<200&&!hits;i++){b.elapsed+=.05;stepRobots(b,.05,hooks);}
 assert.ok(hits>0);
});
test('a bell tied to an enemy that changed zones does not send a defender to the old front',()=>{
 const plan={route:['gate','backLeft'],wait:10};
 const {b}=night(add(add(day(),'dispatch',plan),'defense',plan)),[,worker]=b.robots;
 b.enemies=[{...enemy('runner','left',70,310),mode:'approach'}];
 event(b,'bell',145,170,'old bell',{zone:'backLeft',enemyId:'runner'});
 stepRobots(b,.05,{event,note:()=>{},flow:()=>{},strike:()=>{}});
 assert.equal(worker.task,null);
 assert.equal(b.events.some(e=>e.type==='robot-dispatch'),false);
});
test('dispatch leaves a killable arrival to an intact trap but responds if another enemy would get through',()=>{
 const plan={route:['gate','backLeft'],wait:10};
 const {b}=night(add(add(day(),'dispatch',plan),'defense',plan)),[dispatcher,worker]=b.robots;
 const wall=b.zones.find(z=>z.id==='backLeft');
 wall.traps=1;
 b.enemies=[{...enemy('rat','backLeft',105,25),type:'skitter',hp:12,mode:'approach'}];
 event(b,'bell',145,170,'bell',{zone:'backLeft',enemyId:'rat'});
 const hooks={event,note:()=>{},flow:()=>{},strike:()=>{}};
 stepRobots(b,.05,hooks);
 assert.equal(worker.task,null);
 assert.equal(dispatcher.dispatches,0);
 assert.equal(wall.traps,1);
 b.enemies.push({...b.enemies[0],id:'second-rat'});
 event(b,'bell',145,170,'second bell',{zone:'backLeft',enemyId:'second-rat'});
 stepRobots(b,.05,hooks);
 assert.equal(worker.task?.dispatcher,dispatcher.id);
 assert.equal(worker.task?.zone,'backLeft');
});
test('dispatch relies on faster spikes only when the wall and required objective can hold',()=>{
 const cases=[
  {name:'spikes finish before arrival'},
  {name:'spikes would take too long',enemyHp:45,send:true},
  {name:'required wall would fall below target',wallHp:70,goal:'hold',send:true},
  {name:'spores could fail the objective',goal:'control',type:'sporetoad',send:true},
  {name:'target already inside',mode:'inside',send:true}
 ];
 for(const {name,enemyHp=5,wallHp=100,goal,mode='attack',type='walker',send=false} of cases){
  const plan={route:['gate','backLeft'],wait:10};
  const {b}=night(add(add(day(),'dispatch',plan),'defense',plan)),[dispatcher,worker]=b.robots;
  b.people=[];
  Object.assign(b.zones.find(z=>z.id==='backLeft'),{hp:wallHp,spikes:true});
  if(goal)b.challenge={required:true,goal,zone:'backLeft',integrity:65,broken:[]};
  b.enemies=[{...enemy('target','backLeft',145,170),hp:enemyHp,mode,type}];
  event(b,'bell',145,170,'bell',{zone:'backLeft',enemyId:'target'});
  stepRobots(b,.05,{event,note:()=>{},flow:()=>{},strike:()=>{}});
  assert.equal(dispatcher.dispatches,Number(send),name);
  assert.equal(worker.task?.zone,send?'backLeft':undefined,name);
 }
});
function reinforcementFixture(hp,attackers){
 const plan={route:['gate','backLeft'],wait:10};
 const state=add(add(add(add(day(),'dispatch',plan),'defense',plan),'defense',plan),'defense',plan);
 const {b}=night(state),[dispatcher,lead,reserve,spare]=b.robots;
 for(const r of [dispatcher,reserve,spare])Object.assign(r,{x:450,y:455});
 Object.assign(lead,{x:145,y:170,task:{type:'defense',zone:'backLeft',progress:0}});
 b.zones.find(z=>z.id==='backLeft').hp=hp;
 b.enemies=attackers.map((patch,i)=>({...enemy(`attacker-${i}`,'backLeft',145,170),...patch}));
 const hooks={event,note:()=>{},flow:()=>{},strike:()=>{}};
 const ring=()=>{
  event(b,'bell',145,170,'bell',{zone:'backLeft'});
  stepRobots(b,.05,hooks);
 };
 return {b,dispatcher,lead,reserve,spare,ring};
}
test('defense reinforcement requires current pressure in that zone',()=>{
 const cases=[
  {name:'two active attackers',hp:100,attackers:[{},{mode:'inside'}],reinforce:true},
  {name:'one attacker at the wall threshold',hp:45,attackers:[{}],reinforce:true},
  {name:'one attacker above the wall threshold',hp:46,attackers:[{}],reinforce:false},
  {name:'stale bell at a weak wall',hp:45,attackers:[],reinforce:false},
  {name:'approaching enemies at a weak wall',hp:45,attackers:[{mode:'approach'},{mode:'approach'}],reinforce:false},
  {name:'inactive or out of zone',hp:100,attackers:[{},{hp:0},{mode:'retreat'},{bossDormant:true},{zone:'gate'}],reinforce:false}
 ];
 for(const {name,hp,attackers,reinforce} of cases){
  const {b,dispatcher,reserve,spare,ring}=reinforcementFixture(hp,attackers);
  ring();
  assert.equal(dispatcher.dispatches,Number(reinforce),name);
  assert.equal(reserve.task?.dispatcher,reinforce?dispatcher.id:undefined,name);
  assert.equal(spare.task,null,name);
  assert.equal(b.events.some(e=>e.type==='robot-dispatch'&&e.reinforcement===true),reinforce,name);
 }
});
test('dispatch handles an unstaffed attack before sending a second defender',()=>{
 const {b,dispatcher,reserve,spare,ring}=reinforcementFixture(100,[{},{}]);
 b.enemies.push(enemy('second-front','gate',240,475));
 dispatcher.signals=[{type:'defense',zone:'backLeft',source:'铃绳',until:8}];
 event(b,'bell',240,475,'gate bell',{zone:'gate'});
 ring();
 assert.equal(reserve.task?.zone,'gate');
 assert.equal(spare.task,null);
 assert.equal(dispatcher.dispatches,1);
 assert.ok(b.events.some(e=>e.type==='robot-dispatch'&&e.zone==='gate'&&!e.reinforcement));
});
test('dispatch protects a required fence at risk from the next round of hits',()=>{
 const cases=[
  {name:'hold target under pressure',hp:85,wanted:'backLeft'},
  {name:'hold target can take the next round',hp:96,wanted:'gate'},
  {name:'critical house under attack',hp:85,house:45,wanted:'gate'},
  {name:'fence objective already lost',hp:85,broken:['backLeft'],wanted:'gate'},
  {name:'second fence of a split objective',hp:85,goal:'split',wanted:'backLeft'},
  {name:'other required fence already lost',hp:85,goal:'split',broken:['gate'],wanted:'gate'},
  {name:'challenge has no fence objective',hp:85,goal:'control',wanted:'gate'}
 ];
 for(const {name,hp,house=100,goal='hold',broken=[],wanted} of cases){
  const {b,reserve,ring}=reinforcementFixture(hp,[{type:'rammer'},{type:'rammer'}]);
  b.house=house;
  b.challenge={required:true,goal,zone:goal==='split'?'gate':'backLeft',other:'backLeft',integrity:65,broken};
  b.enemies.push({...enemy('intruder','gate',390,445),mode:'inside',attackTarget:{id:'house'}});
  ring();
  assert.equal(reserve.task?.zone,wanted,name);
  const order=b.events.find(e=>e.type==='robot-dispatch');
  assert.equal(order?.reinforcement,wanted==='backLeft'?true:undefined,name);
 }
});
test('a defender charging a heavy strike counts toward the two-machine limit',()=>{
 const {b,dispatcher,lead,reserve,spare,ring}=reinforcementFixture(100,[{},{}]);
 lead.task={type:'heavy',zone:'backLeft',enemyId:b.enemies[0].id,progress:0,returnTask:lead.task};
 reserve.plan.acceptDispatch=false;
 ring();
 assert.equal(reserve.task,null);
 assert.equal(spare.task.dispatcher,dispatcher.id);
 assert.ok(b.events.some(e=>e.type==='robot-dispatch'&&e.reinforcement===true&&e.robotId===spare.id));
 reserve.plan.acceptDispatch=true;
 dispatcher.dispatchCooldown=0;
 ring();
 assert.equal(lead.task.type,'heavy');
 assert.equal(dispatcher.dispatches,1);
 assert.equal(reserve.task,null);
});
test('dispatcher uses sight to call repair workers, and distant unseen wall damage stays unknown',()=>{
 const {b}=night(add(add(day(),'repair',{route:['gate','left'],materials:2}),'dispatch',{route:['gate','left']}));const [worker,d]=b.robots;worker.index=1;worker.x=70;worker.y=310;d.x=240;d.y=455;b.zones.forEach(z=>z.hp=100);b.zones[0].hp=20;b.zones[3].hp=0;
 stepRobots(b,.05,{event,note:()=>{},flow:()=>{},strike:()=>{}});assert.equal(worker.task.zone,'gate');assert.equal(worker.task.dispatcher,d.id);
});
function dispatchedRepairFixture(){
 const plan={route:['gate','left'],parts:1,materials:0,wait:10};let s=add(add(add(day(),'repair',plan),'dispatch',plan),'defense',{route:['gate'],wait:10});s.robots[2].hp=40;
 const {base,b}=night(s),[worker,dispatcher,target]=b.robots;b.zones.forEach(z=>z.hp=100);Object.assign(worker,{index:1,x:70,y:310});Object.assign(dispatcher,{x:240,y:455});Object.assign(target,{x:240,y:439});return {base,b,worker,dispatcher,target};
}
test('a dispatcher sees damaged machines and sends a repair robot that cannot yet see the target, completing paid repair and settlement',()=>{
 const {base,b,worker,dispatcher,target}=dispatchedRepairFixture(),parts=b.resources.parts;
 assert.ok(Math.hypot(worker.x-target.x,worker.y-target.y)>ROBOT_RULES.vision);stepBattle(b);
 assert.equal(worker.task.type,'robot-repair');assert.equal(worker.task.robotId,target.id);assert.equal(worker.task.dispatcher,dispatcher.id);assert.equal(worker.task.progress,0);
 assert.ok(b.events.some(e=>e.type==='robot-dispatch'&&e.job==='robot-repair'&&e.targetRobotId===target.id&&e.robotId===worker.id&&e.text.includes('前去修理')));
 advance(b,18);assert.equal(target.hp,84);assert.equal(b.resources.parts,parts-1);assert.equal(worker.partsUsed,1);assert.equal(dispatcher.dispatches,1);
 const result=settleNight(base,b);validateClientResult(base,result);assert.equal(result.report.robots.repairs[0].targetId,target.id);
});
test('machine repair dispatch respects vision, both routes, opt-out, fuel, busy state, threshold, inventory and parts budget',()=>{
 for(const patch of ['vision','dispatcher-route','worker-route','opt-out','fuel','busy','threshold','stock','budget','dispatcher-power']){
  const {b,worker,dispatcher,target}=dispatchedRepairFixture();
  if(patch==='vision')Object.assign(dispatcher,{x:450,y:170});
  if(patch==='dispatcher-route')dispatcher.plan.route=['left'];
  if(patch==='worker-route'){worker.plan.route=['left'];worker.index=0;}
  if(patch==='opt-out')worker.plan.acceptDispatch=false;
  if(patch==='fuel')worker.powered=false;
  if(patch==='busy'){worker.plan.materials=1;b.zones.find(z=>z.id==='left').hp=20;worker.task={type:'repair',zone:'left',progress:1};}
  if(patch==='threshold')target.hp=75;
  if(patch==='stock')b.resources.parts=0;
  if(patch==='budget')worker.partsUsed=worker.plan.parts;
  if(patch==='dispatcher-power')dispatcher.powered=false;
  stepBattle(b);assert.equal(b.events.some(e=>e.type==='robot-dispatch'&&e.job==='robot-repair'),false,patch);
 }
});
test('dispatchers can request repair for themselves or broken machines, and choose the nearest eligible worker without duplicate assignments',()=>{
 for(const self of [true,false]){
  const {b,worker,dispatcher,target}=dispatchedRepairFixture();target.hp=self?100:0;if(self)dispatcher.hp=40;
  const nearest={...structuredClone(worker),id:'nearby-repair',x:90,y:320},blocked={...structuredClone(worker),id:'opted-out',x:150,y:400,plan:{...worker.plan,acceptDispatch:false}};
  const second={...structuredClone(dispatcher),id:'second-dispatcher',hp:100};b.robots=[dispatcher,second,blocked,nearest,worker,target];stepBattle(b);
  const injured=self?dispatcher:target,orders=b.events.filter(e=>e.type==='robot-dispatch'&&e.job==='robot-repair');
  assert.equal(orders.length,1);assert.equal(orders[0].robotId,nearest.id);assert.equal(orders[0].targetRobotId,injured.id);assert.equal(nearest.task.robotId,injured.id);assert.equal(worker.task,null);
 }
});
test('different damaged machines in one zone can receive separate repair assignments',()=>{
 const {b,worker,dispatcher,target}=dispatchedRepairFixture();const otherWorker={...structuredClone(worker),id:'other-repair',x:90},otherTarget={...structuredClone(target),id:'other-target',hp:30},second={...structuredClone(dispatcher),id:'second-dispatcher'};
 b.robots=[dispatcher,second,worker,otherWorker,target,otherTarget];stepBattle(b);
 const orders=b.events.filter(e=>e.type==='robot-dispatch'&&e.job==='robot-repair');assert.equal(orders.length,2);assert.equal(new Set(orders.map(e=>e.robotId)).size,2);assert.equal(new Set(orders.map(e=>e.targetRobotId)).size,2);
});
test('broken robots remain bed occupants, take no fuel, can be repaired and cannot invent health on settlement',()=>{
 let s=add(day(),'repair');s.robots[0].hp=.01;const {b,base}=night(s),r=b.robots[0];b.indoorPeople.hero=true;b.enemies=[{...enemy('intruder','gate',r.x,r.y),mode:'inside'}];advance(b,.1);assert.equal(r.hp,0);assert.equal(b.people[0].health,100);assert.equal(r.task,null);
 b.enemies=[];b.schedule=[];advance(b,.1);const result=settleNight(base,b);validateClientResult(base,result);assert.equal(result.robots[0].hp,0);assert.equal(occupiedBeds(result),2);assert.equal(result.report.robots.damaged.length,1);
 const corrupt=structuredClone(result);corrupt.robots[0].hp=101;assert.throws(()=>validateClientResult(base,corrupt),/耐久/);
 let next=act(result,{type:'nextDay'});next.ap=10;next.resources.parts=1;next.resources.materials=0;next=act(next,{type:'restoreRobot',id:r.id});assert.equal(next.robots[0].hp,100);assert.equal(next.ap,9);assert.equal(next.resources.parts,0);assert.equal(next.resources.materials,0);
 next.robots[0].hp=50;assert.throws(()=>act(next,{type:'restoreRobot',id:r.id}),/物资不足/);assert.equal(next.robots[0].hp,50);
 next.resources.parts=1;next=act(next,{type:'restoreRobot',id:r.id});assert.equal(next.robots[0].hp,100);assert.equal(next.resources.parts,0);assert.equal(next.resources.materials,0);
});
test('planning validates inputs, locks during both paused and active nights, survives settlement and normalizes older saves',()=>{
 let s=add(day(),'dispatch'),id=s.robots[0].id;
 for(const patch of [{route:[]},{route:['outside']},{wait:NaN},{materials:-1},{parts:-1},{parts:21},{parts:1.5},{acceptDispatch:'yes'},{extra:4}])assert.throws(()=>act(s,{type:'robotPlan',id,plan:{...defaultRobotPlan(),...patch}}),/规划/);
 let base=act(s,{type:'prepare'});base=act(base,{type:'robotPlan',id,plan:{...defaultRobotPlan(),route:['left','gate']}});assert.deepEqual(act(base,{type:'backDay'}).robots[0].plan.route,['left','gate']);
 const b=createBattle(base,'plan',{autoPause:false}),original=structuredClone(b.robots[0]);
 for(const paused of [true,false]){b.paused=paused;for(const patch of [{route:['right']},{wait:0},{repairBelow:100},{materials:0},{parts:0},{acceptDispatch:false}]){
  assert.throws(()=>battleCommand(b,{type:'robotPlan',id,plan:{...original.plan,...patch}}),/夜间无法改变/);assert.deepEqual(b.robots[0],original);
 }}
 const result=settleNight(base,b);validateClientResult(base,result);assert.deepEqual(result.robots[0].plan.route,['left','gate']);
 for(const patch of [{route:['right']},{wait:0},{repairBelow:100},{materials:0},{parts:0},{acceptDispatch:false}]){const forged=structuredClone(result);Object.assign(forged.robots[0].plan,patch);assert.throws(()=>validateClientResult(base,forged),/夜间不能改变机器人模式或巡逻规划/);}
 b.robots[0].plan.route=['right'];assert.deepEqual(settleNight(base,b).robots[0].plan.route,['left','gate']);
 const fake=structuredClone(result);fake.robots[0].enabled=false;assert.throws(()=>validateClientResult(base,fake),/身份/);
 delete s.robots;normalizeCampaign(s);assert.deepEqual(s.robots,[]);
});
