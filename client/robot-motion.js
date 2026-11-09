import {ROBOT_RULES,ROBOT_TYPES} from '../src/robots.js';
import {NIGHT_ACTIONS} from '../src/balance.js';
import {ZONES} from '../src/content.js';
import {artPoint,worldPoint} from '../src/yard-geometry.js';
import {moveToward,nearestWalkablePoint} from '../src/movement.js';

const DAY_PATROL=[
 {x:146,y:324},{x:203,y:316},{x:277,y:316},{x:333,y:329},
 {x:351,y:390},{x:287,y:416},{x:206,y:418},{x:147,y:389},
].map(worldPoint);

// Daytime patrols live on the display tokens and use the same yard obstacles as night movement.
export function createDayRobotPatrol(slot,walkMap){
 const index=slot*2%DAY_PATROL.length,start=DAY_PATROL[index];
 return {...(nearestWalkablePoint(start,walkMap)??start),next:(index+1)%DAY_PATROL.length,wait:slot*.18};
}
export function stepDayRobotPatrol(patrol,type,dt,walkMap){
 if(patrol.wait>0){patrol.wait-=dt;return;}
 const speed=Math.min(30,ROBOT_TYPES[type].speed*.62);
 if(moveToward(patrol,DAY_PATROL[patrol.next],speed,dt,true,walkMap)){
  patrol.next=(patrol.next+1)%DAY_PATROL.length;
  patrol.wait=.65;
 }
}

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const live=e=>e.hp>0&&e.mode!=='retreat'&&!e.bossDormant;
const recent=(b,test,t,life)=>{const e=b?.events.findLast(e=>test(e)&&e.time<=t);return e&&t-e.time<life?e:null;};
const clamp=n=>Math.max(0,Math.min(1,n));
// Presentation reads only authoritative work progress, attack events and cues.
// Every clock is derived from simulation time/distance, so a pause freezes it.
export function robotPose(b,r,t,{moving=false,distance:walk=0,reduced=false}={}){
 const row={repair:0,defense:1,dispatch:2}[r.type],clock=b?.paused?b.elapsed:t;
 const pose={phase:'idle',frame:row*4,angle:0,dx:0,dy:0,sx:1,sy:1,aim:null,work:0,beat:0,flash:0};
 if(r.hp<=0||!r.enabled||r.powered===false){pose.phase=r.hp<=0?'broken':'offline';pose.angle=reduced?0:7;pose.sy=.94;return pose;}
 const signal=r.lastSignal&&clock-r.lastSignal.at>=0&&clock-r.lastSignal.at<.85?r.lastSignal:null;
 const sent=recent(b,e=>e.type==='robot-dispatch'&&e.dispatcherId===r.id,clock,1.25);
 const attack=recent(b,e=>['attack','heavy'].includes(e.type)&&e.robotId===r.id,clock,.55);
 const hit=recent(b,e=>e.type==='enemy-hit'&&e.targetId===r.id,clock,.42);
 const task=r.task,zone=task&&ZONES.find(z=>z.id===task.zone);
 if(zone)pose.aim=zone;
 if(task?.type==='robot-repair'){pose.targetRobotId=task.robotId;pose.aim=b?.robots?.find(q=>q.id===task.robotId)||zone;}
 if(task?.type==='campfire')pose.aim=b?.fires?.find(f=>f.id===task.target);
 if(moving){
  pose.phase='travel';const cycle=walk/(r.type==='dispatch'?5:7),beat=Math.sin(cycle*Math.PI);
  pose.frame=row*4+Math.floor(cycle)%2;
  if(!reduced){pose.dy=r.type==='dispatch'?-Math.abs(beat)*.35:-Math.abs(beat)*1.4;pose.angle=r.type==='dispatch'?2.5:beat*1.6;pose.sx=1+Math.abs(beat)*.012;pose.sy=1-Math.abs(beat)*.018;}
 }
 if(r.type==='repair'&&['repair','robot-repair','campfire'].includes(task?.type)&&task.progress>0&&!moving){
  const duration=task.type==='campfire'?NIGHT_ACTIONS.times[task.action]:ROBOT_RULES.repairSeconds;
  pose.phase='repair';pose.work=clamp(task.progress/duration);pose.beat=(task.progress/.65)%1;pose.frame=row*4+(pose.beat<.46?2:3);
  if(!reduced){pose.angle=pose.beat<.46?-3:4;pose.dx=pose.beat<.46?-1:1.6;pose.dy=Math.sin(pose.beat*Math.PI)*.6;}
 }else if(r.type==='defense'&&task?.type==='heavy'&&!attack){
  pose.phase='charge';pose.frame=row*4+2;pose.work=clamp(task.progress/ROBOT_RULES.heavySeconds);pose.aim=b?.enemies.find(e=>e.id===task.enemyId)||zone;if(!reduced)pose.angle=-8*pose.work;
 }else if(r.type==='defense'&&(task?.type==='defense'||attack)){
  const enemy=b?.enemies.filter(e=>live(e)&&e.zone===(task?.zone||attack?.zone)).sort((a,c)=>distance(r,a)-distance(r,c))[0];
  if(enemy)pose.aim=enemy;
  if(attack){pose.phase='strike';pose.frame=row*4+3;pose.aim=attack;pose.beat=clamp((clock-attack.time)/.55);if(!reduced){const kick=Math.sin(pose.beat*Math.PI);pose.dx=kick*4;pose.angle=kick*7;pose.sx=1+kick*.035;}pose.attack=attack;}
  else if(!moving&&enemy&&distance(r,enemy)<=ROBOT_RULES.strikeRange+3){pose.phase='brace';pose.frame=row*4+2;pose.beat=1-clamp(r.cooldown/ROBOT_RULES.strikeSeconds);if(!reduced)pose.angle=-pose.beat*3;}
 }else if(r.type==='dispatch'){
  if(sent){pose.phase='transmit';pose.frame=row*4+3;pose.aim=sent.target||ZONES.find(z=>z.id===sent.zone);pose.signal=sent;pose.beat=(clock-sent.time)/1.25;if(!reduced)pose.angle=-2+Math.sin(pose.beat*Math.PI)*3;}
  else if(signal){pose.phase='listen';pose.frame=row*4+2;pose.aim=signal.point;pose.signal=signal;pose.beat=(clock-signal.at)/.85;if(!reduced)pose.angle=-4;}
 }
 if(r.servicedBy&&!moving){pose.phase='receiving-repair';pose.aim=b?.robots?.find(q=>q.id===r.servicedBy)||pose.aim;}
 if(hit){pose.flash=1-clamp((clock-hit.time)/.42);if(!reduced)pose.dx+=Math.sin((clock-hit.time)*35)*2*pose.flash;}
 if(reduced){pose.angle=pose.dx=pose.dy=0;pose.sx=pose.sy=1;if(pose.phase==='travel')pose.frame=row*4;if(pose.phase==='repair')pose.frame=row*4+3;}
 return pose;
}

