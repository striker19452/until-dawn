import {ROLES,COMPANIONS,JOBS,weather} from './content.js';
import {buildingOperational} from './building-health.js';
import {isIndoors} from './shelter.js';
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
export const farmingYield=skill=>skill>=2?3:2;
export function canCook(s,p){return p?.id==='meng'&&!p.dead&&p.wound!=='severe'&&!!facility(s,'stove');}
export function daytimeWork(s,p){
 if(p.dead||p.wound==='severe'||p.id==='hero'||p.job==='rest'||!JOBS[p.job]&&p.job!=='escort')return false;
 if(p.job==='farm')return !!facility(s,'garden');
 if(p.job==='cook')return canCook(s,p);
 if(p.job==='craft')return (s.zones?.find(z=>z.id===p.zone)||s.zones?.[0])?.hp>0;
 return true;
}
export function personFoodConsumption(s,p){
 const work=p.workedDay===s.day||!s.dayProduced&&daytimeWork(s,p)?1:0;
 const night=p.nightDutyDay===s.day||p.wound!=='severe'&&p.nightRole!=='sleep'||!!p.task||s.sleepInterrupted?.[p.id]===true?1:0;
 return {id:p.id,name:p.name,base:1,work,night,food:1+work+night};
}
export function dailyConsumption(s){
 const personMeals=s.people.filter(p=>!p.dead).map(p=>personFoodConsumption(s,p)),people=personMeals.length;
 const workExtra=personMeals.reduce((n,p)=>n+p.work,0),nightExtra=personMeals.reduce((n,p)=>n+p.night,0);
 const stove=facility(s,'stove'),stoveSaving=stove?(stove.branch==='yield'?2:1):0,cookingSaving=(s.flags?.cookedDay===s.day||(s.phase==='day'&&s.people.some(p=>canCook(s,p)&&p.job==='cook')))?people:0,hotExtra=s.weather==='hot'?Math.ceil(people/3):0;
 return {people,workExtra,nightExtra,personMeals,stoveSaving,cookingSaving,hotExtra,food:people?Math.max(1,people+workExtra+nightExtra-stoveSaving-cookingSaving):0,water:people+hotExtra};
}
export function needs(s){const {food,water}=dailyConsumption(s);return {food,water};}
export function nutritionStatus(s,resources=s.resources){const demand=needs({...s,weather:s.weather??weather(s.day,s.seed)});return {hungry:resources.food<demand.food,thirsty:resources.water<demand.water};}
export function canRecoverHealth(s){const status=nutritionStatus(s);return !status.hungry&&!status.thirsty;}
export function tradeRules(s){const mode=branch(s,'exchange');return {limit:mode==='yield'?3:2,offers:{materials:{pay:{food:3},get:{materials:mode==='steady'?5:4}},medicine:{pay:{materials:mode==='steady'?3:4},get:{medicine:1}},food:{pay:{parts:1},get:{food:4,water:mode==='steady'?3:2}}}};}
// Steady crops and water trade the rain bonus for protection in hot weather.
export function facilityOutput(b,w){
 if(!buildingOperational(b))return 0;
 if(b.type==='garden')return b.branch==='steady'?5:3+(b.level-1)*1+(b.branch==='yield'?1:0)+(w==='rain'?1:w==='hot'?-1:0);
 if(b.type==='water')return b.branch==='steady'?3:(w==='rain'?3:w==='hot'?1:2)+(b.level-1);
 return 0;
}
export function watchtowerRange(tower,w){
 if(!buildingOperational(tower))return 0;
 if(tower.branch==='steady')return w==='fog'?45:35;
 return (tower.branch==='yield'?45:25)*(w==='fog'?.7:1);
}
export const UPGRADE_TEXT={
 garden:{yield:'每两日基础5食物，雨天6、晴热4',steady:'每两日固定5食物；晴热比高产多1，雨天少1'},
 water:{yield:'每日净水3，雨天4、晴热2',steady:'每日固定3净水；晴热比高产多1，雨天少1'},
 workshop:{yield:'同伴每批3陷阱，仍耗2建材',steady:'同伴每批2陷阱，成本降为1建材'},
 generator:{yield:'每日耗2燃料，产2零件，每座过滤额外2水，暴露+2',steady:'每日耗1燃料，产1零件，每座过滤额外1水，不增加暴露'},
 infirmary:{yield:'食水充足时每日为最虚弱的非重伤者恢复6健康',steady:'食水充足时每日为最虚弱的非重伤者恢复3健康，另全员恐惧−4'},
 watchtower:{yield:'预警距离由25增至45；薄雾中为31.5',steady:'通常预警35，薄雾提升至45；雾天比高产多13.5'},
 stove:{yield:'全队每天少耗2食物，最低仍需1食物',steady:'保留每天节省1食物，夜末全员额外疲劳−6'},
 exchange:{yield:'每天可交换3次',steady:'3食物换5建材；3建材换1药；1零件换4食物3水'}
};
