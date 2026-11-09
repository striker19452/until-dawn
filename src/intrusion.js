import {COMBAT} from './balance.js';
import {BUILDINGS} from './content.js';
import {PLOTS} from './yard-geometry.js';
import {nearestWalkablePoint,moveToward} from './movement.js';
import {HOUSE_DOOR} from './shelter.js';
import {formatDurability} from './format.js';
import {buildingHealth,buildingOperational,buildingPlot,upgradedWatchtower} from './building-health.js';
import {enemyDamageFeedback} from './enemy-damage.js';

// Choose once and keep the destination until destroyed. All random draws use
// the battle's seeded generator, so pause and render frequency cannot reroll it.
export function intrusionStep(b,e,dt,speed,factor,random,emit,note){
 const candidates=[...(b.house>0?[{id:'house',name:'小屋',point:HOUSE_DOOR}]:[]),
  ...(b.buildings||[]).flatMap((building,i)=>buildingOperational(building)&&PLOTS[buildingPlot(building,i)]?[{id:building.id,name:BUILDINGS[building.type].name,building,point:PLOTS[buildingPlot(building,i)]}]:[])];
 let target=candidates.find(t=>t.id===e.targetId);
 if(!target){
  const reachable=candidates.map(t=>({...t,point:nearestWalkablePoint(t.point,b.walkMap,e)})).filter(t=>t.point);
  if(!reachable.length)return;
  target=reachable.find(t=>upgradedWatchtower(t.building))||reachable[Math.min(reachable.length-1,Math.floor(random()*reachable.length))];
  e.targetId=target.id;e.targetName=target.name;e.targetPoint=target.point;delete e.lastHit;
  note(`${e.targetName}被${e.typeName}盯上了。`);
 }
 e.attackTarget={kind:'structure',id:target.id,name:target.name};
 const point=e.targetPoint||target.point;
 moveToward(e,point,speed,dt,true,b.walkMap);
 if(Math.hypot(e.x-point.x,e.y-point.y)>=25)return;
 const before=target.building?buildingHealth(target.building):b.house;
 const rate=COMBAT.houseDamage*(e.boss||e.bossBrood?COMBAT.bossHouseFactor:1)*factor;
 const hp=Math.max(0,before-dt*rate),damage=before-hp;
 if(target.building)target.building.hp=hp;else b.house=hp;
 if(damage>0)e.lastAttackAt=b.elapsed;
 enemyDamageFeedback(b,e,{kind:'structure',id:target.id,name:target.name,...point},damage,emit,rate);
 if(hp===0||e.lastHit===undefined||b.elapsed-e.lastHit>=2){
  e.lastHit=b.elapsed;
  emit(hp===0&&target.building?'destroyed':'hit',point.x,point.y,hp===0?`${target.name}已损毁`:`${target.name}受袭 · ${formatDurability(rate)}/秒`,{targetId:target.id,targetName:target.name,enemyId:e.id,hp,damage,damageRate:rate});
 }
 if(hp===0&&target.building)note(`${target.name}耐久归零，已停止生效。白天可原址重建或清理废墟。`);
}
