export const ENEMY_IMPACT_LIFE=.62;
export function enemyImpactFrame(event,t,reduced=false){
 const age=t-event.time;
 if(age<0||age>ENEMY_IMPACT_LIFE)return null;
 const envelope=Math.max(0,1-age/ENEMY_IMPACT_LIFE);
 const pulse=Math.sin(Math.min(1,age/.3)*Math.PI);
 return {age,alpha:envelope,flash:age<.24,
  lunge:reduced?0:pulse*(event.heavy?7:5),
  recoil:reduced?0:Math.sin(age*34)*envelope*(event.heavy?4:2.5),
  shake:reduced?0:Math.sin(age*48)*envelope*(event.heavy?3:1.8)};
}
export function latestStructureImpact(b,id,t,reduced=false){
 const event=b?.events?.findLast(e=>e.type==='enemy-hit'&&e.targetId===id&&e.targetKind!=='person');
 const frame=event&&enemyImpactFrame(event,t,reduced);
 return frame?{...frame,event}:null;
}
