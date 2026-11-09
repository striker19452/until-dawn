import {canEnemyHitPerson} from './rules.js';

// Keep a reachable victim until they die, enter shelter or leave melee reach.
// This is also queried by fear, so nearby bystanders are not treated as victims.
export function enemyPersonTarget(b,enemy){
 const targets=[...b.people,...(b.robots||[]).filter(r=>r.hp>0).map(r=>{r.robot=true;return r;})];
 const previous=targets.find(p=>p.id===enemy.personTargetId);
 if(previous&&canEnemyHitPerson(b,enemy,previous))return previous;
 return targets.filter(p=>canEnemyHitPerson(b,enemy,p)).sort((a,c)=>Math.hypot(a.x-enemy.x,a.y-enemy.y)-Math.hypot(c.x-enemy.x,c.y-enemy.y))[0]||null;
}
