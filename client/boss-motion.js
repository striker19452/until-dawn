import {facingFlip} from './creature-facing.js';
import {bossSpriteForm} from '../src/boss-content.js';
// Logical coordinates are the point of contact with the wall. Large painted
// bodies need a separate foot anchor: otherwise their chest crosses the gate.
export function bossRenderPoint(e,toArt,sheet){
 const p=toArt(e);if(e.mode==='inside'||e.bossBrood||e.bossDownMode==='inside'&&e.bossDormant)return p;
 const frame=sheet.frames[bossSpriteForm(e)*4],height=Math.min(104,frame.rect[3]*sheet.displaySize/sheet.cellSize);
 if(e.zone==='gate')return {x:p.x,y:p.y+height+27};
 if(e.zone==='left'||e.zone==='right')return {x:p.x,y:p.y+18};
 return {x:p.x,y:p.y-12};
}

const clamp=n=>Math.max(0,Math.min(1,n)),smooth=n=>{const v=clamp(n);return v*v*(3-2*v);};
export function bossPose(b,e,t,reduced=false,moving=false,distance=null){
 t=b.paused?b.elapsed:t;
 const bs=b.boss,phase=e.bossBrood?'brood':bs?.phase,active=e.mode==='attack'||e.mode==='inside';
 const wave=Math.sin(t*(e.type==='cinderwhale'?2.7:4.2)),stride=Math.sin(distance===null?t*(e.bossForm?10:7):distance/(e.bossForm?14:28)*Math.PI*2);
 const pose={angle:0,dx:0,dy:0,sx:1,sy:1,alpha:1,roll:0,phase,facing:e.zone==='left'?1:e.zone==='right'?-1:null};
 if(!reduced){pose.sx+=wave*.018;pose.sy-=wave*.022;
  if(moving){
   const gait={bastion:{angle:1.8,lift:2,sway:.016},broodmother:{angle:1.2,lift:1.1,sway:.025},cinderwhale:{angle:1,lift:.8,sway:.035},twinvein:{angle:2.8,lift:e.bossForm?3.5:2,sway:.018}}[e.type]||{angle:2.8,lift:2.5,sway:.012};
   pose.angle=stride*gait.angle;pose.dy=-Math.abs(stride)*gait.lift;pose.sx+=stride*gait.sway;
  }
 }
 if(e.bossDormant){Object.assign(pose,{angle:-78,sy:.72,alpha:.48,phase:'dormant'});return pose;}
 if(!active)return pose;
 if(e.type==='bastion'&&phase==='exposed'){
  const since=Math.max(0,t-(bs.exposedAt??b.events.findLast(v=>v.type==='boss-break'&&v.enemyId===e.id)?.time??t));
  const remaining=Math.max(0,bs.clock-(t-b.elapsed));
  pose.roll=reduced?1:smooth(since/.55)*smooth(remaining/.5);
  pose.angle=180*pose.roll+(reduced?0:Math.sin(t*8)*2*pose.roll);
  pose.sx=1-.4*Math.sin(pose.roll*Math.PI);pose.sy=1-.08*pose.roll;pose.dy=0;
 }else if(phase==='charge'&&e.type==='bastion'){
  const p=clamp(bs.clock/5),shake=reduced?0:Math.sin(t*(18+p*24))*p*2.8;
  pose.angle=reduced?0:-5*p;pose.sx=1+p*.045;pose.sy=1-p*.07;pose.dx=shake;
  pose.dy=p<.85?p*7:7-(p-.85)/.15*13;
 }else if(phase==='siphon'){
  const p=clamp(bs.clock/8);pose.sx=1+p*.08;pose.sy=1+p*.08+(reduced?0:wave*.025);pose.dy=-p*3;
 }else if(phase==='nesting'&&!reduced){pose.angle=wave*1.8;pose.dy=-Math.max(0,wave)*2;}
 else if(e.type==='twinvein'&&!reduced){pose.angle=wave*(e.bossForm===2?-3:3);pose.dy=-Math.max(0,wave)*3;}
 if(phase!=='exposed'&&!reduced){
  const hit=b.events.findLast(v=>v.enemyId===e.id&&['attack','throw','boss-break','hit'].includes(v.type));
  const age=hit?t-hit.time:Infinity;
  if(age>=0&&age<.32){const kick=Math.sin(age/.32*Math.PI);pose.dx+=kick*(e.zone==='left'?-4:4);pose.sy-=kick*.06;}
 }
 return pose;
}

export function animateBoss(obj,b,e,t,reduced){
 const sprite=obj.sprite,width=sprite.displayWidth,height=sprite.displayHeight;
 const pose=bossPose(b,e,t,reduced,obj.moving,obj.distance??null);
 pose.facing=obj.actionFacing??(e.mode==='inside'||e.mode==='approach'||e.bossDormant?obj.facing:pose.facing??obj.facing);
 if(pose.facing!==undefined)sprite.setFlipX(facingFlip(obj.baseFacing??-1,pose.facing));
 // Rotate around the body's centre, so rolling never swings the whole sprite
 // through the wall. The logical foot point and collision rules stay stable.
 sprite.setOrigin(.5,.5).setPosition(obj.x+pose.dx,obj.y-height/2+pose.dy)
  .setScale(sprite.scaleX*pose.sx,sprite.scaleY*pose.sy).setAngle(pose.angle).setAlpha(pose.alpha);
 obj.bossVisual={...pose,width:width*pose.sx,height:height*pose.sy,cx:sprite.x,cy:sprite.y};
 return obj.bossVisual;
}

export function spriteBodyBounds(sprite,bounds){
 const frame=sprite.frame,left=sprite.flipX?frame.cutWidth-bounds[2]:bounds[0],right=sprite.flipX?frame.cutWidth-bounds[0]:bounds[2];
 const c=Math.cos(sprite.rotation),s=Math.sin(sprite.rotation);
 const corners=[[left,bounds[1]],[right,bounds[1]],[right,bounds[3]],[left,bounds[3]]].map(([x,y])=>{
  const dx=(x-sprite.originX*frame.cutWidth)*sprite.scaleX,dy=(y-sprite.originY*frame.cutHeight)*sprite.scaleY;
  return {x:sprite.x+dx*c-dy*s,y:sprite.y+dx*s+dy*c};
 });
 const x=Math.min(...corners.map(p=>p.x)),y=Math.min(...corners.map(p=>p.y));
 return {left:x,top:y,width:Math.max(...corners.map(p=>p.x))-x,height:Math.max(...corners.map(p=>p.y))-y};
}
