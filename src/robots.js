import {ZONES} from './content.js';
import {PRODUCTION} from './balance.js';
import {buildingOperational,upgradedWatchtower} from './building-health.js';

export const ROBOT_RULES=Object.freeze({fuel:1,ap:2,hp:100,vision:95,dispatchVision:145,hearing:180,dispatchCooldown:4,dispatchHouseEmergencyHp:45,signalMemory:8,assignmentSeconds:24,dispatchWait:8,reinforcement:{enemyCount:2,wallHp:45,maxWorkers:2},repairSeconds:2,repairGain:44,repairCost:1,robotRepairRange:28,robotRepairCost:1,strikeRange:46,strikeDamage:15,strikeSeconds:1,strikeStun:1,heavyDamage:30,heavyStun:2,heavySeconds:1.2,heavyCooldown:6,restore:{ap:1,cost:{parts:1}},scrap:{ap:1,gain:{materials:2,parts:1}}});
export const ROBOT_TYPES=Object.freeze({
 repair:{name:'维修机器人',speed:36,cost:{materials:8,parts:3},description:'按设定耐久修理路线内的机体和围栏，空闲时为已启用的篝火添柴、拨火或重燃。'},
 defense:{name:'防卫机器人',speed:34,cost:{materials:10,parts:3},description:'移速较慢，以高伤害和眩晕守住规划防区；近身发现蓄力时自动重击打断，重击有冷却，不能维修或护理。'},
 dispatch:{name:'调度机器人',speed:82,cost:{materials:7,parts:4},description:'快速巡逻，铃响即知且不受距离限制，凭视野、铃声和附近预警派出对应机型；防区吃紧时可加派防卫机，发现受损机体会派维修机。自身不能战斗或维修。'}
});
export const robotWorkshop=s=>s.buildings?.some(b=>b.type==='workshop'&&b.level>=2&&buildingOperational(b));
export const robotMoveSpeed=(s,type)=>ROBOT_TYPES[type].speed*(1+(s.buildings?.some(upgradedWatchtower)?PRODUCTION.watchtower.robotSpeedBonus:0));
export const occupiedBeds=s=>(s.people||[]).filter(p=>!p.dead).length+(s.robots||[]).length;
export const robotFuelNeed=s=>(s.robots||[]).filter(r=>r.enabled&&r.hp>0).length*ROBOT_RULES.fuel;
export function defaultRobotPlan(){return {route:['gate'],wait:2,repairBelow:75,materials:4,parts:4,acceptDispatch:true};}
export function validRobotPlan(p){return !!p&&Array.isArray(p.route)&&p.route.length>0&&p.route.length<=8&&p.route.every(id=>ZONES.some(z=>z.id===id))&&Number.isInteger(p.wait)&&p.wait>=0&&p.wait<=10&&Number.isInteger(p.repairBelow)&&p.repairBelow>=10&&p.repairBelow<=100&&Number.isInteger(p.materials)&&p.materials>=0&&p.materials<=20&&(p.parts===undefined||Number.isInteger(p.parts)&&p.parts>=0&&p.parts<=20)&&typeof p.acceptDispatch==='boolean'&&Object.keys(p).every(k=>Object.hasOwn(defaultRobotPlan(),k));}
export function normalizeRobots(s){
 s.robots??=[];
 for(const r of s.robots)if(r.plan&&r.plan.parts===undefined)r.plan.parts=defaultRobotPlan().parts;
 if(s.preparationBase)normalizeRobots(s.preparationBase);
 return s;
}
export function makeRobot(s,type){
 let serial=1;while(s.robots.some(r=>r.id===`robot-${serial}`))serial++;
 return {id:`robot-${serial}`,name:`${ROBOT_TYPES[type].name} ${serial}`,type,hp:ROBOT_RULES.hp,enabled:true,poweredDay:null,plan:defaultRobotPlan()};
}
export function robotStatus(r,day){
 if(r.hp<=0)return '损坏待修';if(!r.enabled)return '手动停机';if(r.powered===false)return '缺油停机';if(r.poweredDay!==day)return '等待供油';
 return r.status||'已供油';
}
