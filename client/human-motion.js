import {ZONES} from '../src/content.js';
import {artPoint} from '../src/yard-geometry.js';
import {orderDuration} from '../src/night-orders.js';
import {STRIKE_RANGE} from '../src/rules.js';
import {COMBAT} from '../src/balance.js';

export const HUMAN_ACTIONS={heavy:'蓄力重击',repair:'敲击修补',barricade:'加固小屋',fire:'俯身引火',stoke:'拨旺炉火',addWood:'抱柴添火',extinguish:'压灭炉火',clearWet:'清理湿污',compact:'踏实土道',bait:'放置诱饵',throw:'抬臂投掷',brace:'稳住防线',guard:'警戒',aid:'包扎伤口'};
const clamp=n=>Math.max(0,Math.min(1,n));
const ease=n=>{n=clamp(n);return n*n*(3-2*n);};
const close=(a,b)=>a&&b&&Math.hypot(a.x-b.x,a.y-b.y)<2;
// A hit event is the contact, not the start of a windup. Follow through from
// that contact, fold the wrist on recoil, then settle into the guard pose.
const STRIKE_BEATS=[
 [0,-76,-8,2.4,4],[.075,-92,12,3.2,6],[.23,-44,-24,.7,-.5],[.42,-28,-8,0,-2],[.56,-28,-8,0,-2]
];
const HEAVY_BEATS=[
 [0,-94,-10,3.8,7],[.09,-112,12,4.4,9],[.28,-48,-26,1,0],[.48,-28,-8,0,-2],[.56,-28,-8,0,-2]
];
const THROW_BEATS=[
 [0,-98,8,2,-3],[.09,-64,22,2.6,5],[.26,-40,-18,.8,1],[.46,-28,-8,0,-2],[.56,-28,-8,0,-2]
];
function contactPose(age,beats){
 const next=beats.findIndex(beat=>beat[0]>age);if(next<0)return beats.at(-1).slice(1);
 const a=beats[Math.max(0,next-1)],c=beats[next],u=ease((age-a[0])/(c[0]-a[0]||1));
 return a.slice(1).map((value,i)=>value+(c[i+1]-value)*u);
}
function performed(e,p){
 if(e.robotId)return false;
 if(e.personId)return e.personId===p.id;
 // Older saved nights do not carry actor IDs. Never borrow another actor's
 // event just because it happened in the same defensive zone.
 return close(e.source,p);
}
export function humanActionTarget(b,p){
 const task=p.task;if(!task)return null;
 if(task.type==='move')return task.target;
 if(['aid','retreat','barricade'].includes(task.type))return null;
 if(['fire','stoke','addWood','extinguish','clearWet'].includes(task.type))return b?.fires?.find(f=>f.id===task.target)||null;
 return ZONES.find(z=>z.id===task.target)||null;
}

