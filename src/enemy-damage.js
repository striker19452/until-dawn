// Damage is continuous; cadence controls only the visible contact animation.
// Fast species trade individual danger for mobility. Heavy bodies hit harder.
export const ENEMY_DAMAGE={
 walker:{person:1.2,style:'claw',cadence:.8},
 climber:{person:1.6,style:'claw',cadence:.65},
 rammer:{person:3,style:'slam',cadence:1.2},
 caller:{person:.6,style:'claw',cadence:.95},
 burrower:{person:1.8,style:'bite',cadence:.85},
 quencher:{person:.9,style:'bite',cadence:1},
 skitter:{person:.6,style:'bite',cadence:.55},
 bladebeast:{person:1.8,style:'claw',cadence:.6},
 shellcrab:{person:2.4,style:'slam',cadence:1.1},
 sporetoad:{person:.9,style:'bite',cadence:.9},
 echomantis:{person:2.1,style:'claw',cadence:.6},
 bastion:{person:4.8,style:'slam',cadence:1.2},
 broodmother:{person:2.4,style:'bite',cadence:1},
 cinderwhale:{person:3,style:'slam',cadence:1.1},
 twinvein:{person:3.6,style:'claw',cadence:.8}
};
export function enemyDamageProfile(enemy){
 if(enemy.bossBrood)return {person:1.2,style:'bite',cadence:.65};
 if(enemy.type==='twinvein'&&enemy.bossForm>0)return {...ENEMY_DAMAGE.twinvein,person:2.4,cadence:.65};
 return ENEMY_DAMAGE[enemy.type]||ENEMY_DAMAGE.walker;
}

// Called only after real damage. Never predicts a hit while travelling, stunned
// or out of range. A changed victim gets its own immediate impact.
export function enemyDamageFeedback(b,e,target,damage,emit,damageRate=null){
 if(!(damage>0))return;
 const profile=enemyDamageProfile(e),key=target.kind+':'+target.id;
 const previous=e.damageFeedback;
 if(damageRate!==null&&previous?.key===key&&b.elapsed-previous.time<profile.cadence-1e-8)return;
 e.damageFeedback={key,time:b.elapsed};
 const text=target.kind==='person'?`${target.name}受袭 · ${Number(damageRate.toFixed(2))}健康/秒`:'';
 emit('enemy-hit',target.x,target.y,text,{
  enemyId:e.id,enemyType:e.type,source:{x:e.x,y:e.y},
  targetKind:target.kind,targetId:target.id,targetName:target.name,
  style:profile.style,damage,damageRate,heavy:profile.style==='slam'
 });
}
