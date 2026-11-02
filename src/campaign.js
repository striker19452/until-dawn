import {CAMPAIGN_RULES,PRODUCTION,DAY_ACTIONS,WORK,RATIONS,GROWTH,COMBAT,RECOVERY,STORY_RULES,EXPOSURE,CHALLENGE_REWARD,generatorOutput,workshopOutput,workshopCost,repairHealth} from './balance.js';
import {resourceText} from './descriptions.js';
import {DOG_RULES} from './dog.js';
import {markDead,deathReason} from './health.js';
import {formatDurability} from './format.js';
import {destroyZoneDefenses} from './zone-defenses.js';
import {FEAR_GAIN} from './fear.js';
import {campfireWood} from './campfire.js';
import {RESCUE_RULES,rescueBenefits} from './rescue.js';
import {BOSS_SPECIES} from './boss-content.js';
import { ROLES, COMPANIONS, ZONES, BUILDINGS, JOBS, NIGHT_ROLES, DEFENSES, SKILLS, SITES, RESOURCE_NAMES, dailyIntel, weather } from './content.js';
import { dayStory } from './story.js';
import { treatmentMedicine, farmingYield, branch, facility, needs, tradeRules, canCook, daytimeWork, facilityOutput, maxStamina, nutritionStatus, canRecoverHealth } from './rules.js';
import { SEARCH_RULES, searchPlan, searchInjury } from './search.js';
import {MORNING_FATIGUE_RECOVERY,SLEEP_FATIGUE_RECOVERY,dayActionFatigue} from './fatigue.js';
import {sleepEligible,sleepInterrupted} from './shelter.js';
import {BUILDING_MAX_HP,BUILDING_REPAIR,BUILDING_PLOTS,buildingHealth,buildingOperational,normalizeBuildingHealth,freeBuildingPlot} from './building-health.js';
export class RuleError extends Error { constructor(message){super(message);this.name='RuleError';} }
export const requireRule=(ok,msg)=>{if(!ok)throw new RuleError(msg);};
export const living=s=>s.people.filter(p=>!p.dead);
export const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));
export function makePerson(id,name,role,skill){return {id,name,role,health:100,hunger:false,thirst:false,fear:8,fatigue:0,stamina:maxStamina({id,role}),wound:'none',deadline:null,extended:false,dead:false,skills:Object.fromEntries(SKILLS.map(k=>[k,k===skill?GROWTH.initial:0])),job:'rest',nightRole:'guard',zone:'gate',reserved:{},story:0,joinedDay:1};}
// Old campaign saves and completed old-browser nights used 100 for a full rest.
// Derive capacities from identity; do not add a field to persisted people.
export function normalizeCampaignStamina(s){for(const p of s.people||[])p.stamina=p.stamina===100?maxStamina(p):clamp(p.stamina,0,maxStamina(p));if(s.preparationBase)normalizeCampaignStamina(s.preparationBase);return s;}
export function normalizeNutrition(s){
 // A report describes the meal just settled, even when it used the last ration.
 const settled=['report','failed','rescued'].includes(s.phase)&&typeof s.report?.hungry==='boolean'&&typeof s.report?.thirsty==='boolean';
 const status=settled?s.report:nutritionStatus(s);
 for(const p of s.people){p.hunger=!p.dead&&status.hungry;p.thirst=!p.dead&&status.thirsty;}
 if(s.preparationBase)normalizeNutrition(s.preparationBase);return s;
}
export function normalizeCampaign(s){if(s.phase!=='rescued')recordHealthDeaths(s);if(s.flags&&Object.hasOwn(s.flags,'campfireWood'))s.flags.campfireWood=campfireWood(s.flags.campfireWood);if(s.preparationBase?.flags&&Object.hasOwn(s.preparationBase.flags,'campfireWood'))s.preparationBase.flags.campfireWood=campfireWood(s.preparationBase.flags.campfireWood);
 // Recover completed companion jobs in already-prepared saves, including jobs
 // that used to reset to rest. Do not guess which old hero actions were labor.
 if(s.phase==='ready'&&s.dayProduced&&s.preparationBase)for(const p of s.people){const before=s.preparationBase.people.find(q=>q.id===p.id);if(before&&daytimeWork(s.preparationBase,before))p.workedDay=s.day;}
 return normalizeNutrition(normalizeCampaignStamina(normalizeBuildingHealth(s)));}
