import {ZONES,ENEMIES,ENEMY_WINDUP} from './content.js';
import {fearEffects,fearRetreat} from './fear.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const active=e=>e.hp>0&&e.mode!=='retreat';
const focus=id=>{const z=ZONES.find(z=>z.id===id);return {x:z.x+(240-z.x)*.15,y:z.y+(350-z.y)*.15};};
export const PATROL_RADIUS=125;
export const warningDistance=(b,zone)=>(b.warningLead||0)+(b.zones?.find(z=>z.id===zone)?.bell?18:0);
// Early warning starts deployment; only an approaching local threat inside the
// normal radius (or one already at/through the fence) forces helpers home.
export const ownThreats=(b,p)=>b.enemies.filter(e=>active(e)&&e.zone===p.zone&&(e.mode!=='approach'||distance(e,focus(p.zone))<PATROL_RADIUS));
export function patrolTarget(b,p){
 const standby=focus(p.zone),canAssist=fearEffects(p.fear).autoAssist;
 return b.enemies.filter(e=>active(e)&&(e.zone===p.zone||canAssist)&&(distance(e,standby)<PATROL_RADIUS+warningDistance(b,e.zone)||p.id!=='hero'&&e.zone===p.zone&&e.mode==='inside'))
  .sort((a,c)=>(p.id==='hero'?0:Number(c.zone===p.zone)-Number(a.zone===p.zone))||distance(p,a)-distance(p,c))[0]||null;
}
export function earlyWarningTarget(b,p){
 if(b.finished||p.dead||p.wound==='severe'||p.nightRole==='sleep')return null;
 const t=p.task;if(t&&(!t.automatic||t.type!=='guard'))return null;
 const target=t?b.enemies.filter(e=>active(e)&&e.zone===t.target&&t.threatIds?.includes(e.id)).sort((a,c)=>distance(p,a)-distance(p,c))[0]:patrolTarget(b,p);
 if(!target||target.mode!=='approach')return null;
 const range=distance(target,focus(t?.target||p.zone));
 return range>=PATROL_RADIUS&&range<PATROL_RADIUS+warningDistance(b,target.zone)?target:null;
}
export const occupiedBreak=(b,z)=>z.hp===0&&b.enemies.some(e=>e.hp>0&&e.zone===z.id&&e.mode!=='approach');
export function autoBudgetAvailable(b,key,exclude=null){
 const reserved=b.people.reduce((n,q)=>n+(q.id!==exclude&&q.task?.automatic?(q.task.type==='addWood'?(key==='firewood'?q.task.reserved.materials||0:0):(q.task.reserved[key]||0)):0),0);
 return b.supportUsed[key]+reserved<b.supportBudget[key];
}

export function needsAutoRepair(b,z,person){
 if(!z||z.hp>=60||occupiedBreak(b,z))return false;
 const repairing=b.people.filter(q=>q.id!==person.id&&q.task?.type==='repair'&&q.task.target===z.id);
 return repairing.length<2&&z.hp+repairing.reduce((n,q)=>n+23+Math.floor(q.skills.engineering)*3,0)<60;
}

export function chooseDefenseAssist(b,p){
 if(p.id==='hero'||p.dead||p.wound==='severe'||p.nightRole==='sleep'||p.health<30||p.stamina<24||!fearEffects(p.fear).autoAssist||!b.enemies.some(active)||ownThreats(b,p).length)return null;
 const candidates=[];
 for(const z of b.zones){
  if(z.id===p.zone||b.people.filter(q=>q.task?.assist&&q.task.type==='guard'&&q.task.target===z.id).length>=2)continue;
  const center=focus(z.id),threats=b.enemies.filter(e=>active(e)&&e.zone===z.id&&(e.mode!=='approach'||distance(e,center)<PATROL_RADIUS+warningDistance(b,z.id)));
  if(!threats.length)continue;
  const defenders=b.people.filter(q=>q.id!==p.id&&!q.dead&&q.wound!=='severe'&&q.nightRole!=='sleep'&&!fearRetreat(b,q)&&(q.task?['guard','brace'].includes(q.task.type)&&q.task.target===z.id:q.zone===z.id&&distance(q,center)<125));
  const inside=threats.filter(e=>e.mode==='inside').length;
  const charging=threats.some(e=>e.type==='rammer'&&e.attack>=ENEMIES.rammer.interval*.5||['climber','burrower','caller','quencher'].includes(e.type)&&e.progress>=({climber:ENEMY_WINDUP.climb,burrower:ENEMY_WINDUP.dig,caller:ENEMY_WINDUP.call,quencher:ENEMY_WINDUP.spray}[e.type])*.5);
  const shortage=Math.max(0,threats.length-defenders.length);
  if(!inside&&!shortage&&z.hp>=35&&!charging)continue;
  candidates.push({zone:z.id,score:inside*100+(z.hp===0?50:0)+(charging?25:0)+(z.hp<35?20:0)+shortage*10+(100-z.hp)/10,distance:distance(p,center)});
 }
 return candidates.sort((a,c)=>c.score-a.score||a.distance-c.distance)[0]?.zone||null;
}

export function assistShouldReturn(b,p){
 const t=p.task;if(!t?.assist)return false;
 if(!fearEffects(p.fear).autoAssist)return true;
 if(ownThreats(b,p).length)return true;
 if(p.nightRole==='support'&&b.resources.materials+(t.reserved.materials||0)>0&&autoBudgetAvailable(b,'materials',p.id)&&needsAutoRepair(b,b.zones.find(z=>z.id===p.zone),p))return true;
 if(t.type==='guard')return !b.enemies.some(e=>active(e)&&e.zone===t.target&&t.threatIds?.includes(e.id));
 if(t.type==='repair'){const z=b.zones.find(z=>z.id===t.target);return !z||z.hp>=z.max||occupiedBreak(b,z);}
 return false;
}
