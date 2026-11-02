// One plan drives both the campaign action and the before-departure preview.
export function escortBenefits(value=0){
 const skilled=value>=2;
 return {primary:2+(skilled?1:0),secondary:1,injuryChance:skilled?5:10,injuryDamage:8,fatigue:10};
}

export function searchPlan(site,{deep=false,escort=null,day=2,exposure=0}={}){
 const bonus=escort?escortBenefits(escort.skills.exploration):null;
 const loot=Object.fromEntries(Object.entries(site.loot).map(([key,n],i)=>[
  key,n+(deep?(i===0?n:1):0)+(bonus?(i===0?bonus.primary:bonus.secondary):0)
 ]));
 return {loot,ap:deep?3:2,exposure:deep?Math.min(1,6-exposure):0,
  fatigue:bonus?.fatigue||0,injuryChance:deep&&day>1?(bonus?.injuryChance??20):0,
  injuryDamage:deep?(bonus?.injuryDamage??12):0};
}

export function searchInjury(seed,day,siteId,plan){
 // The roll depends only on this outing, never on clicks or the escort's identity.
 // Lowering the threshold with an escort can only prevent an existing injury.
 let hash=2166136261;
 for(const c of `${seed}:${day}:${siteId}`)hash=Math.imul(hash^c.charCodeAt(0),16777619);
 hash^=hash>>>16;hash=Math.imul(hash,0x7feb352d);hash^=hash>>>15;
 return (hash>>>0)%100<plan.injuryChance;
}
