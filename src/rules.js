import {PRODUCTION,WORK,RATIONS,DAY_ACTIONS,facilityYield} from './balance.js';
export {UPGRADE_TEXT} from './descriptions.js';
import {ROLES,COMPANIONS,JOBS,weather} from './content.js';
import {buildingOperational} from './building-health.js';
import {isIndoors} from './shelter.js';
import {DOG_RULES} from './dog.js';
// Shared by the simulation and the UI so previews use the actual rules.
export const STRIKE_RANGE=50;
export const ENEMY_MELEE_RANGE=50;
export const STRIKE_STUN=.15;
export function canEnemyHitPerson(b,enemy,person){
 return enemy.hp>0&&enemy.mode==='inside'&&!(enemy.stun>0)&&!enemy.bossDormant&&!person.dead&&!isIndoors(b,person)&&Math.hypot(enemy.x-person.x,enemy.y-person.y)<=ENEMY_MELEE_RANGE;
}
const defaultStamina={maxStamina:100,staminaNote:'标准体力储备。'};
export const staminaProfile=p=>(p?.id==='hero'?Object.values(ROLES).find(role=>role.name===p.role):COMPANIONS.find(person=>person.id===p?.id))||defaultStamina;
export const maxStamina=p=>staminaProfile(p).maxStamina;
export const facility=(s,type)=>s.buildings.find(b=>b.type===type&&buildingOperational(b));
export const branch=(s,type)=>facility(s,type)?.branch||'normal';
export const farmingYield=skill=>skill>=WORK.farm.skill?WORK.farm.skilled:WORK.farm.normal;
export function canCook(s,p){return p?.id==='meng'&&!p.dead&&p.wound!=='severe'&&!!facility(s,'stove');}
export function daytimeWork(s,p){
 if(p.dead||p.wound==='severe'||p.id==='hero'||p.job==='rest'||!JOBS[p.job]&&p.job!=='escort')return false;
 if(p.job==='farm')return !!facility(s,'garden');
 if(p.job==='cook')return canCook(s,p);
 if(p.job==='craft')return (s.zones?.find(z=>z.id===p.zone)||s.zones?.[0])?.hp>0;
 return true;
}
export function personFoodConsumption(s,p){
 const work=p.workedDay===s.day||!s.dayProduced&&daytimeWork(s,p)?RATIONS.workFood:0;
 const night=p.nightDutyDay===s.day||p.wound!=='severe'&&p.nightRole!=='sleep'||!!p.task||s.sleepInterrupted?.[p.id]===true?RATIONS.nightFood:0;
 return {id:p.id,name:p.name,base:RATIONS.baseFood,work,night,food:RATIONS.baseFood+work+night};
}
export function dailyConsumption(s){
 const personMeals=s.people.filter(p=>!p.dead).map(p=>personFoodConsumption(s,p)),people=personMeals.length;
 const workExtra=personMeals.reduce((n,p)=>n+p.work,0),nightExtra=personMeals.reduce((n,p)=>n+p.night,0);
 const stove=facility(s,'stove'),stoveSaving=stove?PRODUCTION.stove[stove.branch]??PRODUCTION.stove.normal:0,cookingSaving=(s.flags?.cookedDay===s.day||(s.phase==='day'&&s.people.some(p=>canCook(s,p)&&p.job==='cook')))?people*RATIONS.cookSavingPerPerson:0,hotExtra=s.weather==='hot'?Math.ceil(people/RATIONS.hotPeoplePerWater):0;
 const dogFood=s.flags?.dog?DOG_RULES.food:0;
 return {people,workExtra,nightExtra,personMeals,stoveSaving,cookingSaving,hotExtra,dogFood,food:(people?Math.max(RATIONS.minimumFood,people*RATIONS.baseFood+workExtra+nightExtra-stoveSaving-cookingSaving):0)+dogFood,water:people*RATIONS.baseWater+hotExtra};
}
export function needs(s){const {food,water}=dailyConsumption(s);return {food,water};}
export function nutritionStatus(s,resources=s.resources){const demand=needs({...s,weather:s.weather??weather(s.day,s.seed)});return {hungry:resources.food<demand.food,thirsty:resources.water<demand.water};}
export function canRecoverHealth(s){const status=nutritionStatus(s);return !status.hungry&&!status.thirsty;}
export function tradeRules(s){const mode=branch(s,'exchange'),p=PRODUCTION.exchange;return {limit:mode==='yield'?p.yieldLimit:p.limit,offers:{materials:{pay:{food:p.foodCost},get:{materials:mode==='steady'?p.steadyMaterials:p.materials}},medicine:{pay:{materials:mode==='steady'?p.steadyMedicineCost:p.medicineCost},get:{medicine:p.medicine}},food:{pay:{parts:p.partsCost},get:{food:p.food,water:mode==='steady'?p.steadyWater:p.water}}}};}
// Steady crops and water trade the rain bonus for protection in hot weather.
export function facilityOutput(b,w){
 if(!buildingOperational(b))return 0;
 if(['garden','water'].includes(b.type))return facilityYield(b,w);
 return 0;
}
export function watchtowerRange(tower,w){
 if(!buildingOperational(tower))return 0;
 const p=PRODUCTION.watchtower;
 if(tower.branch==='steady')return w==='fog'?p.steadyFog:p.steady;
 return (tower.branch==='yield'?p.yield:p.normal)*(w==='fog'?p.fogFactor:1);
}

export function treatmentMedicine(s,p){const c=DAY_ACTIONS.treatment,discount=s.role==='medic'||s.people.some(x=>!x.dead&&x.skills.medical>=c.skill)||facility(s,'infirmary');return p.wound==='severe'?c.severeMedicine-(discount?c.discount:0):c.medicine;}
