import {CHALLENGE_REWARD,GROWTH,COMBAT,RATIONS,BOSS_RULES,NIGHT_ACTIONS} from './balance.js';
import {DEATH_CAUSES} from './health.js';
import {ATTACHED_DEFENSES,destroyZoneDefenses} from './zone-defenses.js';
import {CAMPFIRE_MAX_WOOD,campfireWood} from './campfire.js';
import {bossForDay} from './boss-content.js';
import { RuleError } from './campaign.js';
import { RESOURCE_NAMES,SKILLS,ZONES,ENEMIES } from './content.js';
import {maxStamina} from './rules.js';
import {buildingHealth,BUILDING_MAX_HP} from './building-health.js';
import {DOG_RULES} from './dog.js';
const assert=(ok,text)=>{if(!ok)throw new RuleError(text);};
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const meter=n=>Number.isFinite(n)&&n>=0&&n<=100;

// Validate a bounded single-player save. This checks save integrity, not a second
// simulation: the server never moves entities, attacks, or replays the night.
export function validateClientResult(base,state){
 assert(state&&typeof state==='object'&&!Array.isArray(state),'缺少本地夜战结果。');
 const mutable=new Set(['resources','people','zones','buildings','house','phase','report','flags','logs','achievements','ending','preparationBase']);
 for(const key of Object.keys(state))assert(Object.hasOwn(base,key)||mutable.has(key),'结果含有未知存档字段。');
 for(const key of Object.keys(base))if(!mutable.has(key))assert(equal(base[key],state[key]),`夜战不能修改${key}。`);
 assert(!state.preparationBase,'结果中不应包含临时准备副本。');
 assert(meter(state.house),'房屋耐久无效。');
 assert(Array.isArray(state.buildings)&&state.buildings.length===base.buildings.length,'设施名单不匹配。');
 for(const [i,building]of state.buildings.entries()){
  const before=base.buildings[i];assert(building&&typeof building==='object'&&!Array.isArray(building),'设施结果无效。');
  // Earlier open pages identify plots by array order. Preserve the new stable
  // placement when those pages finish; supplied plot edits are still rejected.
  if(building.plot===undefined&&before.plot!==undefined)building.plot=before.plot;
  for(const key of new Set([...Object.keys(before),...Object.keys(building)]))if(key!=='hp')assert(equal(before[key],building[key]),'夜间只能改变设施耐久。');
  // An old browser does not have durability yet: preserve its prepared value.
  const hp=building.hp===undefined?buildingHealth(before):building.hp;
  assert(Number.isFinite(hp)&&hp>=0&&hp<=BUILDING_MAX_HP&&hp<=buildingHealth(before),'设施耐久无效。');
  building.hp=hp;
 }
 for(const key of Object.keys(RESOURCE_NAMES))assert(Number.isInteger(state.resources?.[key])&&state.resources[key]>=0&&state.resources[key]<=base.resources[key]+(key==='materials'?CHALLENGE_REWARD.materials:0),'夜战库存无效。');
 assert(Array.isArray(state.people)&&state.people.length===base.people.length,'夜战成员名单不匹配。');
 for(const [i,p]of state.people.entries()){
  const before=base.people[i];
  for(const key of ['id','name','role','story','joinedDay'])assert(equal(p[key],before[key]),'夜战不能更换成员身份或故事。');
  // Old pages may omit the daytime marker; keep already completed work.
  if(p.workedDay===undefined&&before.workedDay!==undefined)p.workedDay=before.workedDay;
  assert(equal(p.workedDay,before.workedDay),'夜战不能修改白天工作记录。');
  if(p.nightDutyDay!==undefined)assert(Number.isInteger(p.nightDutyDay)&&p.nightDutyDay>=1&&p.nightDutyDay<=base.day,'夜战参与记录无效。');
  for(const key of ['health','fear','fatigue'])assert(meter(p[key]),'人物状态无效。');
  // Keep an already-open old browser's numeric shortage result saveable.
  for(const key of ['hunger','thirst'])assert(typeof p[key]==='boolean'||meter(p[key]),'补给状态无效。');
  // An already-open browser still restores everyone to 100 at dawn.
  assert(Number.isFinite(p.stamina)&&p.stamina>=0&&(p.stamina<=maxStamina(before)||p.stamina===100),'人物体力无效。');
  assert(typeof p.dead==='boolean'&&['none','light','recovering','severe'].includes(p.wound),'伤势状态无效。');
  assert(p.health>0||p.dead,'健康归零的成员必须标记死亡。');
  assert(!before.dead||p.dead,'不能复活已死亡或离队成员。');
  if(p.deathCause!==undefined)assert(p.dead&&p.health===0&&DEATH_CAUSES.includes(p.deathCause),'死亡原因无效。');
  assert(p.deadline===null||Number.isInteger(p.deadline)&&p.deadline>=1&&p.deadline<=30,'救治期限无效。');
  assert(['guard','support','sleep'].includes(p.nightRole)&&ZONES.some(z=>z.id===p.zone),'夜间岗位无效。');
  assert(p.nightRole===before.nightRole&&p.zone===before.zone,'长期岗位和重点防区只能在分工中修改。');
  for(const key of SKILLS)assert(Number.isFinite(p.skills?.[key])&&p.skills[key]>=0&&p.skills[key]<=GROWTH.max,'技能状态无效。');
  assert(!('task'in p)&&!('manualPosition'in p)&&!('x'in p)&&!('y'in p),'人物结果仍包含未结束任务。');
 }
 assert(Array.isArray(state.zones)&&state.zones.length===base.zones.length,'防区名单无效。');
 for(const [i,z]of state.zones.entries()){
  const before=base.zones[i];
  assert(z.id===before.id&&meter(z.hp)&&z.max===before.max&&Number.isInteger(z.traps)&&z.traps>=0&&z.traps<=COMBAT.trap.max,'防区结果无效。');
  for(const key of ATTACHED_DEFENSES)assert(z[key]===before[key]||z[key]===false,'夜间不能新建设施。');
  // Older open pages may still return attachments on a destroyed fence.
  if(z.hp===0)destroyZoneDefenses(z);
 }
 assert(state.flags&&typeof state.flags==='object','缺少剧情状态。');
 for(const key of Object.keys(state.flags))assert(Object.hasOwn(base.flags,key)||['seenTypes','campfireWood'].includes(key),'结果含有未知剧情字段。');
 for(const key of Object.keys(base.flags))if(!['seenTypes','campfireWood'].includes(key))assert(equal(base.flags[key],state.flags[key]),'夜间不能修改日间剧情。');
 const storedWood=state.flags.campfireWood??0,woodCost=NIGHT_ACTIONS.costs.addWood.materials,woodCapacity=woodCost>0?(base.flags.campfireWood||0)+(base.resources.materials-state.resources.materials+(state.report?.challenge?.status==='cleared'?CHALLENGE_REWARD.materials:0))/woodCost*CAMPFIRE_MAX_WOOD:CAMPFIRE_MAX_WOOD;assert(Number.isFinite(storedWood)&&storedWood>=0&&storedWood<=woodCapacity+1e-8,'篝火柴料无效。');if(Object.hasOwn(state.flags,'campfireWood'))state.flags.campfireWood=campfireWood(storedWood);
 assert(Array.isArray(state.flags.seenTypes)&&state.flags.seenTypes.length<=Object.keys(ENEMIES).length&&state.flags.seenTypes.every(type=>Object.hasOwn(ENEMIES,type)),'见闻记录无效。');
 assert(Array.isArray(state.logs)&&state.logs.length<=100&&state.logs.every(s=>typeof s==='string'&&s.length<=2000),'日志结果无效。');
 assert(!state.achievements||Array.isArray(state.achievements)&&state.achievements.length<=28,'成就记录无效。');
 const phase=state.house<=0||state.people.find(p=>p.id==='hero')?.dead?'failed':base.day===28?'rescued':'report';
 assert(state.phase===phase,'夜战结局状态不匹配。');
 assert(state.report?.day===base.day&&state.report.saved===true,'缺少完整战报。');
 if(state.report.elapsed!==undefined)assert(Number.isFinite(state.report.elapsed)&&state.report.elapsed>=0,'守夜用时无效。');
 if(state.report.defenseLosses!==undefined){const losses=state.report.defenseLosses;assert(Array.isArray(losses)&&losses.length<=5&&new Set(losses.map(loss=>loss?.zone)).size===losses.length&&losses.every(loss=>ZONES.some(z=>z.id===loss?.zone)&&Array.isArray(loss.defenses)&&loss.defenses.length>0&&loss.defenses.length<=6&&loss.defenses.every(name=>typeof name==='string'&&name.length<=20)),'附属设施损毁记录无效。');}
 if(state.report.boss){const boss=state.report.boss,def=bossForDay(base.day);assert(def&&boss.id===def.id&&boss.name===def.name&&typeof boss.defeated==='boolean'&&typeof boss.split==='boolean','首领战报无效。');for(const [key,max]of [['sealed',20],['summons',BOSS_RULES.brood.limit],['revives',BOSS_RULES.twin.revives]])assert(Number.isInteger(boss[key])&&boss[key]>=0&&boss[key]<=max,'首领机制记录无效。');}
 assert(typeof state.report.hungry==='boolean'&&typeof state.report.thirsty==='boolean','补给结算状态无效。');
 if(state.report.dog){const dog=state.report.dog;assert(base.flags.dog&&Number.isInteger(dog.foodUsed)&&dog.foodUsed>=0&&dog.foodUsed<=DOG_RULES.food&&dog.foodUsed<=state.report.foodUsed&&Number.isInteger(dog.barks)&&dog.barks>=0&&dog.barks<=100&&Number.isInteger(dog.retreats)&&dog.retreats>=0&&dog.retreats<=dog.barks,'小狗战报无效。');}
 if(Object.hasOwn(state.report,'nutritionDamage'))assert(state.report.nutritionDamage===(state.report.hungry?RATIONS.shortageDamage:0)+(state.report.thirsty?RATIONS.shortageDamage:0),'补给伤害结算无效。');
 for(const key of ['foodUsed','waterUsed','breaches','materialsUsed','fuelUsed'])assert(Number.isFinite(state.report[key])&&state.report[key]>=0,'战报数值无效。');
 assert(Array.isArray(state.report.events)&&state.report.events.length<=50&&state.report.events.every(s=>typeof s==='string'&&s.length<=2000)&&Array.isArray(state.report.deaths)&&state.report.deaths.every(name=>base.people.some(p=>p.name===name)),'战报记录无效。');
 if(state.phase==='rescued')assert(state.ending&&typeof state.ending.text==='string'&&state.ending.text.length<=2000&&Array.isArray(state.ending.people)&&state.ending.people.every(name=>base.people.some(p=>p.name===name)),'救援结果无效。');
 return state;
}
