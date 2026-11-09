import {spriteBodyBounds} from './boss-motion.js';

// Use the painted sleeve as the elbow joint and a separate painted hand at the
// wrist. Each actor has their own wrist and knuckle anchors, including Meng's
// larger atlas; a bounding-box corner is not a reliable hand position.
const ARMS={
 hero:{pivot:[211,148],wrist:[222,184],hand:[223,201],points:[[202,139],[218,138],[226,158],[232,183],[233,209],[221,217],[210,205],[211,180]]},
 lin:{pivot:[217,146],wrist:[233,178],hand:[234,189],points:[[208,139],[225,137],[234,155],[244,181],[239,196],[229,198],[222,184],[216,167]]},
 zhou:{pivot:[217,143],wrist:[229,176],hand:[232,189],points:[[207,136],[225,135],[232,153],[242,173],[239,195],[225,204],[213,194],[215,173]]},
 chen:{pivot:[216,148],wrist:[226,184],hand:[227,200],points:[[206,138],[224,139],[231,155],[239,180],[235,207],[224,216],[213,202],[215,177]]},
 xu:{pivot:[209,161],wrist:[215,192],hand:[216,207],points:[[199,153],[219,152],[223,170],[228,194],[223,215],[213,218],[205,201],[203,181]]},
 yuan:{pivot:[218,160],wrist:[230,181],hand:[230,193],points:[[207,151],[226,148],[234,165],[241,184],[239,199],[226,203],[217,190],[215,175]]},
 meng:{pivot:[220,145],wrist:[237,182],hand:[238,194],points:[[210,138],[230,136],[237,152],[248,176],[244,197],[232,203],[220,187],[217,166]]},
 visitor:{pivot:[211,154],wrist:[220,168],hand:[222,178],points:[[202,147],[219,145],[229,156],[232,172],[228,185],[218,187],[209,176],[205,166]]}
};
const MENG_ARM={pivot:[408,271],wrist:[428,310],hand:[439,339],points:[[388,258],[422,252],[437,280],[449,309],[461,335],[451,355],[430,359],[410,341],[405,315]]};
function polygon(ctx,points){ctx.beginPath();ctx.moveTo(...points[0]);for(const p of points.slice(1))ctx.lineTo(...p);ctx.closePath();}
function anchor(sprite,x,y){
 const sign=sprite.flipX?-1:1,dx=(sprite.flipX?sprite.frame.cutWidth-x:x)-sprite.originX*sprite.frame.cutWidth,dy=y-sprite.originY*sprite.frame.cutHeight;
 const c=Math.cos(sprite.rotation),s=Math.sin(sprite.rotation);
 return {x:sprite.x+dx*sprite.scaleX*c-dy*sprite.scaleY*s,y:sprite.y+dx*sprite.scaleX*s+dy*sprite.scaleY*c,sign};
}
export function createHumanRig(scene,outlines){
 const sheets=new Map(),owners=new Set(),textureKeys=new Set();
 const isolate=(obj,active)=>{for(const image of [obj.sprite,obj.outline,obj.selectionOutline])image?.setRenderNodeRole('BatchHandler',active?'BatchHandlerQuadSingle':null);};
 function prepare(sourceKey,registration){
  if(sheets.has(sourceKey))return sheets.get(sourceKey);
  const source=scene.textures.get(sourceKey).getSourceImage(),key='human-rig-'+sourceKey,body=scene.textures.createCanvas(key,source.width,source.height),parts=new Map();
  // One compact atlas per cast, rather than a separate GPU texture per arm.
  const armKey=key+'-arms',arms=scene.textures.createCanvas(armKey,Math.ceil(registration.frames.length/4)*256,128);
  textureKeys.add(key);textureKeys.add(armKey);body.context.drawImage(source,0,0);
  for(const [i,meta]of registration.frames.entries()){
   if(i%4!==1)continue;
   const def=sourceKey==='people-meng'?MENG_ARM:ARMS[meta.person];if(!def)continue;
   const [ox,oy]=meta.rect,left=Math.floor(Math.min(...def.points.map(p=>p[0])))-2,top=Math.floor(Math.min(...def.points.map(p=>p[1])))-2;
   const width=Math.ceil(Math.max(...def.points.map(p=>p[0])))-left+2,height=Math.ceil(Math.max(...def.points.map(p=>p[1])))-top+2,slot=Math.floor(i/4)*256,paint=arms.context;
   // A small overlap keeps the joint covered when the wrist bends. Both pieces
   // retain the source pixels, with no geometric replacement for painted skin.
   const overlap=sourceKey==='people-meng'?3:1.5;
   for(const [segment,offset]of [['arm',0],['hand',128]]){
    paint.save();paint.translate(slot+offset-left,-top);polygon(paint,def.points);paint.clip();
    paint.beginPath();paint.rect(left,segment==='arm'?top:def.wrist[1]-overlap,width,segment==='arm'?def.wrist[1]+overlap-top:top+height-def.wrist[1]+overlap);paint.clip();
    paint.drawImage(source,ox,oy,meta.rect[2],meta.rect[3],0,0,meta.rect[2],meta.rect[3]);paint.restore();arms.add(`${i}-${segment}`,0,slot+offset,0,width,height);
   }
   const ctx=body.context;ctx.save();ctx.translate(ox,oy);ctx.globalCompositeOperation='destination-out';polygon(ctx,def.points);ctx.fill();ctx.restore();
   const split=def.wrist[1]-top;
   parts.set(i,{...def,left,top,width,height,key:armKey,frame:`${i}-arm`,handFrame:`${i}-hand`,armBounds:[0,0,width,split+overlap],handBounds:[0,split-overlap,width,height-split+overlap]});
  }
  body.refresh();arms.refresh();registration.frames.forEach((meta,i)=>body.add(String(i),0,...meta.rect));
  const result={key,parts};sheets.set(sourceKey,result);return result;
 }
 function apply(obj,sourceKey,registration){
  const pose=obj.humanVisual;
  if(!pose?.rig||obj.wounded){isolate(obj,false);for(const limb of [obj.humanArm,obj.humanWrist])if(limb){isolate(limb,false);limb.sprite.setVisible(false);limb.outline?.setVisible(false);limb.selectionOutline?.setVisible(false);}obj.humanArmActive=false;delete obj.humanHand;return;}
  const sheet=prepare(sourceKey,registration),frame=Number(obj.sprite.frame.name),part=sheet.parts.get(frame);if(!part)return;
  if(!obj.humanArm){obj.humanArm={sprite:scene.add.image(0,0,part.key,part.frame),isCreature:false};obj.humanWrist={sprite:scene.add.image(0,0,part.key,part.handFrame),isCreature:false};owners.add(obj);}
  obj.humanArmActive=true;obj.humanArmDefinition=part;obj.sprite.setTexture(sheet.key,String(frame));sync(obj);
 }
 function sync(obj){
  if(!obj.humanArmActive)return;
  const arm=obj.humanArm,part=obj.humanArmDefinition,sprite=obj.sprite,at=anchor(sprite,...part.pivot),sign=at.sign;
  const origin=[(part.pivot[0]-part.left)/part.width,(part.pivot[1]-part.top)/part.height];
  arm.sprite.setTexture(part.key,part.frame).setVisible(true).setOrigin(sign<0?1-origin[0]:origin[0],origin[1]).setFlipX(sign<0)
   .setPosition(at.x,at.y).setScale(sprite.scaleX,sprite.scaleY).setAngle(sprite.angle+obj.humanVisual.arm*sign).setAlpha(1);
  const wrist=obj.humanWrist,join=anchor(arm.sprite,part.wrist[0]-part.left,part.wrist[1]-part.top),originWrist=[(part.wrist[0]-part.left)/part.width,(part.wrist[1]-part.top)/part.height];
  wrist.sprite.setTexture(part.key,part.handFrame).setVisible(true).setOrigin(sign<0?1-originWrist[0]:originWrist[0],originWrist[1]).setFlipX(sign<0)
   .setPosition(join.x,join.y).setScale(sprite.scaleX,sprite.scaleY).setAngle(arm.sprite.angle+(obj.humanVisual.wrist||0)*sign).setAlpha(1);
  for(const limb of [arm,wrist]){limb.x=obj.x;limb.y=obj.y;limb.hitTint=obj.hitTint;limb.bodyBounds=spriteBodyBounds(limb.sprite,limb===arm?part.armBounds:part.handBounds);}
  obj.humanHand=anchor(wrist.sprite,part.hand[0]-part.left,part.hand[1]-part.top);
 }
 function occlude(obj,components){
  if(!obj.humanArmActive)return;sync(obj);
  // Keep dynamic cutout quads out of the shared atlas batch. Otherwise the
  // Phaser 4 batch can show a partial/stale cutout as texture slots change.
  isolate(obj,true);
  for(const [i,limb]of [obj.humanArm,obj.humanWrist].entries()){
   outlines.show(limb,components.occlusionLayers({x:obj.x,y:obj.y},limb.bodyBounds),obj.selected);isolate(limb,true);
   const depth=obj.sprite.depth+.0002*(i+1);limb.sprite.setDepth(depth);limb.outline?.setDepth(depth);limb.selectionOutline?.setDepth(depth+.0001);
   const a=limb.bodyBounds,b=obj.bodyBounds,left=Math.min(a.left,b.left),top=Math.min(a.top,b.top);
   obj.bodyBounds={left,top,width:Math.max(a.left+a.width,b.left+b.width)-left,height:Math.max(a.top+a.height,b.top+b.height)-top};
  }
 }
 function remove(obj){for(const key of ['humanArm','humanWrist'])if(obj[key]){outlines.remove(obj[key]);obj[key].sprite.destroy();delete obj[key];}delete obj.humanHand;obj.humanArmActive=false;owners.delete(obj);}
 return {apply,occlude,sync,remove,destroy(){for(const obj of [...owners])remove(obj);for(const key of textureKeys)scene.textures.remove(key);sheets.clear();}};
}
