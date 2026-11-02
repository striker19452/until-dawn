import {nearestWalkablePoint,walkablePoint,moveToward} from './movement.js';
import {isIndoors,HOUSE_DOOR} from './shelter.js';

export const COMBAT_DISTANCE=42;
const NEAR=36,FAR=46,ALLY_GAP=24;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const offsets=[0,Math.PI/6,-Math.PI/6,Math.PI/3,-Math.PI/3,Math.PI/2,-Math.PI/2,Math.PI];
const plans=new WeakMap();

// Only fighting patrols change stance. Work sites, player-directed holds and
// wounded/indoor occupants keep their own movement rules.
export function approachCombat(b,p,enemy,speed,dt){
 const range=distance(p,enemy),index=b.people.indexOf(p);
 const allies=b.people.filter(q=>q!==p&&!q.dead&&!isIndoors(b,q));
 const crowded=allies.some(q=>b.people.indexOf(q)<index&&distance(p,q)<18);
 const threats=b.enemies.filter(e=>e!==enemy&&e.hp>0&&e.mode!=='retreat'&&!e.bossDormant);
 if(range>=NEAR&&range<=FAR&&!crowded&&!threats.some(e=>distance(p,e)<NEAR))return;
 const cached=plans.get(p);
 if(cached?.enemy===enemy&&cached.map===b.walkMap&&distance(cached,enemy)<=4&&distance(p,cached.goal)>.4&&!allies.some(q=>distance(q,cached.goal)<18)&&!threats.some(e=>distance(e,cached.goal)<27)){
  moveToward(p,cached.goal,speed,dt,true,b.walkMap);return;
 }
 const direction=range>.01?Math.atan2(p.y-enemy.y,p.x-enemy.x):Math.atan2(HOUSE_DOOR.y-enemy.y,HOUSE_DOOR.x-enemy.x);
 const penalty=point=>allies.reduce((sum,q)=>sum+Math.max(0,ALLY_GAP-distance(point,q))*3,0)+threats.reduce((sum,e)=>sum+Math.max(0,NEAR-distance(point,e))*4,0);
 const points=offsets.map(offset=>({x:enemy.x+Math.cos(direction+offset)*COMBAT_DISTANCE,y:enemy.y+Math.sin(direction+offset)*COMBAT_DISTANCE}));
 const reachable=point=>nearestWalkablePoint(point,b.walkMap,p);
 const preferred=points[0];let goal=null;
 if(walkablePoint(preferred,b.walkMap)&&penalty(preferred)===0)goal=reachable(preferred);
 if(!goal){
  const choices=points.filter(point=>walkablePoint(point,b.walkMap)).sort((a,c)=>distance(p,a)+penalty(a)-distance(p,c)-penalty(c));
  for(const point of choices){const resolved=reachable(point);if(resolved&&distance(resolved,point)<.1){goal=resolved;break;}}
 }
 // A creature outside the yard may have no reachable point on the ring yet.
 // Stop at the reachable edge instead of walking through a wall to its feet.
 goal ||= reachable(preferred);
 if(goal){plans.set(p,{enemy,map:b.walkMap,x:enemy.x,y:enemy.y,goal});moveToward(p,goal,speed,dt,true,b.walkMap);}
}
