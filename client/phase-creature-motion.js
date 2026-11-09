import {PHASE_CREATURE_RULES as R} from '../src/phase-creatures.js';
import {leapFrame,landedLeapPoint} from '../src/creature-leap.js';
import {artPoint} from '../src/yard-geometry.js';

const clamp=n=>Math.max(0,Math.min(1,n));
const smooth=n=>{const p=clamp(n);return p*p*(3-2*p);};
export function phaseCreaturePose(b,e,t,reduced=false,{moving=false,distance=0}={}){
 t=b.paused?b.elapsed:t;
 const walk=moving&&e.stun<=0,stride=distance/({bladebeast:25,shellcrab:19,sporetoad:30,echomantis:25}[e.type]||25);
 const pose={phase:'idle',sx:1,sy:1,angle:0,dy:0,height:0,charge:0,open:0,airborne:false,clock:t,locomotion:walk?'walk':'still',stride,strike:0,windup:0,hurt:0,exhale:0};
 if(!reduced&&e.stun<=0){
  const wave=walk?Math.sin(stride*Math.PI*2):Math.sin(t*2.1)*.24;
  pose.sx+=wave*.012;pose.sy-=Math.abs(wave)*.012;pose.dy=-Math.abs(wave)*(e.type==='sporetoad'?1.8:.9);pose.angle=wave*(e.type==='shellcrab'?.8:1.3);
 }
 const active=(e.mode==='attack'||e.type==='sporetoad'&&e.mode==='inside')&&e.stun<=0;
 if(e.type==='bladebeast'){
  const lead=b.paused||e.stun>0?0:Math.max(0,Math.min(.1,t-b.elapsed)),leap=leapFrame(e,lead);
  pose.charge=active?clamp(e.progress/R.leap):0;
  if(leap){
   Object.assign(pose,{phase:leap.phase,ground:artPoint(leap.point),leap,airborne:leap.phase==='airborne',height:reduced?Math.min(12,leap.height):leap.height});
   if(leap.phase==='crouch'){const p=smooth(leap.progress/.2);pose.sx=1+p*.12;pose.sy=1-p*.25;pose.angle=reduced?0:-7*p;}
   else if(leap.phase==='airborne'){pose.sx=1.08;pose.sy=1.06;pose.angle=reduced?0:-18+leap.air*32;pose.dy=-pose.height;}
   else{const impact=Math.sin(clamp((leap.progress-.82)/.18)*Math.PI);pose.sx=1+impact*.13;pose.sy=1-impact*.2;pose.phase='land';}
  }else if(active){pose.phase='gather';pose.sy=1-pose.charge*.07;pose.sx=1+pose.charge*.04;}
  const landing=landedLeapPoint(e);if(!leap&&landing)pose.ground=artPoint(landing);
  const interrupted=b.events.findLast(v=>v.type==='leap-cancel'&&v.enemyId===e.id&&v.time<=t),age=interrupted?t-interrupted.time:Infinity;
  if(!leap&&age<.35){
   const p=smooth(age/.35),from=artPoint(interrupted.from),to=artPoint(interrupted.to);
   Object.assign(pose,{phase:'fall',interrupted:true,ground:{x:from.x+(to.x-from.x)*p,y:from.y+(to.y-from.y)*p},height:reduced?0:(interrupted.height||0)*(1-p),airborne:!reduced&&p<.75});
   pose.dy=-pose.height;pose.angle=reduced?0:(1-p)*20;pose.sy=1-Math.sin(p*Math.PI)*.15;
  }
 }else if(e.type==='shellcrab'){
  pose.open=e.shellExposedUntil>t?smooth((t-(e.shellOpenedAt??t-1))/.22)*smooth((e.shellExposedUntil-t)/.3):0;
  pose.phase=pose.open>0?'open':'armored';pose.sx+=pose.open*.035;pose.sy-=pose.open*.055;
  if(!reduced&&active){pose.angle=Math.sin(e.attack/3.5*Math.PI)*2.5;pose.dy=-Math.max(0,Math.sin(e.attack/3.5*Math.PI))*1.5;}
 }else if(e.type==='sporetoad'){
  pose.charge=active?clamp(e.progress/R.spores):0;pose.phase=active?'inflate':'idle';
  pose.sx+=pose.charge*.12;pose.sy+=pose.charge*.1;pose.dy=-pose.charge*2;
  if(!reduced&&active)pose.sy+=Math.sin(e.progress*10)*.012*pose.charge;
  const burst=b.events.findLast(v=>v.type==='spores'&&v.enemyId===e.id&&v.time<=t),age=burst?t-burst.time:Infinity;
  if(age<.55){const recoil=reduced?0:Math.sin(age/.55*Math.PI);pose.phase='exhale';pose.exhale=recoil;pose.sy-=recoil*.12;pose.sx+=recoil*.06;}
 }else if(e.type==='echomantis'){
  pose.shifting=!!e.echoPath?.length&&e.mode==='approach';pose.phase=pose.shifting?'shift':'listen';
  if(pose.shifting&&b.paused)pose.ground=artPoint(e);
  if(!reduced&&e.stun<=0){const beat=Math.sin(t*(pose.shifting?22:7));pose.sx+=beat*(pose.shifting?.035:.012);pose.angle=beat*(pose.shifting?3:1);}
 }
 const impact=b.events.findLast(v=>v.enemyId===e.id&&v.type==='enemy-hit'&&v.time<=t),attackAge=impact?t-impact.time:Infinity;
 if(e.stun<=0&&!pose.airborne&&attackAge>=0&&attackAge<.52){
  pose.attack=impact;pose.strike=reduced?.65:Math.sin(Math.min(1,attackAge/.34)*Math.PI);
  if(!reduced){pose.lunge=pose.strike*(e.type==='shellcrab'?3:4.5);pose.angle+=pose.strike*(e.type==='sporetoad'?4:5);}
  if(['idle','listen'].includes(pose.phase))pose.phase='strike';
 }
 if(active&&attackAge>=.52)pose.windup=clamp(e.attack/({shellcrab:3.5,echomantis:1.8,bladebeast:1.8,sporetoad:2.4}[e.type]||2));
 const hit=b.events.findLast(v=>v.enemyId===e.id&&['attack','armor-hit','heavy'].includes(v.type)&&v.time<=t),age=hit?t-hit.time:Infinity;
 if(!pose.airborne&&age>=0&&age<.3){
  pose.hurt=1-age/.3;
  if(!reduced){const kick=Math.sin(age/.3*Math.PI);pose.dx=(hit.source?.x>e.x?-1:1)*kick*2;pose.angle-=kick*4;}
 }
 if(e.stun>0&&pose.phase!=='fall')pose.phase=pose.airborne?'interrupted':e.type==='shellcrab'&&pose.open?'open':'stunned';
 if(pose.airborne)pose.locomotion='airborne';
 else if(['crouch','land','fall'].includes(pose.phase))pose.locomotion='still';
 return pose;
}

