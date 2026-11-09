import {PHASE_CREATURE_RULES as R} from '../src/phase-creatures.js';
import {phaseBodyPoint} from './phase-creature-motion.js';
import {spriteBodyBounds} from './boss-motion.js';
import {ZONES} from '../src/content.js';

const clamp=n=>Math.max(0,Math.min(1,n));
const palette={blade:0xc4cf8b,shell:0xf2c372,spore:0xc5b5df,echo:0x9cdccc};
const ring=(g,p,w,h,color,alpha=1)=>{g.lineStyle(1.6,color,alpha);g.strokeEllipse(p.x,p.y,w,h);};
function dust(g,p,age,reduced,color=0xb9a27b){
 const fade=clamp(1-age/.65);if(!fade)return;
 for(let i=0;i<(reduced?4:10);i++){
  const angle=i*2.4,spread=reduced?10:5+age*(22+i%3*8),lift=reduced?0:Math.sin(clamp(age/.65)*Math.PI)*(6+i%3*3);
  g.fillStyle(i%2?color:0x746a50,fade*.7);g.fillEllipse(p.x+Math.cos(angle)*spread,p.y+Math.sin(angle)*spread*.35-lift,3+i%3,2);
 }
}
function cropImage(image,crop){const f=image.frame;image.setCrop(crop.x*f.cutWidth,crop.y*f.cutHeight,crop.w*f.cutWidth,crop.h*f.cutHeight);}
export function createPhaseCreatureFeedback(scene,toArt,reduced=false){
 const pieces=new Map();let used=new Set(),lastBattle=null;
 function remove(piece){piece.outlines?.remove(piece);piece.sprite.destroy();}
 function part(key,texture,frame){
  used.add(key);let piece=pieces.get(key);
  if(!piece){piece={isCreature:true,sprite:scene.add.image(0,0,texture,frame)};pieces.set(key,piece);}
  piece.sprite.setTexture(texture,frame).setVisible(true).setCrop().clearTint().setRenderNodeRole('BatchHandler','BatchHandlerQuadSingle');return piece;
 }
 function begin(b){used=new Set();if(lastBattle!==b?.id){for(const p of pieces.values())remove(p);pieces.clear();lastBattle=b?.id;}}
 function shellPanels(e,obj,context){
  const {sprite,phaseVisual:v}=obj,{meta}=v,[l,top,r,bottom]=meta.bounds;
  const cut=top+(bottom-top)*.54,mid=(l+r)/2;
  obj.phaseBodyCrop={x:0,y:cut/sprite.frame.cutHeight,w:1,h:1-cut/sprite.frame.cutHeight};
  for(const side of [-1,1]){
   const p=part(e.id+'-shell-'+side,sprite.texture.key,sprite.frame.name),hingeU=side<0?.18:.82;
   const hinge=phaseBodyPoint(sprite,meta,hingeU,.54),hingeX=l+(r-l)*hingeU,flip=sprite.flipX?-1:1;
   p.x=obj.x;p.y=obj.y+.02;
   p.sprite.setOrigin(sprite.flipX?1-hingeX/sprite.frame.cutWidth:hingeX/sprite.frame.cutWidth,cut/sprite.frame.cutHeight)
    .setPosition(hinge.x+side*flip*v.open*5,hinge.y-v.open*2).setScale(sprite.scaleX,sprite.scaleY)
    .setFlipX(sprite.flipX).setAngle(sprite.angle+side*flip*v.open*11).setAlpha(1);
   const bounds=[side<0?l:mid,top,side<0?mid:r,cut],body=spriteBodyBounds(p.sprite,bounds);
   if(body.left<4){p.sprite.x+=4-body.left;body.left=4;}
   if(body.left+body.width>476){p.sprite.x-=body.left+body.width-476;body.left=476-body.width;}
   const crop={x:bounds[0]/sprite.frame.cutWidth,y:top/sprite.frame.cutHeight,w:(bounds[2]-bounds[0])/sprite.frame.cutWidth,h:(cut-top)/sprite.frame.cutHeight};
   if(context?.outlines&&context?.components){p.outlines=context.outlines;context.outlines.show(p,context.components.occlusionLayers(p,body));}
   else p.sprite.setDepth(610+p.y/1000);
   cropImage(p.sprite,crop);if(p.outline)cropImage(p.outline,crop);
  }
 }
 function echoCopies(b,e,obj,t,context){
  if(reduced)return 0;
  const points=(e.echoTrail||[]).filter(p=>t-p.time>=.12&&t-p.time<.6).slice(-3);
  for(const [i,point]of points.entries()){
   const ghost=part(e.id+'-echo-'+i,'creatures-phase',obj.sprite.frame.name),p=toArt(point),age=t-point.time;
   ghost.sprite.setOrigin(obj.sprite.originX,obj.sprite.originY).setPosition(p.x,p.y-2).setScale(obj.sprite.scaleX,obj.sprite.scaleY)
    .setFlipX(obj.sprite.flipX).setAngle(obj.sprite.angle).setTint(0x77c7b7).setAlpha((1-age/.6)*.25).setDepth(609.8+p.y/1000);
   const bounds=spriteBodyBounds(ghost.sprite,obj.phaseVisual.meta.bounds),layers=context?.components?.occlusionLayers(p,bounds)||[];
   ghost.sprite.setVisible(!layers.length);
  }
  return points.length;
 }
 function drawCreature(b,e,obj,t,ground,fx,context){
  const v=obj.phaseVisual;if(!v)return [];
  const {meta,foot}=v,sprite=obj.sprite,records=[],body=(u,y)=>phaseBodyPoint(sprite,meta,u,y);
  if(v.hurt>0){obj.hitTint=v.hurt>.35?0xffd5ab:null;records.push({type:'creature-recoil',enemyId:e.id,strength:v.hurt});}
  if(v.locomotion==='walk'){
   records.push({type:'creature-gait',enemyId:e.id,stride:v.stride,limbs:Object.keys(obj.phaseJoints||{}),distanceDriven:true});
   if(!reduced&&(v.stride%1)<.15)for(const id of ['legFront','legRear']){const at=obj.phaseAnchors?.[id];if(at){ground.lineStyle(1,0xb4a488,.25);ground.lineBetween(at.x-2,at.y+1,at.x+3,at.y+1);}}
  }
  if(v.attack)records.push({type:'creature-strike',enemyId:e.id,eventId:v.attack.id,targetId:v.attack.targetId,strike:v.strike});
  // Shadows stay on the ground while the body rises. They never follow sprite Y.
  if(e.type==='bladebeast'){
   const h=v.height,alpha=.28*(1-h/120);ground.fillStyle(0x121c19,alpha);ground.fillEllipse(foot.x,foot.y+1,Math.max(22,v.bodyWidth*.62-h*.2),9+h*.035);
   if(v.leap){
    const from=toArt(v.leap.from),to=toArt(v.leap.to);
    if(v.phase==='crouch'){for(const side of [-1,1]){ground.lineStyle(2,palette.blade,.65);ground.lineBetween(from.x+side*13,from.y+4,from.x+side*22,from.y+7);}dust(ground,from,v.leap.progress*.5,reduced);}
    if(v.airborne){
     const marker={x:to.x,y:to.y+2};ring(ground,marker,27,10,palette.blade,.6);
     if(!reduced)for(let i=0;i<3;i++){const at=body(.1+i*.07,.65);fx.lineStyle(1.6,palette.blade,.4-i*.08);fx.lineBetween(at.x-12*(sprite.flipX?-1:1),at.y+9+i*4,at.x-3*(sprite.flipX?-1:1),at.y+2+i*4);}
    }
    if(v.phase==='land')dust(ground,to,(v.leap.progress-.82)/.18*.5,reduced);
    records.push({type:'creature-leap',enemyId:e.id,phase:v.phase,height:h,ground:foot,landing:to,airborne:v.airborne});
   }
   if(v.interrupted)records.push({type:'creature-leap',enemyId:e.id,phase:'fall',height:h,ground:foot,airborne:v.airborne});
  }else if(e.type==='shellcrab'){
   if(v.open>.001){
    shellPanels(e,obj,context);
    const at=body(.5,.43),width=5+v.open*11,height=v.bodyHeight*.35;
    fx.fillStyle(0x493627,.9);fx.fillEllipse(at.x,at.y,width+4,height+5);
    fx.fillStyle(palette.shell,.7);fx.fillEllipse(at.x,at.y,width,height);
    fx.lineStyle(2,0xffe5a5,.92);fx.strokePoints([{x:at.x-2,y:at.y-height*.48},{x:at.x+3,y:at.y-height*.12},{x:at.x-2,y:at.y+height*.16},{x:at.x+1,y:at.y+height*.48}],false);
    const left=body(.12,.32),right=body(.88,.32);for(const p of [left,right]){fx.lineStyle(1.5,palette.shell,.7);fx.lineBetween(p.x,p.y-3,p.x,p.y+5);}
    records.push({type:'shell-open',enemyId:e.id,open:v.open,panels:2,core:at});
   }else{
    const at=body(.5,.34);fx.lineStyle(1,0xb4a17d,.35);fx.lineBetween(at.x-10,at.y-1,at.x-4,at.y-4);fx.lineBetween(at.x+4,at.y-4,at.x+10,at.y-1);
   }
  }else if(e.type==='sporetoad'){
   const q=v.charge;
   if(q>0){
    for(const [i,[u,y]]of [[.22,.27],[.39,.14],[.56,.29]].entries()){
     const p=body(u,y),radius=2+q*(3+i*.4);fx.fillStyle(0xa8cbb8,.14+q*.16);fx.fillCircle(p.x,p.y,radius+2);
     fx.lineStyle(1.2,palette.spore,.3+q*.5);fx.strokeCircle(p.x,p.y,radius);fx.fillStyle(0xe1e1c3,.6);fx.fillCircle(p.x-1,p.y-1,1.2);
    }
    if(q>.5){
     const mouth=body(.86,.55),count=reduced?3:6;
     for(let i=0;i<count;i++){const age=reduced?.5:(t*1.4+i/count)%1;fx.fillStyle(palette.spore,q*.55*(1-age));fx.fillCircle(mouth.x+(sprite.flipX?-1:1)*(5+age*14),mouth.y-age*12+(i%2)*3,1+q);}
    }
    records.push({type:'spore-inflate',enemyId:e.id,charge:q,sacs:3});
   }
  }else if(e.type==='echomantis'){
   const shifting=v.shifting,count=echoCopies(b,e,obj,t,context);
   // The painted membranes now articulate. A quiet mark at the actual head
   // replaces the old vibrating ellipses that stood in for moving wings.
   if(!shifting){const head=body(.86,.24);fx.lineStyle(1,palette.echo,.35);fx.beginPath();fx.arc(head.x,head.y,8,-.6,.6);fx.strokePath();}
   if(shifting){
    const destination=toArt(ZONES.find(z=>z.id===e.zone));ring(ground,destination,35,13,palette.echo,.5);
    const next=toArt(e.echoPath[0]),dx=next.x-foot.x,dy=next.y-foot.y,length=Math.hypot(dx,dy)||1;
    for(let i=8;i<Math.min(length,72);i+=13){ground.lineStyle(1.2,palette.echo,.45);ground.lineBetween(foot.x+dx*i/length,foot.y+dy*i/length,foot.x+dx*Math.min(i+6,length)/length,foot.y+dy*Math.min(i+6,length)/length);}
    records.push({type:'echo-trail',enemyId:e.id,copies:count,destination:e.zone,routeVisible:true});
   }
  }
  return records;
 }
 function drawEvent(b,event,t,tokens,ground,fx){
  const age=t-event.time;if(age<0)return null;
  const p=toArt(event),obj=tokens.get('e-'+event.enemyId),v=obj?.phaseVisual;
  if(event.type==='armor-hit'){
   const at=v?phaseBodyPoint(obj.sprite,v.meta,.55,.28):{x:p.x,y:p.y-35},fade=clamp(1-age/.55);
   for(let i=0;i<(reduced?3:7);i++){const a=i*1.7,spread=reduced?8:age*42;fx.lineStyle(1.4,palette.shell,fade);fx.lineBetween(at.x+Math.cos(a)*spread,at.y+Math.sin(a)*spread*.6,at.x+Math.cos(a)*(spread+5),at.y+Math.sin(a)*(spread+5)*.6);}
   return 'armor-sparks';
  }
  if(event.type==='shell-break'){
   const at=v?.core||{x:p.x,y:p.y-30},fade=clamp(1-age/.75);
   for(const source of event.flankSources||[]){const a=toArt(source);fx.lineStyle(1.2,palette.shell,fade*.7);fx.lineBetween(a.x,a.y-12,at.x,at.y);}
   for(let i=0;i<(reduced?3:8);i++){const a=i*2.4,spread=reduced?12:age*28;fx.fillStyle(i%2?0x8c6f53:palette.shell,fade);fx.fillRect(at.x+Math.cos(a)*spread,at.y+Math.sin(a)*spread*.7-(reduced?0:Math.sin(clamp(age/.75)*Math.PI)*9),3,2);}
   return 'carapace-break';
  }
  if(event.type==='spores'){
   const duration=1.8,fade=clamp(1-age/duration),spread=reduced?1:Math.min(1,age/.55);
   if(fade>0){
    const boundary=Array.from({length:24},(_,i)=>{const a=i*Math.PI/12;return toArt({x:event.x+Math.cos(a)*R.sporeRadius*spread,y:event.y+Math.sin(a)*R.sporeRadius*spread});});
    ground.fillStyle(0x9b82b0,fade*.12);ground.fillPoints(boundary,true);ground.lineStyle(1,palette.spore,fade*.24);ground.strokePoints(boundary,true);
    for(let i=0;i<(reduced?3:7);i++){
     const a=i*2.4,r=R.sporeRadius*(.18+i%3*.16)*spread,at=toArt({x:event.x+Math.cos(a)*r,y:event.y+Math.sin(a)*r});
     ground.fillStyle(i%2?0xb6a3c9:0x9c94b0,fade*.075);ground.fillEllipse(at.x,at.y-(reduced?2:age*4),28+spread*24,13+spread*14);
    }
    for(let i=0;i<(reduced?6:22);i++){const a=i*2.4,r=(.25+i%5*.15)*R.sporeRadius*spread,point=toArt({x:event.x+Math.cos(a)*r,y:event.y+Math.sin(a)*r});fx.fillStyle(i%3?palette.spore:0xcadac2,fade*(.3+i%3*.1));fx.fillCircle(point.x,point.y-(reduced?3:age*8+i%3*3),1.7+i%3*.5);}
    for(const target of event.targets||[]){const at=toArt(target);ring(fx,{x:at.x,y:at.y-18},20,31,palette.spore,fade*.55);}
   }
   return 'spore-cloud';
  }
  if(event.type==='leap-ready'){dust(ground,p,age,reduced);return 'leap-takeoff';}
  if(event.type==='vault'&&event.creature==='bladebeast'){
   const fade=clamp(1-age/.7);dust(ground,p,age,reduced);ring(ground,p,22+(reduced?0:age*38),8+(reduced?0:age*12),palette.blade,fade*.65);return 'leap-landing';
  }
  if(event.type==='leap-cancel'){
   const fade=clamp(1-age/.5),at={x:p.x,y:p.y-(event.height||0)};fx.lineStyle(2,0xe6c29b,fade);fx.lineBetween(at.x-7,at.y-8,at.x+7,at.y+5);fx.lineBetween(at.x+7,at.y-8,at.x-7,at.y+5);dust(ground,toArt(event.to||event),age,reduced);return 'leap-interrupt';
  }
  if(event.type==='weakpoint'&&event.creature==='echomantis'){
   const fade=clamp(1-age/1.1);for(let i=0;i<3;i++)ring(ground,p,18+i*11+(reduced?0:age*30),7+i*4+(reduced?0:age*10),palette.echo,fade*(.65-i*.15));return 'echo-departure';
  }
  return null;
 }
 function end(){for(const [key,piece]of pieces)if(!used.has(key)){remove(piece);pieces.delete(key);}}
 return {begin,drawCreature,drawEvent,end,destroy(){for(const piece of pieces.values())remove(piece);pieces.clear();}};
}
