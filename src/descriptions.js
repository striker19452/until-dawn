import {PRODUCTION,DAY_ACTIONS,WORK,RATIONS,COMBAT,STORY_RULES,facilityYield,generatorOutput} from './balance.js';
import {BUILDING_MAX_HP} from './building-health.js';
export const number=value=>Number(Number(value).toFixed(3)).toString();
export const percent=value=>number(value*100);
const names={food:'食物',water:'净水',materials:'建材',fuel:'燃料',medicine:'药品',parts:'零件'};
export const resourceText=values=>Object.entries(values).map(([key,n])=>`${number(n)}${names[key]}`).join('、');
export const actionCost=(ap,cost={})=>`${ap?`${ap}行动`:'不耗行动'}${Object.keys(cost).length?' · '+resourceText(cost):''}`;
export const recipeDescription=item=>{const c=DAY_ACTIONS[item];return `${actionCost(c.ap,c.cost)} → ${resourceText(c.gain)}`;};
const period=()=>PRODUCTION.garden.cycle===2?'两日':`${PRODUCTION.garden.cycle}日`;
const productionLine=(type,branch,level)=>{const output=w=>facilityYield({type,branch,level},w);return {clear:output('clear'),rain:output('rain'),hot:output('hot')};};
export function upgradeDescription(type,branch){
 const p=PRODUCTION[type];
 if(type==='garden'||type==='water'){
  const q=productionLine(type,branch,2),unit=type==='garden'?'食物':'净水',prefix=type==='garden'?`每${period()}`:'每日';
  if(branch==='yield')return `${prefix}${type==='garden'?'基础':''}${q.clear}${unit}，雨天${q.rain}、晴热${q.hot}`;
  const high=productionLine(type,'yield',2),compare=(label,a,b)=>`${label}比高产${a>=b?'多':'少'}${number(Math.abs(a-b))}`;
  return `${prefix}固定${q.clear}${unit}；${compare('晴热',q.hot,high.hot)}，${compare('雨天',q.rain,high.rain).replace('雨天比高产','雨天')}`;
 }
 if(type==='workshop')return `同伴每批${branch==='yield'?p.yield:p.normal}陷阱，${branch==='yield'?`仍耗${p.cost}`:`成本降为${p.steadyCost}`}建材`;
 if(type==='generator'){const g=generatorOutput(branch);return `每日耗${g.fuel}燃料，产${g.parts}零件，每座过滤额外${g.water}水，${g.exposure?`暴露+${g.exposure}`:'不增加暴露'}`;}
 if(type==='infirmary')return `食水充足时每日为最虚弱${branch==='yield'?'的':''}非重伤者恢复${p[branch]}健康${branch==='steady'?`，另全员恐惧−${p.steadyFear}`:''}`;
 if(type==='watchtower')return branch==='yield'?`预警距离由${p.normal}增至${p.yield}；薄雾中为${number(p.yield*p.fogFactor)}`:`通常预警${p.steady}，薄雾提升至${p.steadyFog}；雾天比高产多${number(p.steadyFog-p.yield*p.fogFactor)}`;
 if(type==='stove')return branch==='yield'?`全队每天少耗${p.yield}食物，最低仍需${RATIONS.minimumFood}食物`:`保留每天节省${p.steady}食物，夜末全员额外疲劳−${p.steadyFatigue}`;
 if(type==='exchange')return branch==='yield'?`每天可交换${p.yieldLimit}次`:`${p.foodCost}食物换${p.steadyMaterials}建材；${p.steadyMedicineCost}建材换${p.medicine}药；${p.partsCost}零件换${p.food}食物${p.steadyWater}水`;
 return '';
}
export function facilityDescription(type){
 const p=PRODUCTION[type];
 if(type==='garden'){const q=productionLine(type,'normal',1);return `每${p.cycle===2?'两':p.cycle}次黄昏自动收获：一级每次${q.clear}食物，雨天${q.rain}、晴热${q.hot}。同伴照料另有每日增产。`;}
 if(type==='water'){const q=productionLine(type,'normal',1);return `利用旧蓄水池与雨水，每天产${q.clear}净水，雨天${q.rain}、晴热${q.hot}。`;}
 if(type==='workshop')return `同伴制作陷阱每批由${p.without}只增至${p.normal}只，成本${p.cost}建材。`;
 if(type==='generator'){const g=generatorOutput('normal');return `一级每次黄昏耗${g.fuel}燃料，产${g.parts}零件；每座可用集水过滤额外产${g.water}净水，暴露+${g.exposure}。`;}
 if(type==='infirmary')return `白天稳定重伤少用${DAY_ACTIONS.treatment.discount}药；食水充足时每日为最虚弱非重伤者恢复${p.normal}健康。`;
 if(type==='watchtower')return `预警距离+${p.normal}，薄雾中效果为${percent(p.fogFactor)}%；可与铃绳、侦察叠加。`;
 if(type==='stove')return `每天全队少耗${p.normal}食物（最低${RATIONS.minimumFood}）；夜末全员额外恐惧−${p.fear}。孟姐在院时再减${p.mengFear}恐惧。`;
 if(type==='exchange')return `每天可交换${p.limit}次，不耗行动、按配方支付物资；第${STORY_RULES.delegate.day}天可花${resourceText(STORY_RULES.delegate.cost)}委托代送院落登记。`;
 return '';
}
// Getters keep previews tied to live configuration in tests and editor sessions.
export const UPGRADE_TEXT=Object.fromEntries(Object.keys(PRODUCTION).map(type=>[type,Object.defineProperties({},Object.fromEntries(['yield','steady'].map(branch=>[branch,{enumerable:true,get:()=>upgradeDescription(type,branch)}])))]));
export function rationDescription(){return `每人基础${RATIONS.baseFood}食物；白天工作、随行或主角行动劳动加${RATIONS.workFood}；夜间巡守、后勤或临时出动加${RATIONS.nightFood}，整夜休息不加。每项每天只加一次。`;}
export function defenseDescription(){return `翻刺：阻止翻越，每秒伤害${COMBAT.spikes.damage}（重撞兽${COMBAT.spikes.rammerDamage}）。埋网：阻止浅掘，攀爬速度×${COMBAT.meshClimbFactor}。陷阱：基础伤害${COMBAT.trap.damage}、眩晕${COMBAT.trap.stun}秒；拦住重撞时眩晕${COMBAT.trap.rammerStun}秒，每次触发耗1只。`;}
export const buildingLimitText=()=>`设施统一${BUILDING_MAX_HP}耐久`;