// Coordinates within the visible painted body, including its actual mirrored
// origin and rotation. Sacs, seams and wing effects stay attached to the animal.
export function phaseBodyPoint(sprite,meta,u,v){
 const [l,top,r,bottom]=meta.bounds;
 let x=l+(r-l)*u;if(sprite.flipX)x=sprite.frame.cutWidth-x;
 const y=top+(bottom-top)*v,dx=(x-sprite.originX*sprite.frame.cutWidth)*sprite.scaleX,dy=(y-sprite.originY*sprite.frame.cutHeight)*sprite.scaleY;
 const angle=sprite.rotation??sprite.angle*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
 return {x:sprite.x+dx*c-dy*s,y:sprite.y+dx*s+dy*c};
}
export function animatePhaseCreature(obj,b,e,t,meta,reduced=false){
 const pose=phaseCreaturePose(b,e,t,reduced,{moving:obj.moving,distance:obj.distance}),sprite=obj.sprite;
 if(pose.ground){obj.x=pose.ground.x;obj.y=pose.ground.y;}
 sprite.setPosition(obj.x+(pose.dx||0)+(pose.lunge||0)*(sprite.flipX?-1:1),obj.y+pose.dy).setScale(sprite.scaleX*pose.sx,sprite.scaleY*pose.sy)
  .setAngle(pose.angle*(sprite.flipX?-1:1));
 const [l,top,r,bottom]=meta.bounds;
 const visual={...pose,bodyWidth:(r-l)*sprite.scaleX,bodyHeight:(bottom-top)*sprite.scaleY,meta,
  foot:{x:obj.x,y:obj.y},head:phaseBodyPoint(sprite,meta,.8,.45),core:phaseBodyPoint(sprite,meta,.5,.42)};
 visual.top=Math.min(...[[0,0],[1,0],[0,1],[1,1]].map(([u,v])=>phaseBodyPoint(sprite,meta,u,v).y));
 obj.phaseVisual=visual;obj.ignoreFenceOcclusion=pose.airborne;
 obj.label.setPosition(Math.max(obj.label.width/2+4,Math.min(480-obj.label.width/2-4,obj.x)),obj.y+pose.dy+6);
 return visual;
}

// A shell can be a real composite of the existing painted source: the lower
// body stays in place and two cropped carapace panels hinge apart. Crop the
// occlusion copy too, so a closed ghost cannot cover the open seam.
export function cropPhaseBody(obj){
 const crop=obj.phaseBodyCrop;
 if(!crop)return;
 for(const image of [obj.sprite,obj.outline])if(image){const f=image.frame;image.setCrop(crop.x*f.cutWidth,crop.y*f.cutHeight,crop.w*f.cutWidth,crop.h*f.cutHeight);}
}
