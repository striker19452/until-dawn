import {windupInfo} from './interrupt.js';
import {approachHeavy,livingTarget,pendingHeavy} from './heavy-strike.js';
import {ROBOT_RULES,defaultRobotPlan,robotMoveSpeed} from './robots.js';
import {ENEMIES,ZONES} from './content.js';
import {COMBAT,NIGHT_ACTIONS} from './balance.js';
import {CAMPFIRE_HEAT,CAMPFIRE_MAX_WOOD,campfireNeedsWood,tendedHeat} from './campfire.js';
import {autoBudgetAvailable} from './cooperation.js';
import {moveToward,nearestWalkablePoint,walkTravelTime} from './movement.js';
import {isIndoors} from './shelter.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const active=r=>r.enabled&&r.powered!==false&&r.hp>0;
const threat=e=>e.hp>0&&e.mode!=='retreat'&&!e.bossDormant;
const point=(z,r)=>{const at={x:z.x+(240-z.x)*.15,y:z.y+(350-z.y)*.15};const lane=r?({repair:-52,defense:0,dispatch:52}[r.type]):0;return {...at,x:at.x+lane};};
export function createBattleRobots(base,b){
 return (base.robots||[]).map(r=>{const robot=structuredClone(r),z=ZONES.find(z=>z.id===r.plan.route[0]);return {...robot,...nearestWalkablePoint(point(z,r),b.walkMap),powered:r.enabled&&r.hp>0&&r.poweredDay===base.day,index:0,wait:0,cooldown:0,heavyCooldown:0,dispatchCooldown:0,materialsUsed:0,partsUsed:0,task:null,status:r.hp<=0?'损坏待修':!r.enabled?'手动停机':r.poweredDay!==base.day?'缺油停机':'巡逻',lastHeard:0,dispatches:0,signals:[]};});
}
function stopTask(r){r.task=null;r.wait=0;}
const repairBudget=(b,r)=>r.materialsUsed+ROBOT_RULES.repairCost<=r.plan.materials&&b.resources.materials>=ROBOT_RULES.repairCost;
const robotZone=r=>[...ZONES].sort((a,b)=>distance(r,a)-distance(r,b))[0].id;
function canRepairRobot(b,r,target){return target&&target.id!==r.id&&target.hp<r.plan.repairBelow&&target.hp<ROBOT_RULES.hp&&r.plan.route.includes(robotZone(target))&&target.task?.type!=='robot-repair'&&(r.partsUsed||0)+ROBOT_RULES.robotRepairCost<=(r.plan.parts??defaultRobotPlan().parts)&&b.resources.parts>=ROBOT_RULES.robotRepairCost&&!b.robots.some(q=>q.id!==r.id&&active(q)&&q.task?.type==='robot-repair'&&q.task.robotId===target.id);}
function canRepair(b,r,z){return z&&z.hp<r.plan.repairBelow&&repairBudget(b,r)&&!(z.hp<=0&&b.enemies.some(e=>threat(e)&&e.zone===z.id&&e.mode!=='approach'));}
function localTask(b,r){
 const zone=r.plan.route[r.index],z=b.zones.find(z=>z.id===zone),geometry=ZONES.find(z=>z.id===zone);
 if(r.type==='repair'){
  const target=b.robots.filter(q=>robotZone(q)===zone&&distance(r,q)<=ROBOT_RULES.vision&&canRepairRobot(b,r,q)).sort((a,c)=>a.hp-c.hp||distance(r,a)-distance(r,c))[0];
  if(target)return {type:'robot-repair',zone,robotId:target.id,progress:0};
 }
 if(r.type==='repair'&&distance(r,geometry)<=ROBOT_RULES.vision&&canRepair(b,r,z))return {type:'repair',zone,progress:0};
 if(r.type==='defense'&&b.enemies.some(e=>threat(e)&&e.zone===zone&&distance(r,e)<=ROBOT_RULES.vision))return {type:'defense',zone,progress:0};
 return null;
}
const defenseTask=r=>r.task?.type==='heavy'?r.task.returnTask:r.task;
const sighting=e=>({x:e.x,y:e.y});
function intactWallGoal(challenge){
 if(!challenge?.required||!['hold','split'].includes(challenge.goal))return null;
 const zones=challenge.goal==='split'?[challenge.zone,challenge.other]:[challenge.zone];
 return zones.some(zone=>challenge.broken.includes(zone))?null:{zones,integrity:challenge.integrity};
}
function wallGoalAtRisk(wall,enemies,wallGoal){
 if(!wallGoal?.zones.includes(wall.id)||wall.hp<=0)return false;
 const damage=enemies.reduce((sum,e)=>sum+(e.zone===wall.id&&e.mode==='attack'&&threat(e)?ENEMIES[e.type].damage:0),0);
 return damage>0&&wall.hp-damage<=wallGoal.integrity;
}
function nearbyRepairWall(b,r){
 const current=r.plan.route[r.index];
 return b.zones.filter(z=>r.plan.route.includes(z.id)&&(z.id===current||distance(r,ZONES.find(q=>q.id===z.id))<=ROBOT_RULES.vision)&&canRepair(b,r,z)&&
  !b.robots.some(q=>active(q)&&q.task?.type==='repair'&&q.task.zone===z.id)).sort((a,c)=>a.hp-c.hp)[0];
}
const fireTaskNames={addWood:'添柴',stoke:'拨火',fire:'重燃'};
function tendFire(b,r,fire,speed,dt,hooks){
 const busy=b.people.some(p=>p.task?.target===fire?.id&&['addWood','stoke','fire','extinguish','clearWet'].includes(p.task?.type))||
  b.robots.some(q=>q!==r&&active(q)&&q.task?.type==='campfire');
 const cost=NIGHT_ACTIONS.costs.addWood.materials;
 let action;
 if(fire&&!busy){
  if(campfireNeedsWood(fire)&&b.resources.materials>=cost&&autoBudgetAvailable(b,'firewood',null,cost))action='addWood';
  else if(fire.wood>0&&fire.heat<CAMPFIRE_HEAT.low)action=fire.heat<=0?'fire':'stoke';
 }
 if(action||r.task?.type==='campfire'){
  const wall=nearbyRepairWall(b,r);
  if(wall){r.task={type:'repair',zone:wall.id,progress:0};return false;}
 }
 if(!action){if(r.task?.type==='campfire')stopTask(r);return false;}
 if(r.task?.action!==action)r.task={type:'campfire',action,target:fire.id,progress:0};
 r.status=`${fireTaskNames[action]} · 中央篝火`;
 if(!moveToward(r,fire,speed,dt,true,b.walkMap))return true;
 r.task.progress+=dt;
 if(r.task.progress+1e-8<NIGHT_ACTIONS.times[action])return true;
 if(action==='addWood'){
  fire.wood=CAMPFIRE_MAX_WOOD;b.resources.materials-=cost;b.supportUsed.firewood+=cost;
  hooks.flow(b,{materials:-cost},`${r.name} · 添柴`,'spend');
 }
 const heat=tendedHeat(fire.heat),gain=heat-fire.heat;fire.heat=heat;
 const text=`${r.name}${fireTaskNames[action]} · 中央篝火`;
 hooks.event(b,'fire',fire.x,fire.y,text,{targetId:fire.id,robotId:r.id,gain,action});
 hooks.note(b,text);stopTask(r);return true;
}
function spikesFinishBeforeArrival(b,wall,enemies,travel,wallGoal){
 if(!wall.hp||!wall.spikes||!enemies.length)return false;
 let damage=0;
 for(const e of enemies){
  // Do not assume passive damage will finish a creature that can leave the wall or trigger a costly ability.
  if(e.mode!=='attack'||e.boss||e.type==='bladebeast'||e.type==='echomantis'||e.type==='burrower'&&!wall.mesh)return false;
  if(e.type==='caller'&&!e.called)return false;
  if(e.type==='quencher'&&(b.challenge?.goal==='cleanFire'||b.fires.some(f=>f.enabled!==false&&f.heat>0)))return false;
  if(e.type==='sporetoad'&&(b.challenge?.goal==='control'||b.people.some(p=>!p.dead&&!isIndoors(b,p))))return false;
  const rate=e.type==='rammer'?COMBAT.spikes.rammerDamage:COMBAT.spikes.damage;
  const lifetime=e.hp/rate+(e.stun||0);
  if(lifetime>=travel)return false;
  const def=ENEMIES[e.type];
  damage+=Math.ceil(lifetime/def.interval)*def.damage;
 }
 const floor=wallGoal?.zones.includes(wall.id)?wallGoal.integrity:0;
 return wall.hp-damage>floor;
}
function dispatchJob(b,signal,enemies,intruders,wallGoal){
 const wall=b.zones.find(z=>z.id===signal.zone);
 if(signal.type==='defense'){
  const low=wall.hp<=ROBOT_RULES.reinforcement.wallHp;
  const threats=enemies.filter(e=>e.zone===signal.zone);
  if(wall.hp>0&&threats.length>0&&wall.traps>=threats.length&&threats.every(e=>!e.boss&&e.mode==='approach'&&e.hp<=COMBAT.trap.damage))return null;
  const assigned=b.robots.filter(q=>{
   const t=defenseTask(q);
   return active(q)&&t?.type==='defense'&&t.zone===signal.zone;
  }).length;
  const attackers=threats.filter(e=>e.mode==='attack'||e.mode==='inside');
  const {enemyCount,maxWorkers}=ROBOT_RULES.reinforcement;
  const pressure=attackers.length>=enemyCount||attackers.length>0&&low;
  if(assigned>=(pressure?maxWorkers:1))return null;
  const intruder=intruders.get(signal.zone);
  // A round of unopposed hits can jeopardize a required fence before its first breach.
  const fenceEmergency=wallGoalAtRisk(wall,attackers,wallGoal);
  const houseEmergency=wallGoal&&assigned===0&&intruder?.attackTarget?.id==='house'&&b.house<=ROBOT_RULES.dispatchHouseEmergencyHp;
  const priority=houseEmergency?9:fenceEmergency?8:assigned>0?3:intruder?7:attackers.length>0?(low?6:5):4;
  return {signal,wall,priority,reinforcement:assigned>0,intruder,threats};
 }
 if(b.robots.some(q=>active(q)&&q.task?.type===signal.type&&(signal.type==='robot-repair'?q.task.robotId===signal.robotId:q.task.zone===signal.zone)))return null;
 const target=signal.type==='robot-repair'?b.robots.find(q=>q.id===signal.robotId):null;
 const priority=signal.type==='repair'?(wallGoalAtRisk(wall,enemies,wallGoal)?4:2):target?.type==='defense'&&target.hp<=0&&target.enabled&&target.powered?3:1;
 return {signal,wall,priority,target};
}
function dispatch(b,r,dt,hooks,wallGoal){
 const enemies=b.enemies.filter(threat),signals=(r.signals||[]).filter(signal=>signal.until>b.elapsed);
 const intruders=new Map();
 for(const e of enemies){
  if(distance(r,e)>ROBOT_RULES.dispatchVision)continue;
  signals.push({type:'defense',zone:e.zone,source:'视野'});
  if(e.mode==='inside'&&(!intruders.has(e.zone)||e.attackTarget?.id==='house'))intruders.set(e.zone,e);
 }
 // An assigned defender can use a fresh position report while the dispatcher sees the intruder.
 for(const q of b.robots){
  const t=defenseTask(q);
  if(t?.type==='defense'&&t.dispatcher===r.id&&intruders.has(t.zone))t.sighting=sighting(intruders.get(t.zone));
 }
 for(const target of b.robots)if(target.hp<ROBOT_RULES.hp&&distance(r,target)<=ROBOT_RULES.dispatchVision)signals.push({type:'robot-repair',zone:robotZone(target),robotId:target.id,source:'视野'});
 for(const z of b.zones)if(distance(r,ZONES.find(q=>q.id===z.id))<=ROBOT_RULES.dispatchVision&&z.hp<100)signals.push({type:'repair',zone:z.id,source:'视野'});
 for(const ev of b.events){
  if(ev.id<=r.lastHeard)continue;
  if(!['warning','bell','breach','dog-bark'].includes(ev.type)||!ev.zone)continue;
  if(ev.type!=='bell'&&distance(r,ev)>ROBOT_RULES.hearing)continue;
  r.lastSignal={at:b.elapsed,zone:ev.zone,kind:ev.type,point:{x:ev.x,y:ev.y}};
  const type=ev.type==='breach'?'repair':'defense';
  signals.push({until:b.elapsed+ROBOT_RULES.signalMemory,type,zone:ev.zone,source:ev.type==='bell'?'铃绳':ev.type==='dog-bark'?'犬吠':'预警声',enemyId:type==='defense'?ev.enemyId:undefined});
 }
 const current=signals.filter(s=>!s.enemyId||enemies.some(e=>e.id===s.enemyId&&e.zone===s.zone));
 const unique=current.filter((s,i,all)=>all.findIndex(q=>q.type===s.type&&q.zone===s.zone&&q.robotId===s.robotId&&q.enemyId===s.enemyId)===i);
 r.lastHeard=b.eventSeq;r.signals=unique.filter(s=>s.until).slice(-10);
 if(r.dispatchCooldown>0)return;
 const jobs=unique.filter((s,i,all)=>r.plan.route.includes(s.zone)&&all.findIndex(q=>q.type===s.type&&q.zone===s.zone&&q.robotId===s.robotId)===i)
  .map(s=>dispatchJob(b,s,enemies,intruders,wallGoal)).filter(Boolean).sort((a,c)=>c.priority-a.priority);
 for(const {signal,wall,target,intruder,reinforcement,threats} of jobs){
  const geometry=ZONES.find(z=>z.id===signal.zone),workerType=signal.type==='robot-repair'?'repair':signal.type;
  const candidates=b.robots.filter(q=>active(q)&&q.type===workerType&&q.plan.acceptDispatch&&q.plan.route.includes(signal.zone)&&(!q.task||signal.type==='repair'&&q.task.type==='campfire'));
  const limit=ROBOT_RULES.assignmentSeconds-(workerType==='repair'?ROBOT_RULES.repairSeconds:0);
  const range=target?ROBOT_RULES.robotRepairRange:intruder?ROBOT_RULES.strikeRange:null;
  const speed=robotMoveSpeed(b,workerType);
  let worker,travel=Infinity;
  for(const candidate of candidates){
   if(workerType==='repair'&&!(signal.type==='robot-repair'?canRepairRobot(b,candidate,target):canRepair(b,candidate,wall)))continue;
   const eta=walkTravelTime(candidate,target||intruder||point(geometry,candidate),speed,dt,limit,b.walkMap,range);
   if(eta<travel){worker=candidate;travel=eta;}
  }
  if(!worker||threats&&spikesFinishBeforeArrival(b,wall,threats,travel,wallGoal))continue;
  worker.task={type:signal.type,zone:signal.zone,progress:0,dispatcher:r.id,until:b.elapsed+ROBOT_RULES.assignmentSeconds,...(target?{robotId:target.id}:{}),...(intruder?{sighting:sighting(intruder)}:{})};worker.wait=0;
  worker.status=`响应调度 · ${target?`修理${target.name}`:ZONES.find(z=>z.id===signal.zone).name}`;
  r.dispatchCooldown=ROBOT_RULES.dispatchCooldown;r.dispatches++;r.signals=r.signals.filter(s=>s.zone!==signal.zone||s.type!==signal.type||s.robotId!==signal.robotId);
  const text=`${r.name}凭${signal.source}调度${worker.name}${target?`前去修理${target.name}`:`${reinforcement?'增援':'前往'}${ZONES.find(z=>z.id===signal.zone).name}`}`;
  hooks.event(b,'robot-dispatch',r.x,r.y,text,{zone:signal.zone,robotId:worker.id,dispatcherId:r.id,signal:signal.source,job:signal.type,travel,...(reinforcement?{reinforcement:true}:{}),...(target?{targetRobotId:target.id}:{}),source:{x:r.x,y:r.y},target:{x:worker.x,y:worker.y}});hooks.note(b,text);return;
 }
}
export function stepRobots(b,dt,hooks){
 const fire=b.fires.find(f=>f.id==='central'&&f.enabled!==false),wallGoal=intactWallGoal(b.challenge);
 for(const r of b.robots||[])delete r.servicedBy;
 for(const r of b.robots||[]){
  r.heavyCooldown=Math.max(0,(r.heavyCooldown||0)-dt);r.cooldown=Math.max(0,r.cooldown-dt);r.dispatchCooldown=Math.max(0,r.dispatchCooldown-dt);
  if(!active(r)){r.status=r.hp<=0?'损坏待修':r.status;stopTask(r);continue;}
  const repairer=b.robots.find(q=>active(q)&&q.task?.type==='robot-repair'&&q.task.robotId===r.id&&canRepairRobot(b,q,r)&&distance(q,r)<=ROBOT_RULES.robotRepairRange);
  if(repairer){r.servicedBy=repairer.id;r.status=`接受${repairer.name}维修`;continue;}
  if(r.type==='dispatch')dispatch(b,r,dt,hooks,wallGoal);
  if(r.task?.until<=b.elapsed)stopTask(r);
  const speed=robotMoveSpeed(b,r.type);
  if(r.type==='repair'&&(!r.task||r.task.type==='campfire')){
   if(!r.task)r.task=localTask(b,r);
   if((!r.task&&fire||r.task?.type==='campfire')&&tendFire(b,r,fire,speed,dt,hooks))continue;
  }
  if(!r.task&&r.type==='defense')r.task=localTask(b,r);
  const t=r.task;
  if(t){
   const z=b.zones.find(z=>z.id===t.zone),geometry=ZONES.find(z=>z.id===t.zone);
   if(t.type==='robot-repair'){
    const target=b.robots.find(q=>q.id===t.robotId);
    if(!canRepairRobot(b,r,target)){stopTask(r);continue;}
    r.status=`${t.dispatcher?'调度 · ':''}${distance(r,target)>ROBOT_RULES.robotRepairRange?'靠近维修':'修理机体'} · ${target.name}`;
    if(distance(r,target)>ROBOT_RULES.robotRepairRange){t.progress=0;moveToward(r,target,speed,dt,true,b.walkMap);continue;}
    t.progress+=dt;
    if(t.progress+1e-8>=ROBOT_RULES.repairSeconds){
     const gain=Math.min(ROBOT_RULES.hp-target.hp,ROBOT_RULES.repairGain),broken=target.hp<=0;
     target.hp+=gain;b.resources.parts-=ROBOT_RULES.robotRepairCost;r.partsUsed=(r.partsUsed||0)+ROBOT_RULES.robotRepairCost;
     (b.robotRepairs??=[]).push({repairerId:r.id,targetId:target.id,gain});
     const text=`${r.name}修理${target.name} +${Number(gain.toFixed(2))}耐久`;
     hooks.flow(b,{parts:-ROBOT_RULES.robotRepairCost},`${r.name} · 修理机体`,'spend');hooks.event(b,'robot-repair',target.x,target.y,text,{zone:t.zone,gain,robotId:r.id,targetRobotId:target.id,source:{x:r.x,y:r.y}});hooks.note(b,text);
     if(broken)target.status=target.enabled&&target.powered?'维修后恢复运行':'机体已修复 · 等待供油或启用';
     stopTask(r);
    }
    continue;
   }
   r.status=`${t.dispatcher?'调度 · ':''}${t.type==='repair'?'修补':'防卫'}${geometry.name}`;
   if(t.type==='heavy'){
    const e=b.enemies.find(e=>e.id===t.enemyId&&livingTarget(e));
    if(!e){r.task=t.returnTask||null;continue;}
    r.status=`蓄力重击 · ${geometry.name}`;
    if(!approachHeavy(b,r,e,speed,dt,ROBOT_RULES.strikeRange)){t.progress=0;continue;}
    t.progress+=dt;
    if(t.progress+1e-8>=ROBOT_RULES.heavySeconds){hooks.heavy?.(b,{...r,robot:true},e);r.heavyCooldown=ROBOT_RULES.heavyCooldown;r.cooldown=.6;r.task=t.returnTask||null;}
    continue;
   }
   if(t.type==='repair'){
    if(!canRepair(b,r,z)){stopTask(r);continue;}
    if(!moveToward(r,point(geometry,r),speed,dt,true,b.walkMap)){r.status=`${t.dispatcher?'调度 · ':''}赶往${geometry.name}维修`;continue;}
    t.progress+=dt;
    if(t.progress+1e-8>=ROBOT_RULES.repairSeconds){
     // Spend only when the operation completes; canceled work never reserves materials.
     const gain=Math.min(z.max-z.hp,ROBOT_RULES.repairGain);z.hp+=gain;b.resources.materials-=ROBOT_RULES.repairCost;r.materialsUsed+=ROBOT_RULES.repairCost;
     hooks.flow(b,{materials:-ROBOT_RULES.repairCost},`${r.name} · 修补`,'spend');hooks.event(b,'repair',r.x,r.y,`${r.name} +${Number(gain.toFixed(2))}耐久`,{zone:z.id,gain,robotId:r.id});stopTask(r);
    }
   }else{
    const enemies=b.enemies.filter(e=>threat(e)&&e.zone===t.zone&&distance(r,e)<=ROBOT_RULES.vision).sort((a,c)=>Number(!!windupInfo(b,c))-Number(!!windupInfo(b,a))||distance(r,a)-distance(r,c));
    const e=enemies[0];
    if(!e){
     if(t.sighting&&distance(r,t.sighting)>ROBOT_RULES.strikeRange){
      if(moveToward(r,t.sighting,speed,dt,true,b.walkMap))delete t.sighting;
      continue;
     }
     delete t.sighting;
     if(t.dispatcher&&distance(r,point(geometry,r))>12)moveToward(r,point(geometry,r),speed,dt,true,b.walkMap);
     else if(t.engaged||(t.progress+=dt)>=ROBOT_RULES.dispatchWait)stopTask(r);
     continue;
    }
    t.engaged=true;if(distance(r,e)>ROBOT_RULES.strikeRange)moveToward(r,e.mode==='inside'?e:point(geometry,r),speed,dt,true,b.walkMap);
    if(distance(r,e)<=ROBOT_RULES.strikeRange&&r.heavyCooldown<=0&&e.stun<=0&&windupInfo(b,e)&&!pendingHeavy(b,e.id,r.id)){
     r.task={type:'heavy',zone:e.zone,enemyId:e.id,progress:0,returnTask:t};r.status='准备蓄力重击';continue;
    }
    if(distance(r,e)<=ROBOT_RULES.strikeRange&&r.cooldown<=0){hooks.strike(b,r,e);r.cooldown=ROBOT_RULES.strikeSeconds;}
   }
   continue;
  }
  r.status='按路线巡逻';const target=point(ZONES.find(z=>z.id===r.plan.route[r.index]),r);
  if(moveToward(r,target,speed,dt,true,b.walkMap)){r.wait+=dt;if(r.wait>=r.plan.wait){r.index=(r.index+1)%r.plan.route.length;r.wait=0;}}
 }
}