export function animateRobot(obj,b,r,t,registration,reduced=false){
 const pose=robotPose(b,r,t,{moving:obj.moving,distance:obj.distance,reduced}),sprite=obj.sprite,meta=registration.frames[pose.frame];
 const aim=pose.aim&&artPoint(pose.aim);
 if(aim&&Math.abs(aim.x-obj.x)>3)obj.facing=Math.sign(aim.x-obj.x);
 const clock=b?.paused?b.elapsed:t;
 if(obj.robotFacing!==undefined&&obj.robotFacing!==obj.facing)obj.robotTurnAt=clock;
 if(obj.robotWasMoving&&!obj.moving)obj.robotBrakeAt=clock;
 obj.robotFacing=obj.facing;obj.robotWasMoving=obj.moving;
 if(!reduced&&pose.phase!=='broken'&&pose.phase!=='offline'){
  const turn=clock-(obj.robotTurnAt??-Infinity),brake=clock-(obj.robotBrakeAt??-Infinity);
  if(turn>=0&&turn<.28){const weight=Math.sin(turn/.28*Math.PI);pose.angle+=weight*4;pose.sx-=weight*.035;pose.turn=weight;}
  if(brake>=0&&brake<.3){const weight=Math.sin(brake/.3*Math.PI);pose.angle-=weight*(r.type==='dispatch'?4:2);pose.sy-=weight*.025;pose.brake=weight;}
 }
 const flip=obj.facing<0,sign=flip?-1:1;
 sprite.setTexture('robots-rig',String(pose.frame)).setOrigin(flip?1-meta.origin[0]:meta.origin[0],meta.origin[1]).setFlipX(flip)
  .setPosition(obj.x+pose.dx*sign,obj.y+pose.dy).setScale(meta.renderScale*pose.sx,meta.renderScale*pose.sy).setAngle(pose.angle*sign);
 obj.baseTint=pose.phase==='broken'?0x77716a:pose.phase==='offline'?0x99928a:pose.flash>0?0xf4c29a:null;
 const fireTask=r.task?.type==='campfire';
 const label={travel:!b?'院内巡游':fireTask?'前往篝火':r.task?.type==='robot-repair'?'靠近维修':r.task?.dispatcher?'响应调度':'按路线巡逻',repair:fireTask?'照看篝火':pose.targetRobotId?'修理机体':'工具作业','receiving-repair':'接受维修',brace:'举盾警戒',strike:'挥击',listen:'侧头监听',transmit:'发送调度',broken:b?'损坏停机':'损坏待修',offline:b?'缺油／停机':'手动停机',idle:'待机'}[pose.phase];
 obj.label.setText(`${{repair:'维修',defense:'防卫',dispatch:'调度'}[r.type]}${r.id.split('-').at(-1)}\n${label}`);
 obj.robotVisual={...pose,aim,clock:b?.paused?b.elapsed:t,label};
 return obj.robotVisual;
}
