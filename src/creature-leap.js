import {PHASE_CREATURE_RULES} from './phase-creatures.js';
import {artPoint,worldPoint} from './yard-geometry.js';
import {nearestWalkablePoint} from './movement.js';

// The animation occupies the final second of the existing windup. Mesh keeps
// its original total delay; it does not stretch a creature's airborne time.
export const LEAP_SECONDS=1;
const clamp=n=>Math.max(0,Math.min(1,n));
const smooth=n=>{const p=clamp(n);return p*p*(3-2*p);};
export function leapFrame(e,lead=0){
 if(e.type!=='bladebeast'||e.mode!=='attack'||!e.leap)return null;
 const {from,to,start,rate}=e.leap,progress=clamp((e.progress+lead*rate-start)/(LEAP_SECONDS*rate));
 const air=clamp((progress-.2)/.62),travel=smooth(air),phase=progress<.2?'crouch':progress<.82?'airborne':'land';
 const a=artPoint(from),b=artPoint(to),height=(e.zone.startsWith('back')?40:64)*Math.sin(air*Math.PI);
 return {phase,progress,travel,height,air,point:worldPoint({x:a.x+(b.x-a.x)*travel,y:a.y+(b.y-a.y)*travel}),from,to};
}
export function stepLeap(e,geometry,dt,rate,map){
 e.progress+=dt*rate;
 const start=PHASE_CREATURE_RULES.leap-LEAP_SECONDS*rate;
 if(!e.leap&&e.progress+1e-8>=start){
  const inside={x:geometry.x+(240-geometry.x)*.15,y:geometry.y+(350-geometry.y)*.15};
  e.leap={from:{x:e.x,y:e.y},to:nearestWalkablePoint(inside,map)||inside,start,rate};
 }
 // Body travel is presentation. Keep the original wall-contact hitbox and
 // entry timing, so adding an animation cannot change patrols or damage.
 return e.progress+1e-8>=PHASE_CREATURE_RULES.leap;
}
export function landedLeapPoint(e){
 const landing=e.leapLanding;if(e.type!=='bladebeast'||e.mode!=='inside'||!landing)return null;
 const a=artPoint(landing.from),to=artPoint(landing.to),current=artPoint(e),dx=to.x-a.x,dy=to.y-a.y,length=dx*dx+dy*dy;
 const remaining=1-clamp(((current.x-a.x)*dx+(current.y-a.y)*dy)/(length||1));
 return remaining>0?worldPoint({x:current.x+dx*remaining,y:current.y+dy*remaining}):null;
}
export function resetLeap(e){
 if(e.leap&&e.mode==='attack')Object.assign(e,e.leap.from);
 delete e.leap;
}
