import {canEnemyHitPerson} from './rules.js';

// Keep a reachable victim until they die, enter shelter or leave melee reach.
// This is also queried by fear, so nearby bystanders are not treated as victims.
export function enemyPersonTarget(b,enemy){
 const previous=b.people.find(p=>p.id===enemy.personTargetId);
 if(previous&&canEnemyHitPerson(b,enemy,previous))return previous;
 return b.people.filter(p=>canEnemyHitPerson(b,enemy,p)).sort((a,c)=>Math.hypot(a.x-enemy.x,a.y-enemy.y)-Math.hypot(c.x-enemy.x,c.y-enemy.y))[0]||null;
}
