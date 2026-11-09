import {ENEMY_WINDUP} from './content.js';
import {artPoint,worldPoint} from './yard-geometry.js';
import {nearestWalkablePoint} from './movement.js';

// The final second is part of the digging windup, including on compacted soil.
export const BURROW_SECONDS=1;
const clamp=n=>Math.max(0,Math.min(1,n));
const ease=n=>n*n*(3-2*n);
export function burrowFrame(e,lead=0){
 if(e.type!=='burrower'||e.mode!=='attack'||!e.burrow)return null;
 const {start,rate,from,to}=e.burrow;
 const progress=clamp((e.progress+lead*rate-start)/(BURROW_SECONDS*rate));
 const travel=ease(clamp((progress-.28)/.42));
 const phase=progress<.28?'sink':progress<.7?'tunnel':'emerge';
 const visible=phase==='sink'?1-ease(progress/.28):phase==='tunnel'?0:1-(1-clamp((progress-.7)/.3))**3;
 const a=artPoint(from),b=artPoint(to);
 return {progress,phase,visible,travel,point:worldPoint({x:a.x+(b.x-a.x)*travel,y:a.y+(b.y-a.y)*travel})};
}
export function stepBurrow(e,geometry,dt,rate,map){
 e.progress+=dt*rate;
 const start=ENEMY_WINDUP.dig-BURROW_SECONDS*rate;
 if(!e.burrow&&e.progress+1e-8>=start){
  const from={x:e.x,y:e.y},inside={x:geometry.x+(240-geometry.x)*.15,y:geometry.y+(350-geometry.y)*.15};
  e.burrow={from,to:nearestWalkablePoint(inside,map)||inside,start,rate};
 }
 const frame=burrowFrame(e);if(frame)Object.assign(e,frame.point);
 return e.progress+1e-8>=ENEMY_WINDUP.dig;
}
export function resetBurrow(e){
 if(e.burrow&&e.mode==='attack'){Object.assign(e,e.burrow.from);e.progress=0;}
 delete e.burrow;
}