export function initialCampaign(seed=417){return {version:2,seed:Math.abs(seed|0)||417,day:1,phase:'prologue',role:null,ap:CAMPAIGN_RULES.ap,resources:{food:5,water:5,materials:14,fuel:6,medicine:2,parts:1},people:[],beds:DAY_ACTIONS.beds.steps[0],house:100,zones:ZONES.map(z=>({id:z.id,hp:65,max:100,traps:0,spikes:false,mesh:false,bell:false,brazier:false,shade:false})),buildings:[],exposure:0,searched:[],flags:{registeredDay:null,route:null,routeWork:0,helped:0,invited:[],declined:[],solo:false},logs:['窗台上的收音机还在。院子外是荒草，屋里有一个能烧水的旧炉子。'],report:null,dayProduced:false,jobGains:[],memories:[],visited:{},generation:0};}
export function log(s,t){s.logs.push(t);s.logs=s.logs.slice(-100);}
export function afford(s,cost){return Object.entries(cost).every(([k,n])=>Number.isFinite(n)&&n>=0&&s.resources[k]>=n);}
const resourceObservers=new WeakMap();
export function pay(s,cost,reason=null){requireRule(afford(s,cost),'物资不足，尚未执行。');for(const [k,n]of Object.entries(cost))s.resources[k]-=n;if(Object.values(cost).some(n=>n>0))resourceObservers.get(s)?.push({changes:Object.entries(cost).filter(([,n])=>n>0).map(([resource,n])=>({resource,amount:-n})),reason,kind:'spend'});}
export function gain(s,loot,reason=null,kind='gain'){for(const [k,n]of Object.entries(loot))s.resources[k]=(s.resources[k]||0)+n;if(Object.values(loot).some(n=>n>0))resourceObservers.get(s)?.push({changes:Object.entries(loot).filter(([,n])=>n>0).map(([resource,amount])=>({resource,amount})),reason,kind});}
function changeExposure(s,delta,reason){const before=s.exposure;s.exposure=clamp(before+delta,0,EXPOSURE.max);const amount=s.exposure-before;if(amount)resourceObservers.get(s)?.push({changes:[{resource:'exposure',amount}],reason,kind:'exposure'});}
function useAP(s,n,cost={},tiring=true){requireRule(s.ap>=n,'行动力不足，可以提前准备入夜。');pay(s,cost);s.ap-=n;const hero=living(s).find(p=>p.id==='hero');if(tiring&&hero){hero.fatigue=clamp(hero.fatigue+dayActionFatigue(n));hero.workedDay=s.day;}}
export function countBuilding(s,type){return s.buildings.filter(b=>b.type===type&&buildingOperational(b)).length;}
export function member(s,id){const p=living(s).find(p=>p.id===id);requireRule(p,'没有这位在院成员。');return p;}
export function zone(s,id){const z=s.zones.find(z=>z.id===id);requireRule(z,'没有这个防区。');return z;}
export function candidates(s){return COMPANIONS.filter(p=>s.day>=p.day&&!s.people.some(m=>m.id===p.id)&&!s.flags.declined.includes(p.id));}
export function danger(s){return living(s).filter(p=>p.wound==='severe'&&p.deadline<=s.day).map(p=>`${p.name}的救治期限即将在今晚结束`);}
export function skillUp(p,k){p.skills[k]=Math.min(GROWTH.max,(p.skills[k]||0)+GROWTH.step);}
function recordHealthDeaths(s,cause='health'){
 const deaths=[];for(const p of s.people||[])if(!p.dead&&p.health<=0&&markDead(p,cause)){deaths.push(p);log(s,deathReason(p));}
 if(!deaths.length)return;
 const notes=deaths.map(deathReason);
 if(s.people.find(p=>p.id==='hero')?.dead){
  s.phase='failed';s.report||={day:s.day,period:'day',saved:true,foodUsed:0,waterUsed:0,materialsUsed:0,fuelUsed:0,breaches:0,house:s.house,hungry:false,thirsty:false,nutritionDamage:0,deaths:[],events:[]};
 }
 if(s.report){s.report.deaths=[...new Set([...(s.report.deaths||[]),...deaths.map(p=>p.name)])];s.report.events=[...(s.report.events||[]),...notes].slice(-16);}
}
const actionDeathCause=action=>action.type==='search'?'search':'health';
export function applyCampaignAction(current,a,{onResourceFlow}={}){
 requireRule(a&&typeof a==='object'&&!Array.isArray(a),'指令格式错误。');const s=normalizeCampaign(structuredClone(current)),flows=[];
 if(onResourceFlow)resourceObservers.set(s,flows);
 let result;try{result=campaignAction(s,current,a);}finally{resourceObservers.delete(s);}
 if(onResourceFlow)for(const flow of flows)onResourceFlow(flow);
 recordHealthDeaths(result,actionDeathCause(a));
 return normalizeCampaign(result);
}
function campaignAction(s,current,a){
 const {type}=a;
 if(type==='restart'){requireRule(a.confirm===true,'重新开始会清空当前进度，请先确认。');return initialCampaign((Math.imul(s.seed,1664525)+1013904223)>>>1);}
 if(type==='chooseRole'){requireRule(s.phase==='prologue','已经选择角色。');requireRule(ROLES[a.role],'没有这个角色。');s.role=a.role;s.people=[makePerson('hero','你',ROLES[a.role].name,ROLES[a.role].skill)];s.phase='day';gain(s,ROLES[a.role].bonus);s.zones[0].hp=50;log(s,'广播：二十八个昼夜之后，北堤队伍会来接应。');return s;}
 if(type==='nextDay'){
  requireRule(s.phase==='report','请先完成这一夜。');requireRule(s.day<28,'救援已经抵达。');s.day++;s.phase='day';s.ap=CAMPAIGN_RULES.ap;s.searched=[];s.dayProduced=false;s.jobGains=[];s.report=null;s.generation++;
  const recover=canRecoverHealth(s);for(const p of living(s)){p.stamina=maxStamina(p);if(p.wound!=='severe'){p.fatigue=clamp(p.fatigue-MORNING_FATIGUE_RECOVERY);p.fear=clamp(p.fear-RECOVERY.morningFear);if(recover)p.health=clamp(p.health+RECOVERY.morningHealth);if(['light','recovering'].includes(p.wound)&&p.health>65)p.wound='none';}}
  if(s.flags.pendingRegistration&&s.flags.pendingRegistration<=s.day){s.flags.registeredDay=s.day-1;s.flags.pendingRegistration=null;log(s,'留言处的志愿者已转报登记，广播开始确认本院编号。');}
  changeExposure(s,-EXPOSURE.morning,'清晨自然消退');log(s,`第${s.day}天清晨。院子还在，今天还可以做些改变。`);return s;
 }
 if(type==='backDay'){requireRule(s.phase==='ready','当前不在入夜前。');requireRule(s.preparationBase,'当前准备缺少回退记录，请从清晨重新安排。');const day=structuredClone(s.preparationBase);day.phase='day';log(day,'回到白天，黄昏暂结算的产出和工作已一起撤回。');return day;}
 if(type==='prepare'){
  requireRule(s.phase==='day','当前不能准备入夜。');const warnings=danger(s);requireRule(!warnings.length||a.acceptDanger===true,warnings.join('；')+'。请治疗或明确确认。');s.preparationBase=structuredClone(current);produce(s);s.phase='ready';log(s,'白天安排已经结算。入夜前准备已保存，夜战过程中不存档。');return s;
 }
 requireRule(s.phase==='day','这项操作只能在白天进行。');
 if(type==='adoptDog'){
  requireRule(!s.flags.dog,'院子里已经收留了一只小狗。');
  s.flags.dog={name:DOG_RULES.name,adoptedDay:s.day};
  log(s,'你蹲下身，小狗把脑袋轻轻放进你的手心。小麦有家了。每天夜末多留1食物，不占床位。');return s;
 }
 if(type==='event'){
  const choice=dayStory(s).choices.find(x=>x.id===a.choice);requireRule(choice,'今天没有这个待处理的选择。');if(choice.effect==='delegate')requireRule(countBuilding(s,'exchange'),'需先建立互助留言处，再委托实际递送。');useAP(s,choice.ap,choice.cost);if(choice.gain)gain(s,choice.gain);s.flags.events||={};s.flags.events[s.day]=choice.id;
  if(choice.effect==='meal')for(const p of living(s)){const cook=living(s).some(x=>x.id==='meng');p.fear=clamp(p.fear-(cook?STORY_RULES.meal.mengFear:STORY_RULES.meal.fear));p.fatigue=clamp(p.fatigue-(cook?STORY_RULES.meal.mengFatigue:STORY_RULES.meal.fatigue));}
  if(choice.effect==='delegate')s.flags.pendingRegistration=s.day+1;
  if(choice.effect==='kit')s.flags.aidKit=true;
  if(choice.effect==='signal'){s.flags.helped++;changeExposure(s,STORY_RULES.signal.exposure,'扩大接应信号');s.flags.signalExpanded=true;for(const p of living(s))p.fear=clamp(p.fear-RESCUE_RULES.signalFear);}
  if(choice.effect==='letter')s.memories.push('留给后来者的纸条');
  log(s,`「${dayStory(s).title}」：${choice.label}。`);return s;
 }
 if(type==='search'){
  const site=SITES[a.site];requireRule(site&&s.day>=site.day,'地点尚未开放。');requireRule(!s.searched.includes(a.site),'今天已搜索这片区域。');const deep=a.deep===true;
  let escort=null;if(a.escort){escort=member(s,a.escort);requireRule(escort.id!=='hero'&&escort.wound!=='severe'&&escort.job==='rest','随行者必须健康且当日未安排其他工作。');}
  const plan=searchPlan(site,{deep,escort,day:s.day,exposure:s.exposure,weather:weather(s.day,s.seed)}),{loot}=plan;
  useAP(s,plan.ap);
  if(escort){escort.job='escort';escort.workedDay=s.day;escort.fatigue=clamp(escort.fatigue+plan.fatigue);skillUp(escort,'exploration');}
  if(deep)changeExposure(s,plan.exposure,`深搜${site.name}`);
  if(searchInjury(s.seed,s.day,a.site,plan)){const p=escort||member(s,'hero');p.health=clamp(p.health-plan.injuryDamage);if(p.wound==='none')p.wound='light';log(s,`${p.name}${deep?'深搜':'快搜'}时擦伤${plan.fogInjuryBonus?'（雾天出行风险增加）':''}，健康−${plan.injuryDamage}，收获已带回。休息或药品可以恢复。`);}
  gain(s,loot,`搜索${site.name}`);s.searched.push(a.site);s.visited[a.site]=(s.visited[a.site]||0)+1;skillUp(member(s,'hero'),'exploration');
  if(a.site==='contact'&&!s.flags.registeredDay){s.flags.registeredDay=s.day;log(s,'已将院落登记投入联络箱；回执将在后续广播确认。');}
  if(a.site==='contact'&&s.flags.route)s.flags.routeDelivered=s.day;
  if(a.site==='market'&&!s.flags.neighborKnown){s.flags.neighborKnown=true;log(s,'摊主带你认识了桥边互助院。邻居确认有临时床位，愿意转移的同伴可在白天带着口粮同行。');}
  if(a.site==='rescue'&&s.flags.routeWork<RESCUE_RULES.routeCap){s.flags.routeWork++;log(s,'顺路清理了接应标记，路线准备 +1。');}
  log(s,`搜索${site.name}：${Object.entries(loot).map(([k,v])=>`${RESOURCE_NAMES[k]} +${v}`).join('，')}。`);return s;
 }
 if(type==='build'){
  const def=BUILDINGS[a.building];requireRule(def,'没有这种设施。');requireRule(s.buildings.length<BUILDING_PLOTS,`${BUILDING_PLOTS}个经营位置已满，可以在废墟上重建或清理腾位。`);requireRule(s.buildings.filter(b=>b.type===a.building).length<def.limit,'这种设施已达到数量上限。');const plot=freeBuildingPlot(s);useAP(s,DAY_ACTIONS.build.ap,{materials:def.cost});s.buildings.push({id:`b${s.day}-${s.generation}-${plot}-${s.ap}`,type:a.building,plot,level:1,age:0,branch:'normal',enabled:true,hp:BUILDING_MAX_HP});log(s,`建成${def.name}。产出在黄昏结算。`);return s;
 }
 if(type==='upgradeBuilding'){
  const b=s.buildings.find(b=>b.id===a.id);requireRule(b&&b.level===1,'只能升级一级设施。');requireRule(buildingOperational(b),'设施已损毁，请先维修。');requireRule(['yield','steady'].includes(a.branch),'请选择高产或耐候分支。');useAP(s,DAY_ACTIONS.upgrade.ap,DAY_ACTIONS.upgrade.cost);b.level=2;b.branch=a.branch;return s;
 }
 if(type==='repairBuilding'){
  const b=s.buildings.find(b=>b.id===a.id);requireRule(b,'设施不存在。');requireRule(buildingOperational(b),'设施已损毁，需要原址重建或清理废墟。');requireRule(buildingHealth(b)<BUILDING_MAX_HP,'设施已经完好。');useAP(s,BUILDING_REPAIR.ap,{materials:BUILDING_REPAIR.materials});b.hp=BUILDING_MAX_HP;log(s,`${BUILDINGS[b.type].name}已修复至${BUILDING_MAX_HP}耐久，保留原等级和分支。`);return s;
 }
 if(type==='rebuildBuilding'){
  const i=s.buildings.findIndex(b=>b.id===a.id);requireRule(i>=0,'废墟不存在。');const ruin=s.buildings[i],def=BUILDINGS[a.building];requireRule(buildingHealth(ruin)===0,'仅能在损毁后的废墟上重建。');requireRule(def,'请选择要重建的新设施。');requireRule(s.buildings.filter((b,j)=>j!==i&&b.type===a.building).length<def.limit,'这种设施已达到数量上限，请换一种设施。');useAP(s,DAY_ACTIONS.build.ap,{materials:def.cost});s.buildings[i]={id:`b${s.day}-${s.generation}-${ruin.plot}-${s.ap}`,type:a.building,plot:ruin.plot,level:1,age:0,branch:'normal',enabled:true,hp:BUILDING_MAX_HP};log(s,`清理${BUILDINGS[ruin.type].name}废墟，原址新建${def.name}：一级、${BUILDING_MAX_HP}耐久，种植进度重新开始。`);return s;
 }
 if(type==='demolish'){
  const i=s.buildings.findIndex(b=>b.id===a.id);requireRule(i>=0,'设施不存在。');const b=s.buildings[i];useAP(s,DAY_ACTIONS.demolish.ap);gain(s,{materials:Math.floor(BUILDINGS[b.type].cost*DAY_ACTIONS.demolish.recovery*buildingHealth(b)/BUILDING_MAX_HP)},'拆除回收');s.buildings.splice(i,1);log(s,buildingHealth(b)===0?'废墟已清理，原经营位置已腾空；不返还建材。':'拆除按剩余耐久回收部分建材，不返还已经消耗的工时。');return s;
 }
 if(type==='toggleGenerator'){const b=facility(s,'generator');requireRule(b,'没有可用的发电设施，请先建造或维修。');b.enabled=!b.enabled;return s;}
 if(type==='beds'){requireRule(s.beds<DAY_ACTIONS.beds.steps.at(-1),'床位已经达到上限。');useAP(s,DAY_ACTIONS.beds.ap,DAY_ACTIONS.beds.cost);s.beds=DAY_ACTIONS.beds.steps.find(n=>n>s.beds);return s;}
 if(type==='repair'){
  const z=zone(s,a.zone);requireRule(z.hp<z.max,'围栏已经完好。');useAP(s,DAY_ACTIONS.repair.ap,DAY_ACTIONS.repair.cost);if(z.hp===0)destroyZoneDefenses(z);z.hp=Math.min(z.max,z.hp+repairHealth(member(s,'hero').skills.engineering,true));skillUp(member(s,'hero'),'engineering');return s;
 }
 if(type==='defense'){
  const z=zone(s,a.zone);requireRule(z.hp>0,'先修补护栏，再安装附属设施。');requireRule(Object.hasOwn(DEFENSES,a.feature)&&!z[a.feature],'请选择尚未安装的防御；院内只保留中央篝火。');const def=DEFENSES[a.feature];useAP(s,def.ap,def.cost);z[a.feature]=true;return s;
 }
 if(type==='toggleFire'){requireRule(a.target==='central','院内只保留中央篝火。');s.flags.centralFire=s.flags.centralFire===false;return s;}
 if(type==='craft'){
  if(a.item==='trap'){const z=zone(s,a.zone);requireRule(z.hp>0,'先修补护栏，再制作陷阱。');requireRule(z.traps<COMBAT.trap.max,`每区最多预备${COMBAT.trap.max}只陷阱。`);useAP(s,DAY_ACTIONS.trap.ap,DAY_ACTIONS.trap.cost);z.traps+=DAY_ACTIONS.trap.amount;}
  else if(a.item==='fuel'){useAP(s,DAY_ACTIONS.fuel.ap,DAY_ACTIONS.fuel.cost);gain(s,DAY_ACTIONS.fuel.gain);}
  else if(a.item==='medicine'){requireRule(countBuilding(s,'garden')||countBuilding(s,'infirmary'),'需要已辨认草药的菜畦或医务设施。');useAP(s,DAY_ACTIONS.medicine.ap,DAY_ACTIONS.medicine.cost);gain(s,DAY_ACTIONS.medicine.gain);log(s,'按护理手册处理洁净布料、消毒水与已辨认的草药，装成一份用于止血稳定的护理包。');}
  else throw new RuleError('没有这个配方。');return s;
 }
 if(type==='rest'){
  const p=member(s,a.person||'hero');requireRule(p.wound!=='severe','重伤需要先稳定救治。');useAP(s,DAY_ACTIONS.rest.ap,{},false);p.fatigue=clamp(p.fatigue-DAY_ACTIONS.rest.fatigue);p.fear=clamp(p.fear-DAY_ACTIONS.rest.fear);if(canRecoverHealth(s))p.health=clamp(p.health+DAY_ACTIONS.rest.health);else log(s,'食物或净水不足，本次休整只恢复疲劳与恐惧，不恢复健康。');if(p.health>65)p.wound='none';return s;
 }
 if(type==='treat'){
  const p=member(s,a.person);requireRule(p.health<100||p.wound==='severe','没有需要治疗的伤势。');const n=treatmentMedicine(s,p);useAP(s,DAY_ACTIONS.treatment.ap,{medicine:n});p.health=Math.max(p.health,p.wound==='severe'?DAY_ACTIONS.treatment.severeHealth:clamp(p.health+DAY_ACTIONS.treatment.health));p.wound='recovering';p.deadline=null;p.extended=false;p.fear=clamp(p.fear-DAY_ACTIONS.treatment.fear);log(s,`${p.name}的伤势已稳定，需要继续休息。`);return s;
 }
 if(type==='firstAid'){
  const p=member(s,a.person);requireRule(p.wound==='severe'&&!p.extended,'只能为未延长窗口的重伤者提供一次基础护理。');useAP(s,DAY_ACTIONS.firstAid.ap,DAY_ACTIONS.firstAid.cost);p.deadline+=DAY_ACTIONS.firstAid.days;p.extended=true;log(s,`${p.name}的救治窗口延长到第${p.deadline}天结束。`);return s;
 }
 if(type==='recruit'){
  const c=candidates(s).find(c=>c.id===a.person);requireRule(c,'当前没有这位来访者。');requireRule(living(s).length<CAMPAIGN_RULES.maxPeople,`含主角最多${CAMPAIGN_RULES.maxPeople===5?'五':CAMPAIGN_RULES.maxPeople}人。`);requireRule(living(s).length<s.beds,'床位不足，先扩建或约定稍后。');const p=makePerson(c.id,c.name,c.role,c.skill);p.joinedDay=s.day;p.fear=18;p.story=1;p.nightRole='support';p.zone=ZONES[living(s).length%5].id;s.people.push(p);s.flags.invited.push(c.id);log(s,`${c.name}住了进来：${c.story[0]} 每天基础消耗${RATIONS.baseFood}食物、${RATIONS.baseWater}净水；白天工作加${RATIONS.workFood}、参与夜战加${RATIONS.nightFood}食物。`);return s;
 }
 if(type==='decline'){requireRule(candidates(s).some(c=>c.id===a.person),'当前没有这位来访者。');s.flags.declined.push(a.person);log(s,'你们约定在社区公告处留下消息。拒绝收留不会使对方突然遇害。');return s;}
 if(type==='solo'){s.flags.solo=!s.flags.solo;return s;}
 if(type==='dismiss'){
  const p=member(s,a.person);requireRule(p.id!=='hero','主角不能离开当前游戏。');requireRule(s.flags.neighborKnown,'先在集市结识并确认桥边互助院的落脚处。');requireRule(a.confirm===true,`请确认成员将转移到已联系的落脚点，并携带${resourceText(DAY_ACTIONS.dismiss)}。`);gain(s,p.reserved,'成员转移 · 返还预留','refund');p.reserved={};pay(s,DAY_ACTIONS.dismiss);p.dead=true;p.departed=true;s.flags.declined.push(p.id);log(s,`${p.name}携带口粮转移到桥边互助院，留下的工作需要重新安排。`);return s;
 }
 if(type==='assign'){
  const p=member(s,a.person);requireRule(p.id!=='hero'&&JOBS[a.job],'请选择有效的同伴工作。');requireRule(p.wound!=='severe','重伤者无法工作。');requireRule(p.job!=='escort','已经外出随行，今天不能再领取院内产出。');
  if(a.job==='craft')requireRule(zone(s,a.zone||p.zone).hp>0,'先修补护栏，再安排制作陷阱。');
  if(a.job==='cook')requireRule(canCook(s,p),'掌灶是孟姐的专属岗位，需要先建公共灶。');
  if(a.job==='farm')requireRule(countBuilding(s,'garden'),'需要先建菜畦。');if(a.job==='craft')requireRule(!living(s).some(x=>x.id!==p.id&&x.job==='craft'),'基础工作台每天只容纳一批同伴制作。');
  gain(s,p.reserved,'更换工作 · 返还预留','refund');p.reserved={};const cost=a.job==='craft'?{materials:workshopCost(branch(s,'workshop'))}:a.job==='repair'?{materials:WORK.repairCost}:{};pay(s,cost,`${p.name} · 工作预留`);p.reserved=cost;p.job=a.job;if(a.zone)p.zone=zone(s,a.zone).id;return s;
 }
 if(type==='nightRole'){const p=member(s,a.person);requireRule(NIGHT_ROLES[a.role],'岗位不存在。');requireRule(p.wound!=='severe'||a.role==='sleep','重伤者只能休息。');p.nightRole=a.role;if(a.zone)p.zone=zone(s,a.zone).id;return s;}
 if(type==='story'){
  const p=member(s,a.person),c=COMPANIONS.find(c=>c.id===p.id);requireRule(c&&p.story>0&&p.story<3,'当前没有待推进的个人故事。');requireRule(s.day>=p.joinedDay+Math.min(p.story===1?2:4,Math.max(0,28-p.joinedDay)),'再相处一些时间，新的线索会出现。');requireRule(s.visited[c.site]>0,`需要先到${SITES[c.site].name}寻找线索。`);useAP(s,STORY_RULES.personal.ap);log(s,c.story[p.story]);p.story++;p.fear=clamp(p.fear-STORY_RULES.personal.fear);if(p.story===3){s.memories.push(c.reward);p.skills[c.skill]=Math.min(GROWTH.max,p.skills[c.skill]+GROWTH.story);}return s;
 }
 if(type==='trade'){
  requireRule(countBuilding(s,'exchange')||s.searched.includes('market'),'需要留言处或当天到访集市。');requireRule((s.flags.tradeDay===s.day?s.flags.trades:0)<tradeRules(s).limit,'今日交换库存用完，明天再看看。');const trades=tradeRules(s).offers;const t=trades[a.offer];requireRule(t,'没有这项交换。');pay(s,t.pay);gain(s,t.get,'物资交换所得');if(s.flags.tradeDay!==s.day){s.flags.tradeDay=s.day;s.flags.trades=0;}s.flags.trades++;return s;
 }
 if(type==='route'){requireRule(s.day>=RESCUE_RULES.routeDay,'接应路线尚未公布。');requireRule(['road','river'].includes(a.route),'请选择公路或河岸。');if(s.flags.route!==a.route)s.flags.routeDelivered=null;s.flags.route=a.route;log(s,'路线选择已写入待递交登记，下一次前往联络点将转交。');return s;}
 if(type==='routeWork'){requireRule(s.day>=RESCUE_RULES.routeDay&&s.flags.routeWork<RESCUE_RULES.routeCap,'当前无需再做路线准备。');useAP(s,RESCUE_RULES.work.ap,RESCUE_RULES.work.cost);s.flags.routeWork++;log(s,`路线准备+1：第28夜少来1只普通生物，并在接应方向增加1只陷阱（每区最多${COMBAT.trap.max}只，护栏须完好）。`);return s;}
 if(type==='help'){const rule=RESCUE_RULES.help;requireRule(s.day>=rule.day,'邻里接应尚未开始。');requireRule(s.day>=rescueBenefits(s).nextHelpDay,`上次援助仍在递送中，${rule.cooldown===3?'三':rule.cooldown}日后再联系。`);useAP(s,rule.ap,rule.cost);gain(s,rule.gain,'邻里接应回礼');s.flags.helpDay=s.day;s.flags.helped++;changeExposure(s,rule.exposure,'邻里接应补给');log(s,`送出接应补给，收到${resourceText(rule.gain)}；援助${Math.min(s.flags.helped,RESCUE_RULES.aidCap)}/${RESCUE_RULES.aidCap}，第28夜最多少来${RESCUE_RULES.aidCap}只普通生物。下次可在第${s.day+rule.cooldown}天援助。`);return s;}
 if(type==='houseRepair'){requireRule(s.house<100,'房屋完好。');useAP(s,DAY_ACTIONS.house.ap,DAY_ACTIONS.house.cost);s.house=clamp(s.house+DAY_ACTIONS.house.health);return s;}
 throw new RuleError('未知的白天指令。');
}
function produce(s){
 if(s.dayProduced)return;s.dayProduced=true;const w=weather(s.day,s.seed);const summaries=[],healing=[];
 delete s.flags.cookedDay;
 for(const b of s.buildings){if(!buildingOperational(b))continue;if(b.type==='garden'){b.age++;if(b.age>=PRODUCTION.garden.cycle){const n=facilityOutput(b,w);gain(s,{food:n},'菜畦收获');b.age=0;summaries.push(`菜畦收获${n}食物`);}}
 if(b.type==='water'){const n=facilityOutput(b,w);gain(s,{water:n},'集水过滤');summaries.push(`过滤${n}净水`);}}
 const gen=facility(s,'generator');if(gen&&gen.enabled){const output=generatorOutput(gen.branch);if(s.resources.fuel>=output.fuel){pay(s,{fuel:output.fuel},'发电设施运转');const filtered=countBuilding(s,'water')*output.water;gain(s,{parts:output.parts,water:filtered},'发电设施产出');changeExposure(s,output.exposure,'发电噪声');summaries.push(`发电消耗${output.fuel}燃料，零件+${output.parts}、净水+${filtered}、暴露+${output.exposure}`);}}
 const clinic=facility(s,'infirmary');if(clinic){healing.push(()=>{const patient=living(s).filter(p=>p.wound!=='severe'&&p.health<100).sort((a,b)=>a.health-b.health)[0];if(patient){const heal=PRODUCTION.infirmary[clinic.branch]??PRODUCTION.infirmary.normal;patient.health=clamp(patient.health+heal);summaries.push(`医务角为${patient.name}恢复${heal}健康`);}});if(clinic.branch==='steady')for(const p of living(s))p.fear=clamp(p.fear-PRODUCTION.infirmary.steadyFear);}
 for(const p of living(s)){
  if(p.id==='hero'||p.wound==='severe')continue;
  if(p.job==='farm'&&!countBuilding(s,'garden')||p.job==='cook'&&!canCook(s,p)){summaries.push(`${p.name}的工作设施不可用，今天改为休息；重建后可重新分工。`);p.job='rest';}
  const z=s.zones.find(z=>z.id===p.zone)||s.zones[0];
  if(p.job==='craft'&&z.hp===0){gain(s,p.reserved,'护栏损毁 · 退还工作预留','refund');p.reserved={};p.job='rest';summaries.push(`${p.name}的目标护栏已损毁，退还材料并改为休息`);}
  const job=p.job;
  if(job!=='rest')p.workedDay=s.day;
  if(job==='farm'&&countBuilding(s,'garden')){const n=farmingYield(p.skills.survival);gain(s,{food:n},`${p.name} · 照料种植`);skillUp(p,'survival');summaries.push(`${p.name}照料增收${n}食物`);}
  if(job==='water'){gain(s,{water:WORK.water},`${p.name} · 过滤取水`);skillUp(p,'survival');summaries.push(`${p.name}取水 +${WORK.water}`);}
  if(job==='craft'){z.traps=Math.min(COMBAT.trap.max,z.traps+workshopOutput(facility(s,'workshop')));skillUp(p,'engineering');summaries.push(`${p.name}在${ZONES.find(x=>x.id===z.id).name}布置陷阱`);}
  if(job==='repair'){if(z.hp===0)destroyZoneDefenses(z);z.hp=Math.min(z.max,z.hp+repairHealth(p.skills.engineering));skillUp(p,'engineering');}
  if(job==='care'){healing.push(()=>{for(const target of living(s))if(target.wound!=='severe')target.health=clamp(target.health+WORK.careHealth);});for(const target of living(s))target.fear=clamp(target.fear-WORK.careFear);skillUp(p,'medical');}
  if(job==='forage'){gain(s,{fuel:WORK.forage},`${p.name} · 搜集燃料`);skillUp(p,'survival');}
  if(job==='cook'&&canCook(s,p)){s.flags.cookedDay=s.day;skillUp(p,'survival');summaries.push(`孟姐掌灶：当晚每人额外少耗${RATIONS.cookSavingPerPerson}食物，与公共灶叠加，全队最低仍需${RATIONS.minimumFood}食物`);}
  if(job==='scout'){s.flags.scouted=s.day;changeExposure(s,-WORK.scoutExposure,`${p.name} · 侦察巡查`);skillUp(p,'guard');}
  if(job==='rest'){p.fatigue=clamp(p.fatigue-WORK.restFatigue);p.fear=clamp(p.fear-WORK.restFear);healing.push(()=>{p.health=clamp(p.health+WORK.restHealth);});}else if(job!=='escort')p.fatigue=clamp(p.fatigue+WORK.fatigue);
  if(job==='escort')summaries.push(`${p.name}随行已结算：疲劳+${SEARCH_RULES.escortFatigue}，不重复计入黄昏工作，也不领取休息恢复`);
  p.reserved={};if(['craft','repair','escort'].includes(job))p.job='rest';
 }
 if(canRecoverHealth(s))for(const heal of healing)heal();else if(healing.length)summaries.push('食物或净水不足：休息、护理和医务角暂停恢复健康');
 s.jobGains=summaries;for(const line of summaries)log(s,line);
}
export function settleNight(base,battle){
 const s=structuredClone(base);requireRule(base.phase==='ready','结算基准不是入夜准备。');s.resources=structuredClone(battle.resources);s.zones=structuredClone(battle.zones);s.house=battle.house;s.buildings=s.buildings.map(before=>({...before,hp:buildingHealth(battle.buildings?.find(b=>b.id===before.id)||before)}));s.people=structuredClone(battle.people).map(p=>{const assigned=base.people.find(q=>q.id===p.id);p.nightRole=assigned.nightRole;p.zone=assigned.zone;delete p.x;delete p.y;delete p.task;delete p.manualPosition;delete p.cooldown;return p;});
 s.flags.campfireWood=campfireWood(battle.fires.find(f=>f.id==='central')?.wood??base.flags.campfireWood);
 delete s.preparationBase;
 const demand=needs({...s,weather:weather(s.day,s.seed)}),foodNeed=demand.food,waterNeed=demand.water;const foodUsed=Math.min(s.resources.food,foodNeed),waterUsed=Math.min(s.resources.water,waterNeed);s.resources.food-=foodUsed;s.resources.water-=waterUsed;
 const hungry=foodUsed<foodNeed,thirsty=waterUsed<waterNeed;const deaths=s.people.filter(p=>p.dead&&!p.departed&&!base.people.find(q=>q.id===p.id)?.dead).map(p=>p.name);
 const stoveFear=countBuilding(s,'stove')?PRODUCTION.stove.fear+(living(s).some(x=>x.id==='meng')?PRODUCTION.stove.mengFear:0):0;
 for(const p of living(s)){
  p.hunger=hungry;p.thirst=thirsty;p.health=clamp(p.health-(hungry?RATIONS.shortageDamage:0)-(thirsty?RATIONS.shortageDamage:0));
  const workload=battle.work?.[p.id]||0;p.fatigue=clamp(p.fatigue+Math.min(RECOVERY.maxWorkFatigue,workload*RECOVERY.workFatigue)-(sleepEligible(battle,p)?SLEEP_FATIGUE_RECOVERY:0)-(branch(s,'stove')==='steady'?PRODUCTION.stove.steadyFatigue:0));p.fear=clamp(p.fear+(battle.breaches?FEAR_GAIN.nightBreach:-RECOVERY.nightCalm)-stoveFear);p.stamina=maxStamina(p);
  if(workload>GROWTH.guardWork&&p.nightRole==='guard')p.skills.guard=Math.min(GROWTH.max,p.skills.guard+GROWTH.guard);
  if(p.health<=0){if(markDead(p,'shortage'))deaths.push(p.name);}else if(p.wound==='severe'&&p.deadline<=s.day){if(markDead(p,'deadline'))deaths.push(p.name);}
 }
 s.flags.seenTypes=[...new Set([...(s.flags.seenTypes||[]),...(battle.seen||[])])];
 const hero=s.people.find(p=>p.id==='hero');s.phase=s.house<=0||hero.dead?'failed':s.day===28?'rescued':'report';
 const challenge=battle.challenge?structuredClone(battle.challenge):null;
 if(challenge&&(s.phase==='failed'||deaths.length)){challenge.status='missed';challenge.feedback=hero.dead?deathReason(hero):s.house<=0?'小屋失守；留足修补材料，并及时处理入院生物。':`${deaths.join('、')}死亡，本次挑战未完成。`;}
 if(challenge?.status==='cleared'&&s.phase!=='failed'){s.resources.materials+=CHALLENGE_REWARD.materials;for(const p of living(s))p.fear=clamp(p.fear-CHALLENGE_REWARD.fear);s.achievements||=[];if(!s.achievements.some(x=>x.day===s.day))s.achievements.push({day:s.day,title:challenge.title});log(s,`夜间挑战「${challenge.title}」完成：建材+${CHALLENGE_REWARD.materials}，全员恐惧−${CHALLENGE_REWARD.fear}。`);}
 const facilityNotes=s.buildings.filter(b=>buildingHealth(b)<buildingHealth(base.buildings.find(q=>q.id===b.id))).map(b=>`${BUILDINGS[b.type].name}：耐久${formatDurability(b.hp)}/${BUILDING_MAX_HP}${b.hp===0?'，已损毁、停止生效':''}。`);for(const line of facilityNotes)log(s,line);
 const deathNotes=s.people.filter(p=>deaths.includes(p.name)).map(deathReason);for(const line of deathNotes)log(s,line);
 const sleepNotes=s.people.filter(p=>p.nightRole==='sleep'&&sleepInterrupted(battle,p)).map(p=>`${p.name}睡眠已中断：本夜未获得睡眠收益，未恢复${SLEEP_FATIGUE_RECOVERY}疲劳。`);for(const line of sleepNotes)log(s,line);
 s.report={elapsed:Number(battle.elapsed.toFixed(2)),challenge,defenseLosses:structuredClone(battle.defenseLosses||[]),day:s.day,foodUsed,waterUsed,hungry,thirsty,nutritionDamage:(hungry?RATIONS.shortageDamage:0)+(thirsty?RATIONS.shortageDamage:0),breaches:battle.breaches,house:s.house,events:[...battle.log,...deathNotes,...sleepNotes,...facilityNotes].slice(-16),deaths,materialsUsed:Number(Math.max(0,base.resources.materials-s.resources.materials+(base.flags.campfireWood||0)-(s.flags.campfireWood||0)+(challenge?.status==='cleared'?CHALLENGE_REWARD.materials:0)).toFixed(4)),fuelUsed:Math.max(0,base.resources.fuel-s.resources.fuel),saved:true};
 if(s.flags.dog)s.report.dog={foodUsed:Math.min(DOG_RULES.food,foodUsed),barks:battle.dog?.barks||0,retreats:battle.dog?.retreats||0};
 if(battle.boss){const boss=battle.boss;s.report.boss={id:boss.id,name:BOSS_SPECIES[boss.id].name,defeated:boss.defeated,sealed:boss.sealed,summons:boss.summons,split:boss.split,revives:boss.revives};}
 if(s.phase==='rescued'){s.ending={people:living(s).map(p=>p.name),route:s.flags.route||'public',closePickup:rescueBenefits(s).closePickup,helped:s.flags.helped,memories:s.memories,text:living(s).length===1?'你关好炉子，把那张写着「这里曾经有人好好生活」的纸条留在桌上。天亮了。':'杯子收好了。门口的脚步终于来自人类。你们为后来的人留下了种子和一张纸条。'};}
 log(s,`第${s.day}夜结束：食物-${foodUsed}，净水-${waterUsed}，破口${battle.breaches}处。${hungry||thirsty?`${hungry?`饥饿：每人健康−${RATIONS.shortageDamage}。`:''}${thirsty?`缺水：每人健康−${RATIONS.shortageDamage}。`:''}补给不足时暂停自动回血。`:'院子里的灯还亮着。'}`);return s;
}
export function migrateLegacy(old,seed=417,{preserveUnstarted=false}={}){
 if(!old||(!preserveUnstarted&&!old.heard&&old.ap===6))return initialCampaign(seed);let s=initialCampaign(seed);s=applyCampaignAction(s,{type:'chooseRole',role:ROLES[old.role]?old.role:'repairman'});s.resources={food:old.food??5,water:old.water??5,materials:old.mat??14,fuel:6,medicine:old.medicine??2,parts:1};s.house=old.house??100;s.zones[0].hp=old.gate??50;if(old.garden)s.buildings.push({id:'legacy-garden',type:'garden',level:1,age:old.planted?1:0,branch:'normal',enabled:true,hp:BUILDING_MAX_HP});if(old.trap)s.zones[0].traps=1;if(old.recruited){const c=COMPANIONS[0];s.people.push(makePerson(c.id,c.name,c.role,c.skill));s.people[1].story=1;s.people[1].nightRole='support';}
 s.ap=Math.max(0,old.ap??6);if(['report','complete'].includes(old.phase)){s.day=2;s.ap=6;}s.flags.legacyImported=true;log(s,'旧版首日的物资、同伴和建设已带入新版；旧记录仍保留在原试玩中。');return s;
}
