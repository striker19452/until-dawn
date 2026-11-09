import {ZONES} from '../src/content.js';
import {ENEMY_IMPACT_LIFE} from './enemy-impact.js';

export const SPRAY_FACING_SECONDS=1.1;
export const facingFlip=(baseFacing,facing)=>baseFacing===-1?facing>0:facing<0;
export function facingToward(from,target,previous=1){
 return target&&Math.abs(target.x-from.x)>2?(target.x>from.x?1:-1):previous;
}
const aim=(point,kind,id,reason)=>point?{x:point.x,y:point.y,kind,id,reason}:null;
function targetPoint(b,target){
 if(target.kind==='person')return [...b.people,...(b.robots||[])].find(p=>p.id===target.id&&!p.dead&&p.hp!==0&&!b.indoorPeople?.[p.id]);
 if(target.kind==='fire')return b.fires.find(f=>f.id===target.id);
 if(target.kind==='fence'){
  const z=ZONES.find(z=>z.id===target.id);
  // Wall-contact coordinates coincide with the feet. Aim just into the yard
  // so a creature on either side of the wall looks toward the actual surface.
  return z&&{x:z.x+(240-z.x)*.15,y:z.y+(350-z.y)*.15};
 }
 return null;
}

// Render-only intent. Resolve before choosing mirrored origins, boss poses,
// mouth anchors and occlusion masks; effects must never flip a body afterward.
export function creatureActionAim(b,e,t=b?.elapsed||0){
 if(!b||e.hp<=0||e.bossDormant)return null;
 const shot=b.events.findLast(v=>v.type==='wet'&&v.enemyId===e.id&&t>=v.time&&t-v.time<=SPRAY_FACING_SECONDS);
 if(shot)return aim(shot,'fire',shot.targetId,'spray');
 if(e.stun>0||e.boss&&b.boss?.phase==='exposed')return null;
 const hit=b.events.findLast(v=>v.type==='enemy-hit'&&v.enemyId===e.id&&t>=v.time&&t-v.time<=ENEMY_IMPACT_LIFE);
 if(hit){const point=targetPoint(b,{kind:hit.targetKind,id:hit.targetId})||hit;return aim(point,hit.targetKind,hit.targetId,'impact');}
 if(e.type==='cinderwhale'&&e.mode==='attack'&&b.boss?.phase==='siphon'){
  const fire=b.fires.find(f=>f.id==='central');return aim(fire,'fire',fire?.id,'siphon');
 }
 if(e.mode==='inside'){
  const target=e.attackTarget;
  if(target?.kind==='person')return aim(targetPoint(b,target),'person',target.id,'melee');
  if(target?.kind==='structure'&&e.targetPoint&&Math.hypot(e.x-e.targetPoint.x,e.y-e.targetPoint.y)<25)return aim(e.targetPoint,'structure',target.id,'demolish');
  return null;
 }
 if(e.leap&&e.mode==='attack')return aim(e.leap.to,'ground',e.zone,'leap');
 if(e.burrow&&e.mode==='attack')return aim(e.burrow.to,'ground',e.zone,'burrow');
 if(e.mode==='attack'){
  if(e.type==='quencher'&&e.progress>0){const fire=b.fires.find(f=>f.id==='central');if(fire)return aim(fire,'fire',fire.id,'spray-windup');}
  return aim(targetPoint(b,{kind:'fence',id:e.zone}),'fence',e.zone,'wall');
 }
 return null;
}
