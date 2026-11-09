import {PHASE_CREATURE_RULES as R,creatureAfterBoss} from './phase-creatures.js';
import {ZONES,ENEMIES} from './content.js';
import {COMBAT} from './balance.js';
import {isIndoors} from './shelter.js';
import {worldPoint,artPoint} from './yard-geometry.js';
import {moveToward} from './movement.js';
import {skitterDetour} from './skitter.js';
import {stepLeap,leapFrame,resetLeap} from './creature-leap.js';
const adjacentZones=['gate','left','backLeft','backRight','right'];

function exposeShell(b,e,person,emit,flankSources=null){
 const closed=!(e.shellExposedUntil>b.elapsed);e.shellExposedUntil=b.elapsed+R.exposed;
 if(closed){e.shellOpenedAt=b.elapsed;emit?.(b,'shell-break',e.x,e.y,'甲壳张开 · 弱点暴露',{enemyId:e.id,zone:e.zone,source:person&&{x:person.x,y:person.y},flankSources});}
}
export function phaseCreatureDamage(b,e,damage,kind,person=null,emit=null){
 if(e.type!=='shellcrab')return damage;
 if(kind==='throw'||kind==='heavy'){exposeShell(b,e,person,emit);return damage;}
 if(kind!=='strike')return damage;
 if(person){
  const angle=Math.atan2(person.y-e.y,person.x-e.x),last=e.shellStrike;
  const difference=last?Math.abs(Math.atan2(Math.sin(angle-last.angle),Math.cos(angle-last.angle)))*180/Math.PI:0;
  if(last&&b.elapsed-last.time<=R.flankMemory&&difference>=R.flankAngle)exposeShell(b,e,person,emit,[last.point,{x:person.x,y:person.y}].filter(Boolean));
  e.shellStrike={angle,time:b.elapsed,point:{x:person.x,y:person.y}};
 }
 if(!(e.shellExposedUntil>b.elapsed))emit?.(b,'armor-hit',e.x,e.y,'厚甲弹开',{enemyId:e.id,zone:e.zone,source:person&&{x:person.x,y:person.y}});
 return damage*(e.shellExposedUntil>b.elapsed?1:R.armor);
}
export function interruptPhaseCreature(b,e,emit){
 const frame=leapFrame(e);if(!frame){if(e.leap)resetLeap(e);return;}resetLeap(e);
 emit(b,'leap-cancel',frame.point.x,frame.point.y,'蓄跳被打断',{enemyId:e.id,zone:e.zone,height:frame.height,from:frame.point,to:{x:e.x,y:e.y}});
}

// Called before ordinary movement/attacks; only the mantis owns a travel phase.
export function phaseCreatureTravel(b,e,dt,emit){
 if(e.type!=='echomantis'||e.mode==='inside')return false;
 if(!e.echoShifted&&e.hp<=e.max*R.shiftRatio){
  e.echoShifted=true;e.echoShiftAt=b.elapsed;e.echoFromZone=e.zone;e.echoTrail=[];const index=adjacentZones.indexOf(e.zone);
  e.zone=adjacentZones[(index+1)%adjacentZones.length];e.mode='approach';e.progress=e.attack=0;
  e.echoPath=skitterDetour(artPoint(e),e.zone).map(worldPoint);
  emit(b,'weakpoint',e.x,e.y,`回声转场 · ${ZONES.find(z=>z.id===e.zone).name}`,{enemyId:e.id,zone:e.zone,creature:'echomantis',fromZone:e.echoFromZone});
 }
 if(e.echoPath?.length){
  if(!e.echoTrail.length||b.elapsed-e.echoTrail.at(-1).time>=.12){e.echoTrail.push({x:e.x,y:e.y,time:b.elapsed});e.echoTrail=e.echoTrail.slice(-6);}
  if(moveToward(e,e.echoPath[0],ENEMIES.echomantis.speed,dt))e.echoPath.shift();return true;
 }
 return false;
}
export function phaseCreatureAttack(b,e,z,dt,emit){
 if(e.type==='bladebeast'){
  const before=!!e.leap;
  if(stepLeap(e,ZONES.find(q=>q.id===e.zone),dt,z.mesh?COMBAT.meshClimbFactor:1,b.walkMap)){
   const from=e.leap?.from,landing=e.leap?.to||{x:e.x,y:e.y};e.leapLanding={from,to:landing};e.mode='inside';delete e.leap;
   emit(b,'vault',landing.x,landing.y,'镰足落地 · 跃入院内',{enemyId:e.id,zone:e.zone,creature:'bladebeast',from});
  }else if(!before&&e.leap)emit(b,'leap-ready',e.x,e.y,'镰足压身 · 即将起跳',{enemyId:e.id,zone:e.zone,to:e.leap.to});
 }
}
// This ability belongs to the animal, not to wall attacks. Tick it once per
// simulation step on both sides of a breach; changing mode must not cancel it
// or count the breaking-wall step twice.
export function stepSporeAbility(b,e,dt,emit){
 if(b.paused||e.hp<=0||e.stun>0||e.type!=='sporetoad'||!['attack','inside'].includes(e.mode))return;
 e.progress+=dt;if(e.progress+1e-8<R.spores)return;
 e.progress=0;
 const victims=b.people.filter(p=>!p.dead&&!isIndoors(b,p)&&Math.hypot(p.x-e.x,p.y-e.y)<=R.sporeRadius);
 const targets=victims.map(p=>{
  const stamina=p.stamina,fear=p.fear;p.stamina=Math.max(0,stamina-R.sporeStamina);p.fear=Math.min(100,fear+R.sporeFear);
  return {id:p.id,name:p.name,x:p.x,y:p.y,staminaLoss:stamina-p.stamina,fearGain:p.fear-fear};
 });
 if(b.challenge)b.challenge.sporeBursts=(b.challenge.sporeBursts||0)+1;
 emit(b,'spores',e.x,e.y,`孢雾 · ${victims.length}人受影响`,{enemyId:e.id,zone:e.zone,people:victims.map(p=>p.id),targets});
}
export function releaseBossFollower(b,emit,note){
 if(!b.boss?.defeated||b.boss.followerReleased)return;
 const type=creatureAfterBoss(b.day);if(!type)return;
 b.boss.followerReleased=true;b.schedule.push({at:b.elapsed+3,type,zone:b.boss.zone});b.schedule.sort((a,c)=>a.at-c.at);
 const message='首领退去，新的生物正沿足迹接近。还有一场遭遇，留意首次发现提示。';note(b,message);
 const z=ZONES.find(z=>z.id===b.boss.zone);emit(b,'warning',z.x,z.y,message,{zone:z.id});
}
