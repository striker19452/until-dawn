import {moveToward,nearestWalkablePoint} from './movement.js';
import {ZONES,ENEMIES} from './content.js';

export const DOG_RULES=Object.freeze({name:'小麦',food:1,barkChance:.35,barkMin:9,barkMax:16,retreatSeconds:2,retreatSpeed:14});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const random=dog=>{dog.rng=(Math.imul(dog.rng,1664525)+1013904223)>>>0;return dog.rng/4294967296;};
export function createDog(seed,walkMap){
 const point=nearestWalkablePoint({x:272,y:377},walkMap);
 return {...point,rng:(seed^0x70617773)>>>0,action:'wag',left:2.5,age:0,facing:1,target:null,personId:null,barkIn:6,barks:0,retreats:0,barkUntil:0};
}
// Cosmetic daytime choices and night barks use their own seeded stream. A dog
// never changes the enemy arrival schedule or accepts player orders.
export function advanceDog(dog,dt,{people,walkMap,night=false}){
 dog.age+=dt;dog.left-=dt;
 if(dog.left<=0){
  const actions=night?['wander','wag','sniff','nap']:['wander','wander','sniff','wag','tilt','stretch','roll','nap','greet','greet','greet'];
  dog.action=actions[Math.floor(random(dog)*actions.length)];dog.left=3+random(dog)*4;dog.target=null;dog.personId=null;
  if(dog.action==='greet'){
   const available=people.filter(p=>!p.dead&&p.wound!=='severe'&&Number.isFinite(p.x));
   const person=available[Math.floor(random(dog)*available.length)];
   if(person)dog.personId=person.id;else dog.action='tilt';
  }
  if(['wander','sniff'].includes(dog.action))dog.target=nearestWalkablePoint({x:85+random(dog)*310,y:315+random(dog)*120},walkMap,dog);
 }
 if(dog.personId){
  const person=people.find(p=>p.id===dog.personId&&!p.dead&&p.wound!=='severe');
  if(person)dog.target=nearestWalkablePoint({x:person.x+(dog.x<person.x?-22:22),y:person.y+8},walkMap,dog);
  else {dog.personId=null;dog.target=null;dog.left=0;}
 }
 dog.moving=false;dog.cuddling=false;
 if(dog.target){
  const dx=dog.target.x-dog.x;if(Math.abs(dx)>.2)dog.facing=Math.sign(dx);
  if(distance(dog,dog.target)>1){moveToward(dog,dog.target,dog.action==='sniff'?17:31,dt,true,walkMap);dog.moving=true;}
  else if(dog.personId){dog.cuddling=true;const p=people.find(p=>p.id===dog.personId);if(p)dog.facing=p.x<dog.x?-1:1;}
 }
}
export function stepDog(b,dt,{event,note}){
 const dog=b.dog;if(!dog)return;
 if(b.elapsed<dog.barkUntil){dog.age+=dt;dog.moving=false;}
 else advanceDog(dog,dt,{people:b.people.filter(p=>!b.indoorPeople?.[p.id]),walkMap:b.walkMap,night:true});
 dog.barkIn-=dt;if(dog.barkIn>0)return;
 dog.barkIn=DOG_RULES.barkMin+random(dog)*(DOG_RULES.barkMax-DOG_RULES.barkMin);
 const targets=b.enemies.filter(e=>e.hp>0&&!e.bossDormant&&e.mode!=='retreat');
 if(!targets.length)return;
 const target=targets[Math.floor(random(dog)*targets.length)],success=random(dog)<DOG_RULES.barkChance&&!target.boss;
 dog.barks++;dog.barkUntil=b.elapsed+1.2;dog.barkTarget={x:target.x,y:target.y};dog.facing=target.x<dog.x?-1:1;dog.moving=false;
 if(success){
  dog.retreats++;target.dogPreviousMode=target.mode;target.mode='retreat';target.stun=0;target.progress=0;target.attack=0;
  target.dogRetreatUntil=b.elapsed+DOG_RULES.retreatSeconds;
 }
 const text=`${DOG_RULES.name}：汪！ · ${ENEMIES[target.type].name}${success?'稍稍退开':target.boss?'不为所动':'没有退却'}`;
 event(b,'dog-bark',dog.x,dog.y,text,{enemyId:target.id,zone:target.zone,success,target:{x:target.x,y:target.y}});note(b,text);
}
export function stepDogRetreat(b,e,dt){
 if(e.mode!=='retreat')return false;
 const zone=ZONES.find(z=>z.id===e.zone),goal={x:zone.ox+(zone.ox-zone.x)*.6,y:zone.oy+(zone.oy-zone.y)*.6};
 if(b.elapsed>=e.dogRetreatUntil){e.mode=e.dogPreviousMode==='inside'?'inside':'approach';delete e.dogRetreatUntil;delete e.dogPreviousMode;}
 else moveToward(e,goal,DOG_RULES.retreatSpeed,dt);
 return true;
}
