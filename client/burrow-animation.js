import {burrowFrame} from '../src/burrow.js';

export const BURROW_LABELS={sink:'下钻入土',tunnel:'土下穿行',emerge:'破土而出'};
export function animateBurrow(obj,b,e,t,meta,reduced=false){
 const lead=b.paused||e.stun>0?0:Math.max(0,Math.min(.1,t-b.elapsed));
 const frame=burrowFrame(e,lead);obj.burrowVisual=frame;
 if(!frame)return;
 const sprite=obj.sprite,height=meta.bounds[3]-meta.bounds[1],hidden=height*(1-frame.visible);
 sprite.setAngle(0);
 if(reduced)sprite.setPosition(obj.x,obj.y).setAlpha(frame.visible);
 else{
  sprite.setPosition(obj.x,obj.y+hidden*sprite.scaleY).setAlpha(frame.visible>0?1:0);
  obj.burrowCrop=(meta.bounds[3]-hidden)/sprite.frame.cutHeight;
 }
}

// Crop both the body and its fence-occlusion copy: no ghost can reveal an
// underground animal. The next frame restores the full registered sprite.
export function cropBurrow(obj){
 for(const image of [obj.sprite,obj.outline]){
  if(!image)continue;
  if(obj.burrowCrop===undefined)image.setCrop();
  else image.setCrop(0,0,image.frame.cutWidth,Math.max(1,image.frame.cutHeight*obj.burrowCrop));
 }
}

export function drawBurrow(g,fx,p,frame,reduced=false,alpha=1){
 const {phase,progress}=frame;
 const mound=phase==='tunnel',emerge=phase==='emerge';
 const strength=mound?1:emerge?1-(progress-.7)/.3:Math.min(1,progress/.12);
 // Low, uneven soil lumps sit on the ground; they never obscure the fence.
 g.fillStyle(0x30291f,alpha*.8);g.fillEllipse(p.x,p.y+1,30,10);
 g.fillStyle(0x171a18,alpha*.9);g.fillEllipse(p.x,p.y,21,6);
 const wobble=reduced?0:Math.sin(progress*63)*1.2;
 for(let i=0;i<5;i++){
  const x=p.x+(i-2)*6,y=p.y+2+(i%2)*2;
  g.fillStyle(i%2?0x927451:0x6e573c,alpha);
  g.fillEllipse(x,y-(mound?3+strength*2+wobble:0),10+i%2*3,5+(mound?strength*6:0));
 }
 if(mound){
  g.lineStyle(1,0xc0a077,alpha*.7);g.lineBetween(p.x-7,p.y-6-wobble,p.x-2,p.y-8-wobble);g.lineBetween(p.x+2,p.y-7-wobble,p.x+8,p.y-5-wobble);
 }
 if(!reduced&&(phase==='sink'||emerge)){
  const age=emerge?(progress-.7)/.3:progress/.28;
  for(let i=0;i<7;i++){
   const a=i*2.4,spread=4+age*17,x=p.x+Math.cos(a)*spread,y=p.y+Math.sin(a)*spread*.27-Math.sin(age*Math.PI)*(6+i%3*3);
   fx.fillStyle(i%2?0xc0a077:0x7d6243,alpha*(1-age)*.85);fx.fillEllipse(x,y,3+i%2,2+i%3);
  }
 }
}
