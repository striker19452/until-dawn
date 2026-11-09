import {ZONES} from './content.js';
import {moveToward} from './movement.js';
import {STRIKE_RANGE} from './rules.js';
export const livingTarget=e=>e&&e.hp>0&&e.mode!=='retreat'&&!e.bossDormant;
export const heavyInRange=(actor,e,range=STRIKE_RANGE)=>Math.hypot(actor.x-e.x,actor.y-e.y)<=range;
export function approachHeavy(b,actor,e,speed,dt,range=STRIKE_RANGE){
 if(heavyInRange(actor,e,range))return true;
 const z=ZONES.find(z=>z.id===e.zone),point=e.mode==='inside'?e:{x:z.x+(240-z.x)*.15,y:z.y+(350-z.y)*.15};
 moveToward(actor,point,speed,dt,true,b.walkMap);
 return heavyInRange(actor,e,range);
}
export function pendingHeavy(b,enemyId,except=null){
 return [...b.people,...(b.robots||[])].some(p=>p.id!==except&&(!p.dead)&&p.hp!==0&&p.task?.type==='heavy'&&p.task.enemyId===enemyId);
}