// All beats use simulation progress/time or travelled distance. No independent
// timers, tweens or fabricated attacks can continue after a pause.
export function humanPose(b,p,t,{moving=false,distance=0,reduced=false}={}){
 const clock=b?.paused?b.elapsed:t,seed=[...p.id].reduce((n,c)=>n+c.charCodeAt(0),0)%19;
 const pose={phase:'idle',label:'休息待命',dx:0,dy:0,angle:0,sx:1,sy:1,arm:0,wrist:0,rig:false,beat:0,contact:0,aim:null,progress:0,workProgress:0,clock};
 if(p.wound==='severe'){pose.phase=moving?'crawl':'seated';pose.label=moving?'缓慢撤离':'重伤休息';return pose;}
 const tired=p.stamina<25||p.fatigue>=65;
 if(moving){
  pose.phase=p.task?.type==='retreat'||p.nightRole==='sleep'?'retreat':'walk';pose.label=pose.phase==='retreat'?'撤回休整':'赶往岗位';
  if(!reduced){const step=distance/28*Math.PI*2;pose.dy=-Math.abs(Math.sin(step))*(tired?.45:.9);pose.angle=Math.sin(step)*.8+(tired?2:0);}
 }else{
  pose.phase=tired?'tired':'idle';pose.label=tired?'疲惫喘息':'休息待命';
  if(!reduced){const breath=Math.sin(clock*(tired?2.5:1.7)+seed);pose.sy=1+breath*(tired?.006:.003);pose.angle=tired?2:0;}
 }
 const task=p.task,working=task&&task.stage==='work'&&!moving;
 if(working)pose.progress=pose.workProgress=clamp(Math.max(0,task.progress||0)/orderDuration(p,task.type,b?.aidKit));
 if(working&&HUMAN_ACTIONS[task.type]&&!['guard','brace'].includes(task.type)){
  pose.phase=task.type;pose.label=HUMAN_ACTIONS[task.type];pose.rig=true;pose.aim=humanActionTarget(b,p);
  const progress=Math.max(0,task.progress||0);
  pose.beat=(progress/(task.type==='compact'?.9:.82))%1;
  const beat=pose.beat,stroke=ease(beat/.34)-ease((beat-.4)/.6);
  pose.arm=-24-stroke*32;pose.angle=2+stroke*3;pose.dy=stroke*.6;
  pose.wrist=-8-stroke*12;
  if(['repair','barricade'].includes(task.type)){
   const lift=ease(beat/.4),drop=ease((beat-.4)/.15),recover=ease((beat-.62)/.38);
   pose.arm=-18-65*lift+79*drop-14*recover;pose.angle=-2*lift+6*drop-4*recover;
   pose.contact=beat>=.53&&beat<.75?1-(beat-.53)/.22:0;
  }else if(task.type==='heavy'){
   pose.arm=-30-85*pose.workProgress;pose.angle=-4*pose.workProgress;
  }else if(task.type==='throw'){
   pose.arm=-38-100*ease(pose.progress);pose.angle=-5*ease(pose.progress);pose.dy=0;
  }else if(task.type==='compact'){
   pose.arm=-20;pose.angle=2+stroke*3;pose.dy=-Math.sin(beat*Math.PI)*2;pose.sy=1-stroke*.025;pose.contact=beat>.82?(beat-.82)/.18:0;
  }else if(['fire','stoke','addWood','extinguish','clearWet','bait','aid'].includes(task.type)){
   pose.angle=7+stroke*3;pose.sy=.97;pose.arm=-46-stroke*22;
  }
 }
 const canDrive=p.nightRole!=='sleep'&&(!task||task.type==='guard'||task.type==='move'&&task.stage==='work');
 const opponent=canDrive&&b?.enemies?.find(e=>e.hp>0&&!e.bossDormant&&e.mode!=='retreat'&&(!task?.threatIds||task.threatIds.includes(e.id))&&Math.hypot(e.x-p.x,e.y-p.y)<=STRIKE_RANGE);
 if(opponent&&p.cooldown>0&&p.cooldown<=.22&&p.stamina>COMBAT.strike.minimumStamina){
  const prepare=ease((.22-p.cooldown+Math.max(0,clock-b.elapsed))/.22);
  pose.phase='windup';pose.label='蓄势驱赶';pose.rig=true;pose.aim=opponent;
  pose.arm=-28+18*prepare;pose.wrist=-8-18*prepare;pose.angle=-2-2*prepare;
 }
 const attack=b?.events.findLast(e=>['attack','throw','heavy'].includes(e.type)&&performed(e,p)&&clock>=e.time&&clock-e.time<.56);
 if(attack){
  const age=clock-attack.time,u=clamp(age/.56);
  pose.phase=attack.type==='throw'?'release':'strike';pose.label=attack.type==='throw'?'投出':attack.type==='heavy'?'蓄力重击':'挥击驱赶';pose.rig=true;pose.event=attack;pose.aim=attack;pose.beat=u;pose.progress=1;
  [pose.arm,pose.wrist,pose.dx,pose.angle]=contactPose(age,attack.type==='throw'?THROW_BEATS:attack.type==='heavy'?HEAVY_BEATS:STRIKE_BEATS);
  pose.dy=-Math.sin(u*Math.PI)*.6;pose.contact=Math.max(0,1-age/.18);
 }
 if(!pose.rig&&!moving&&b&&p.nightRole!=='sleep'&&(p.cooldown>0||['brace','guard'].includes(task?.type))){
  pose.phase='ready';pose.label='侧身警戒';pose.rig=true;pose.arm=-28;pose.wrist=-8;pose.angle=-2;pose.aim=humanActionTarget(b,p);
 }
 if(reduced){
  pose.dx=pose.dy=pose.angle=0;pose.sx=pose.sy=1;pose.contact=0;
  if(pose.rig)pose.arm=pose.phase==='throw'?-100:pose.phase==='release'?-35:pose.phase==='strike'?-65:pose.phase==='ready'?-28:-45;
  pose.wrist=pose.rig?-8:0;
 }
 return pose;
}

export function animateHuman(obj,b,p,t,sheet,reduced=false){
 const pose=humanPose(b,p,t,{moving:obj.moving,distance:obj.distance,reduced}),sprite=obj.sprite;
 // Pose targets are world coordinates; sprites and motion anchors are art coordinates.
 const aim=pose.aim&&artPoint(pose.aim);
 if(pose.rig&&aim&&Math.abs(aim.x-obj.x)>2)obj.facing=Math.sign(aim.x-obj.x);
 if(!obj.wounded){
  const frame=pose.rig?Math.floor(Number(sprite.frame.name)/4)*4+1:Number(sprite.frame.name),meta=sheet.frames[frame],flip=obj.facing<0;
  const scale=meta.renderScale||(sheet.displaySize||75)/(sheet.cellSize||313.5);
  sprite.setFrame(String(frame)).setOrigin(flip?1-meta.origin[0]:meta.origin[0],meta.origin[1]).setFlipX(flip)
   .setPosition(obj.x+pose.dx*obj.facing,obj.y+pose.dy).setScale(scale*pose.sx,scale*pose.sy).setAngle(pose.angle*obj.facing);
 }
 obj.humanVisual={...pose,aim};
 if(pose.rig)obj.label.setText(`${p.name}\n${pose.label}`);
 return obj.humanVisual;
}
