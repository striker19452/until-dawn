import {EXPOSURE} from './balance.js';
export const SEARCH_RULES={skill:2,escortPrimary:2,escortSkilledBonus:1,escortSecondary:1,escortInjury:10,escortSkilledInjury:5,escortDamage:8,escortFatigue:10,deepInjury:20,deepDamage:12,fogInjuryBonus:30,quickAP:2,deepAP:3,deepPrimaryFactor:2,deepSecondary:1,deepExposure:1,safeDay:1};
const weatherInjuryChance=(base,weather)=>Math.min(100,base+(weather==='fog'?SEARCH_RULES.fogInjuryBonus:0));
// One plan drives both the campaign action and the before-departure preview.
export function escortBenefits(value=0){
 const skilled=value>=SEARCH_RULES.skill;
 return {primary:SEARCH_RULES.escortPrimary+(skilled?SEARCH_RULES.escortSkilledBonus:0),secondary:SEARCH_RULES.escortSecondary,injuryChance:skilled?SEARCH_RULES.escortSkilledInjury:SEARCH_RULES.escortInjury,injuryDamage:SEARCH_RULES.escortDamage,fatigue:SEARCH_RULES.escortFatigue};
}

export function searchPlan(site,{deep=false,escort=null,day=2,exposure=0,weather='clear'}={}){
 const bonus=escort?escortBenefits(escort.skills.exploration):null;
 const fogInjuryBonus=day>SEARCH_RULES.safeDay&&weather==='fog'?SEARCH_RULES.fogInjuryBonus:0;
 const loot=Object.fromEntries(Object.entries(site.loot).map(([key,n],i)=>[
  key,n+(deep?(i===0?n*(SEARCH_RULES.deepPrimaryFactor-1):SEARCH_RULES.deepSecondary):0)+(bonus?(i===0?bonus.primary:bonus.secondary):0)
 ]));
 return {loot,ap:deep?SEARCH_RULES.deepAP:SEARCH_RULES.quickAP,exposure:deep?Math.min(SEARCH_RULES.deepExposure,EXPOSURE.max-exposure):0,
  fatigue:bonus?.fatigue||0,injuryChance:day>SEARCH_RULES.safeDay?weatherInjuryChance(deep?(bonus?.injuryChance??SEARCH_RULES.deepInjury):0,weather):0,
  injuryDamage:deep||fogInjuryBonus?(bonus?.injuryDamage??SEARCH_RULES.deepDamage):0,fogInjuryBonus};
}

export function searchRiskDescription(){
 const fog=[0,SEARCH_RULES.deepInjury,SEARCH_RULES.escortInjury,SEARCH_RULES.escortSkilledInjury].map(n=>weatherInjuryChance(n,'fog'));
 return `第${SEARCH_RULES.safeDay}天无擦伤；之后非雾天快搜无擦伤，独行深搜擦伤${SEARCH_RULES.deepInjury}%，普通随行${SEARCH_RULES.escortInjury}%、探索达到${SEARCH_RULES.skill}级随行${SEARCH_RULES.escortSkilledInjury}%。雾天所有搜索增加${SEARCH_RULES.fogInjuryBonus}个百分点：快搜${fog[0]}%，深搜独行${fog[1]}%、普通随行${fog[2]}%、探索${SEARCH_RULES.skill}级及以上随行${fog[3]}%。擦伤时独行健康−${SEARCH_RULES.deepDamage}，有随行者由随行者承担健康−${SEARCH_RULES.escortDamage}。`;
}

export function searchInjury(seed,day,siteId,plan){
 // The roll depends only on this outing, never on clicks or the escort's identity.
 // Lowering the threshold with an escort can only prevent an existing injury.
 let hash=2166136261;
 for(const c of `${seed}:${day}:${siteId}`)hash=Math.imul(hash^c.charCodeAt(0),16777619);
 hash^=hash>>>16;hash=Math.imul(hash,0x7feb352d);hash^=hash>>>15;
 return (hash>>>0)%100<plan.injuryChance;
}
