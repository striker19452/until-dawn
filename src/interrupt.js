import {STRIKE_RANGE} from './rules.js';
import {ENEMIES,ENEMY_WINDUP,ZONES} from './content.js';
import {COMBAT,BOSS_RULES} from './balance.js';
import {PHASE_CREATURE_RULES} from './phase-creatures.js';
import {campfireActive} from './campfire.js';
import {fatigueEffects} from './fatigue.js';
import {orderDuration} from './night-orders.js';
import {approachHeavy,heavyInRange,pendingHeavy,livingTarget} from './heavy-strike.js';
import {ROBOT_RULES,robotMoveSpeed} from './robots.js';
import {isIndoors,HOUSE_DOOR} from './shelter.js';

// Only actions that a heavy strike can actually reset count as windups.
export function windupInfo(b,e){
 if(!b||b.finished||!e||e.hp<=0||!(e.mode==='attack'||e.type==='sporetoad'&&e.mode==='inside')||e.bossDormant)return null;
 let left=null;const z=b.zones.find(z=>z.id===e.zone);if(!z)return null;
 if(e.boss){
  if(e.type==='bastion'&&b.boss?.phase==='charge')left=BOSS_RULES.bastion.charge-b.boss.clock;
  if(e.type==='cinderwhale'&&b.boss?.phase==='siphon')left=BOSS_RULES.cinder.siphon-b.boss.clock;
 }else if(e.type==='rammer'&&e.attack>0)left=ENEMIES.rammer.interval-e.attack;
 else if(e.progress>0){
  if(e.type==='caller'&&!e.called)left=ENEMY_WINDUP.call-e.progress;
  if(e.type==='quencher')left=ENEMY_WINDUP.spray-e.progress;
  if(e.type==='sporetoad')left=PHASE_CREATURE_RULES.spores-e.progress;
  if(e.type==='bladebeast')left=(PHASE_CREATURE_RULES.leap-e.progress)/(z.mesh?COMBAT.meshClimbFactor:1);
  if(e.type==='climber'&&!z.spikes)left=(ENEMY_WINDUP.climb-e.progress)/((z.mesh?COMBAT.meshClimbFactor:1)*(campfireActive(b)?COMBAT.fire.climbFactor:1));
  if(e.type==='burrower'&&!z.mesh)left=(ENEMY_WINDUP.dig-e.progress)/(z.compacted?COMBAT.compact.factor:1);
 }
 return left===null?null:{left:Math.max(0,left)+Math.max(0,e.stun||0),zone:e.zone};
}
function travelTime(b,p,e,robot=false){
 const at=!robot&&isIndoors(b,p)?{...HOUSE_DOOR}:{x:p.x,y:p.y};
 const speed=robot?robotMoveSpeed(b,p.type):43*fatigueEffects(p.fatigue).movement,range=robot?ROBOT_RULES.strikeRange:STRIKE_RANGE;
 if(heavyInRange(at,e,range))return 0;
 for(let tick=1;tick<=1200;tick++)if(approachHeavy(b,at,e,speed,.05,range))return tick*.05;
 return Infinity;
}
export function planInterrupt(b,enemyId,personId=null){
 const e=b?.enemies.find(e=>e.id===enemyId),windup=windupInfo(b,e);
 const reject=reason=>({allowed:false,reason});
 if(personId!==null){
  if(!b||b.finished)return reject('夜战已经结束。');
  if(!livingTarget(e))return reject('目标已离场或正在退却，暂时无法重击。');
  const p=b.people.find(p=>p.id===personId&&!p.dead);if(!p)return reject('所选成员已不在场。');
  if(p.wound==='severe')return reject(`${p.name}重伤，需要先急救。`);
  if(p.stamina<COMBAT.heavy.stamina)return reject(`${p.name}体力不足，重击需要${COMBAT.heavy.stamina}体力。`);
  const cooldown=b.heavyCooldowns?.[p.id]||0;if(cooldown>0)return reject(`${p.name}重击冷却中，还需${cooldown.toFixed(1)}秒。`);
  if(pendingHeavy(b,e.id))return reject('已有成员准备重击这个目标，无需重复派遣。');
  const travel=travelTime(b,p,e);if(!Number.isFinite(travel))return reject(`${p.name}当前无法靠近这个目标，请调整站位。`);
  const eta=travel+orderDuration(p,'heavy',b.aidKit);
  return {allowed:true,person:p.id,kind:'person',explicit:true,enemyId:e.id,zone:e.zone,travel,eta,left:windup?.left??null,late:!!windup&&eta>=windup.left};
 }
 if(!windup)return reject('这只生物当前没有可打断的蓄力；先选中成员，再点生物可指定重击。');
 if(pendingHeavy(b,e.id))return reject('已有成员准备重击这个目标，无需重复派遣。');
 const people=b.people.filter(p=>!p.dead&&p.wound!=='severe'&&p.nightRole!=='sleep'&&!b.fearRetreats?.[p.id]&&(!p.task||p.task.type==='guard')&&p.stamina>=COMBAT.heavy.stamina&&(b.heavyCooldowns?.[p.id]||0)<=0)
  .map(p=>({person:p.id,kind:'person',eta:travelTime(b,p,e)+orderDuration(p,'heavy',b.aidKit)}));
 const robots=(b.robots||[]).filter(r=>r.type==='defense'&&r.enabled&&r.powered===true&&r.hp>0&&(r.heavyCooldown||0)<=0&&r.plan.acceptDispatch&&r.plan.route.includes(e.zone)&&(!r.task||r.task.type==='defense'))
  .map(r=>({person:r.id,kind:'robot',eta:travelTime(b,r,e,true)+ROBOT_RULES.heavySeconds}));
 const candidates=[...people,...robots].filter(p=>Number.isFinite(p.eta)).sort((a,c)=>a.eta-c.eta||a.person.localeCompare(c.person));
 if(!candidates.length)return reject('暂无可派成员：需要体力充足且重击已冷却的人物，或已供油、路线覆盖此处的防卫机器人。');
 const best=candidates[0];return {allowed:true,...best,enemyId:e.id,zone:e.zone,left:windup.left,late:best.eta>=windup.left};
}
