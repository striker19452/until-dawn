import {farmingYield,STRIKE_RANGE,STRIKE_STUN} from '../src/rules.js';
import {WORK,COMBAT,GROWTH,DAY_ACTIONS,RATIONS,repairHealth,nightRepairHealth,strikeDamage,nightActionCost} from '../src/balance.js';
import {orderDuration} from '../src/night-orders.js';
import {SKILL_NAMES} from '../src/content.js';
import {escortBenefits,SEARCH_RULES} from '../src/search.js';
const fmt=n=>Number(n.toFixed(2)).toString();
export function skillBenefit(person,key,value){
 if(key==='survival')return `同伴照料种植：额外${farmingYield(value)}食物／日`;
 if(key==='engineering')return `白天修栏恢复${repairHealth(value,person.id==='hero')}耐久；夜间恢复${nightRepairHealth(value)}耐久，作业${fmt(orderDuration({...person,fatigue:0,skills:{...person.skills,engineering:value}},'repair'))}秒`;
 if(key==='guard')return `自动攻击每次${strikeDamage(value)}伤害`;
 if(key==='exploration'){const bonus=escortBenefits(value);return `同伴随行：主要物资+${bonus.primary}、其他各+${bonus.secondary}；深搜擦伤${bonus.injuryChance}%、健康−${bonus.injuryDamage}`;}
 if(key==='medical')return `${value>=DAY_ACTIONS.treatment.skill?`满足全队白天稳定重伤省${DAY_ACTIONS.treatment.discount}药条件`:'本技能尚不提供白天重伤省药'}；本人夜间自救用${nightActionCost({...person,skills:{...person.skills,medical:value}},'aid').medicine}药`;
}
export function skillInfo(person,key){
 const value=person.skills[key]||0,hero=person.id==='hero';
 const growth={
 survival:hero?'主角目前没有增加生存技能的行动。':`黄昏完成种植、取水、搜集燃料${person.id==='meng'?'或专属掌灶':''}，每次+${GROWTH.step}。`,
 engineering:hero?`白天主动修补围栏，每次+${GROWTH.step}。`:`黄昏完成修栏或制作陷阱岗位，每次+${GROWTH.step}。`,
 guard:`${hero?'':`黄昏完成侦察岗位+${GROWTH.step}；`}夜末仍为巡守岗位且当晚劳动量>${GROWTH.guardWork}，守卫+${GROWTH.guard}，每夜最多一次。作业每秒计1，自动攻击每次计${COMBAT.strike.work}。`,
 exploration:hero?`完成快搜或深搜，每次+${GROWTH.step}；两种搜索增长相同。`:`随行搜索，每次+${GROWTH.step}；只有随行者获得这份增长。`,
 medical:hero?'主角主动治疗和夜间自救目前均不增加护理技能。':`黄昏完成护理岗位，每次+${GROWTH.step}；主动治疗和夜间自救不增加护理。`
 };
 const notes={
 survival:`${Array.from({length:GROWTH.max+1},(_,i)=>i).join('／')}级照料种植分别增加${Array.from({length:GROWTH.max+1},(_,i)=>i).map(farmingYield).join('／')}食物：低于${WORK.farm.skill}级产${WORK.farm.normal}，${WORK.farm.skill}级及以上产${WORK.farm.skilled}。取水固定+${WORK.water}、搜集燃料固定+${WORK.forage}；孟姐掌灶每人再省${RATIONS.cookSavingPerPerson}食物，不随技能增加。主角不能领取同伴种植岗位产出。`,
 engineering:'整数等级增加修复量，小数成长也会缩短夜间修补时间。所列作业时间为零疲劳基础值，不含赶路；实际耗时只除以疲劳作业效率，恐惧不再增加作业时间。建造、升级和夜间修补不增加工程技能。',
 guard:`只在达到下一个整数等级时增加伤害。攻击距离${STRIKE_RANGE}；普通攻击使普通生物眩晕${STRIKE_STUN}秒，不削减蓄力进度；首领及双脉分裂体免疫这项眩晕。重击、陷阱与机制控制仍有效。实际出手还受体力和冷却影响；不按击杀数增长。`,
 exploration:`${SEARCH_RULES.skill}级以上的随行收益相同。表中为非雾天深搜风险；雾天所有搜索增加${SEARCH_RULES.fogInjuryBonus}个百分点，实际概率见出发预览。主要物资是地点列出的第一种资源，随行加成与深搜叠加；第${SEARCH_RULES.safeDay}天无擦伤，随行疲劳只加一次${SEARCH_RULES.escortFatigue}，占用当天岗位。主角搜索基础收获不随探索技能增加。`,
 medical:`${DAY_ACTIONS.treatment.skill}级以上的省药效果相同。白天省药也可由医护主角或医务角提供，优惠不叠加；护理岗位固定健康+${WORK.careHealth}、恐惧−${WORK.careFear}，不随技能增加。食物或净水不足时暂停护理回血。`
 };
 const ranks=['engineering','guard'].includes(key)?Array.from({length:GROWTH.max},(_,i)=>i+1):[key==='survival'?WORK.farm.skill:key==='medical'?DAY_ACTIONS.treatment.skill:SEARCH_RULES.skill];
 const threshold=ranks.find(n=>n>value);
 return {name:SKILL_NAMES[key],value,current:skillBenefit(person,key,value),next:value>=GROWTH.max?`已达上限${GROWTH.max}级。`:threshold?`达到${threshold}级：${skillBenefit(person,key,threshold)}`:`下一个上限为${GROWTH.max}级；${ranks.at(-1)}级以上暂无额外数值收益。`,growth:growth[key]+(!hero?` 完成个人故事时，仅擅长技能额外+${GROWTH.story}，最高${GROWTH.max}级。`:''),note:notes[key],levels:Array.from({length:GROWTH.max+1},(_,level)=>({level,effect:skillBenefit(person,key,level)}))};
}
