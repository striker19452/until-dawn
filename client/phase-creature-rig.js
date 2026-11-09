import {spriteBodyBounds} from './boss-motion.js';

// Source-space silhouettes from the existing 627px paintings. The atlas has
// four aliases of each painting, so gait must articulate pixels, not swap aliases.
export const PHASE_PARTS={
 bladebeast:[
  {id:'blade',pivot:[258,315],tip:[32,433],points:[[276,311],[251,297],[211,231],[178,173],[171,134],[155,133],[102,167],[66,235],[31,316],[21,400],[32,447],[46,411],[56,356],[82,287],[118,229],[149,190],[203,300],[251,339]]},
  {id:'legRear',pivot:[264,366],tip:[243,496],points:[[254,347],[284,357],[275,379],[247,422],[251,477],[275,489],[284,499],[262,506],[232,502],[223,484],[213,441],[214,415],[230,385]]},
  {id:'legFront',pivot:[402,370],tip:[443,497],points:[[389,354],[421,358],[430,377],[395,410],[419,468],[458,489],[463,503],[435,505],[412,495],[397,498],[384,491],[372,451],[364,417],[362,397]]}
 ],
 shellcrab:[
  {id:'clawNear',pivot:[356,354],tip:[462,480],points:[[343,327],[377,329],[403,352],[417,392],[448,409],[467,439],[472,463],[460,450],[447,427],[427,426],[442,459],[477,488],[463,495],[431,489],[392,475],[363,451],[344,419],[333,385],[331,352]]},
  {id:'clawFar',pivot:[492,333],tip:[586,458],points:[[472,314],[507,309],[536,327],[565,346],[592,371],[604,403],[606,430],[594,461],[581,477],[580,451],[581,423],[574,407],[562,420],[554,441],[548,431],[545,397],[530,376],[506,368],[480,357]]},
  {id:'legRear',pivot:[181,374],tip:[177,470],points:[[172,353],[191,357],[201,373],[197,404],[188,433],[190,464],[177,481],[167,468],[167,442],[174,413],[174,392],[161,387]]},
  {id:'legFront',pivot:[266,375],tip:[279,480],points:[[258,355],[278,357],[286,377],[284,412],[283,444],[293,476],[284,490],[270,479],[264,454],[264,421],[259,398],[251,386]]}
 ],
 sporetoad:[
  {id:'legRear',pivot:[115,421],tip:[102,529],points:[[119,380],[154,396],[154,423],[137,454],[99,470],[92,491],[119,508],[171,501],[185,511],[183,525],[162,529],[150,546],[137,542],[124,525],[91,535],[74,547],[63,539],[71,517],[43,511],[38,497],[45,463],[65,428],[87,403]]},
  {id:'legFront',pivot:[276,428],tip:[313,549],points:[[255,404],[283,398],[305,415],[306,446],[286,481],[313,503],[339,515],[371,522],[387,539],[376,546],[353,537],[341,533],[355,551],[352,562],[339,560],[319,539],[306,538],[309,557],[301,568],[289,560],[281,541],[266,535],[250,535],[243,524],[244,503],[253,481],[251,460],[244,439]]},
  {id:'sacRear',pivot:[235,245],points:[[244,255],[199,246],[160,229],[144,205],[143,177],[155,148],[183,126],[218,116],[252,121],[273,137],[287,160],[282,194],[265,225],[254,246]]},
  {id:'sacFront',pivot:[363,250],points:[[349,252],[337,234],[327,213],[329,183],[344,163],[367,152],[391,160],[403,181],[406,199],[398,223],[381,236],[371,258]]}
 ],
 echomantis:[
  {id:'wingRear',pivot:[235,250],layer:-1,points:[[238,256],[203,252],[158,240],[124,220],[105,193],[99,157],[107,121],[123,91],[143,74],[156,79],[169,111],[190,143],[213,158],[225,186],[229,225]]},
  {id:'wingFront',pivot:[274,249],layer:-1,points:[[268,250],[233,233],[224,195],[220,152],[216,105],[211,77],[219,59],[240,63],[276,78],[307,101],[330,135],[340,178],[331,209],[303,229],[284,247]]},
  {id:'claw',pivot:[493,280],tip:[479,422],points:[[489,263],[505,272],[511,308],[508,345],[500,381],[481,421],[477,435],[474,415],[482,380],[487,343],[486,309]]},
  {id:'legRear',pivot:[177,392],tip:[133,532],points:[[167,382],[188,385],[180,412],[161,449],[148,487],[139,525],[124,543],[109,550],[108,541],[126,525],[133,484],[147,444],[160,413]]},
  {id:'legFront',pivot:[366,397],tip:[395,558],points:[[357,381],[376,385],[381,425],[380,478],[395,541],[417,560],[417,572],[395,568],[377,552],[368,506],[364,458],[359,413]]}
 ]
};
const clamp=n=>Math.max(0,Math.min(1,n));
export function phaseCreatureJoints(type,pose,reduced=false){
 const joints=Object.fromEntries((PHASE_PARTS[type]||[]).map(p=>[p.id,{angle:0,dy:0,sx:1,sy:1}]));
 const moving=pose.locomotion==='walk',wave=reduced||!moving?0:Math.sin(pose.stride*Math.PI*2),lift=reduced||!moving?0:Math.cos(pose.stride*Math.PI*2);
 const range={bladebeast:12,shellcrab:9,sporetoad:7,echomantis:13}[type];
 for(const [id,sign]of [['legRear',-1],['legFront',1]])if(joints[id]){joints[id].angle=wave*range*sign;joints[id].dy=-Math.max(0,lift*sign)*(type==='shellcrab'?1.3:2);}
 const strike=pose.strike||0,wind=pose.windup||0;
 if(type==='bladebeast'){
  joints.blade.angle=(moving?wave*4:0)-wind*12+strike*38;
  if(['crouch','gather'].includes(pose.phase)){joints.legRear.angle=pose.charge*18;joints.legFront.angle=-pose.charge*23;joints.blade.angle=-pose.charge*14;}
  if(pose.airborne){joints.legRear.angle=38;joints.legFront.angle=-42;joints.blade.angle=-24;}
  if(pose.phase==='land'){joints.legRear.angle=-12;joints.legFront.angle=16;}
 }else if(type==='shellcrab'){
  joints.clawNear.angle=-wind*15+strike*32+pose.open*11+(moving?wave*3:0);
  joints.clawFar.angle=wind*12-strike*26-pose.open*8-(moving?wave*3:0);
 }else if(type==='sporetoad'){
  const breath=reduced||pose.phase==='stunned'?0:Math.sin(pose.clock*2.6)*.018;
  for(const [i,id]of ['sacRear','sacFront'].entries()){const p=joints[id],growth=pose.charge*.13;p.sx=1+growth+breath*(i?-.6:1);p.sy=1+growth*1.3+breath;p.angle=reduced?0:Math.sin(pose.clock*2.6+i)*1.5;}
  if(pose.phase==='exhale')for(const id of ['sacRear','sacFront']){joints[id].sx=1-pose.exhale*.12;joints[id].sy=1-pose.exhale*.17;}
  joints.legFront.angle-=pose.charge*5+strike*12;
 }else if(type==='echomantis'){
  const flutter=reduced||pose.phase==='stunned'?0:Math.sin(pose.clock*(pose.shifting?22:5))*(pose.shifting?10:3.5);
  joints.wingRear.angle=-8-flutter;joints.wingFront.angle=7+flutter;
  joints.claw.angle=-wind*23+strike*48+(moving?wave*4:-8);
 }
 if(pose.phase==='stunned')for(const p of Object.values(joints)){p.angle=type==='echomantis'?4:0;p.dy=0;p.sx=p.sy=1;}
 if(reduced)for(const [id,p]of Object.entries(joints)){p.dy=0;if(id.startsWith('leg'))p.angle=pose.airborne?(id==='legRear'?16:-18):0;else if(!id.startsWith('sac'))p.angle=clamp(Math.abs(p.angle)/30)*Math.sign(p.angle)*12;}
 return joints;
}
const polygon=(ctx,points)=>{ctx.beginPath();ctx.moveTo(...points[0]);for(const p of points.slice(1))ctx.lineTo(...p);ctx.closePath();};
function anchor(sprite,x,y){const dx=((sprite.flipX?sprite.frame.cutWidth-x:x)-sprite.originX*sprite.frame.cutWidth)*sprite.scaleX,dy=(y-sprite.originY*sprite.frame.cutHeight)*sprite.scaleY,c=Math.cos(sprite.rotation),s=Math.sin(sprite.rotation);return {x:sprite.x+dx*c-dy*s,y:sprite.y+dx*s+dy*c};}
const isolate=obj=>{for(const image of [obj.sprite,obj.outline,obj.selectionOutline])image?.setRenderNodeRole('BatchHandler','BatchHandlerQuadSingle');};
export function createPhaseCreatureRig(scene,registration,outlines){
 const owners=new Set(),definitions=new Map();let ready=false;
 function prepare(){
  if(ready)return;ready=true;
  const source=scene.textures.get('creatures-phase').getSourceImage(),body=scene.textures.createCanvas('creatures-phase-rig',source.width,source.height),placements=[];body.context.drawImage(source,0,0);
  let x=0,y=0,rowHeight=0;
  for(const [type,parts]of Object.entries(PHASE_PARTS))for(const part of parts){
   const meta=registration.frames.find(f=>f.species===type),left=Math.floor(Math.min(...part.points.map(p=>p[0])))-2,top=Math.floor(Math.min(...part.points.map(p=>p[1])))-2,width=Math.ceil(Math.max(...part.points.map(p=>p[0])))-left+2,height=Math.ceil(Math.max(...part.points.map(p=>p[1])))-top+2;
   if(x+width>1024){x=0;y+=rowHeight+2;rowHeight=0;}placements.push({...part,type,meta,left,top,width,height,x,y});x+=width+2;rowHeight=Math.max(rowHeight,height);
  }
  const atlas=scene.textures.createCanvas('creatures-phase-parts',1024,y+rowHeight);
  for(const p of placements){
   const [ox,oy,w,h]=p.meta.rect,paint=atlas.context;paint.save();paint.translate(p.x-p.left,p.y-p.top);polygon(paint,p.points);paint.clip();paint.drawImage(source,ox,oy,w,h,0,0,w,h);paint.restore();
   const ctx=body.context;ctx.save();ctx.translate(ox,oy);ctx.globalCompositeOperation='destination-out';polygon(ctx,p.points);ctx.fill();ctx.globalCompositeOperation='source-over';ctx.beginPath();ctx.arc(...p.pivot,10,0,Math.PI*2);ctx.clip();ctx.drawImage(source,ox,oy,w,h,0,0,w,h);ctx.restore();
   p.frame=p.type+'-'+p.id;atlas.add(p.frame,0,p.x,p.y,p.width,p.height);definitions.set(p.frame,p);
  }
  body.refresh();atlas.refresh();registration.frames.forEach((f,i)=>body.add(String(i),0,...f.rect));
 }
 function apply(obj,e,reduced){
  prepare();owners.add(obj);obj.phaseParts??=new Map();obj.phaseJoints=phaseCreatureJoints(e.type,obj.phaseVisual,reduced);obj.phaseAnchors={};
  obj.sprite.setTexture('creatures-phase-rig',obj.sprite.frame.name);
  for(const definition of PHASE_PARTS[e.type]){
   const def=definitions.get(e.type+'-'+definition.id);let part=obj.phaseParts.get(def.id);
   if(!part){part={isCreature:true,sprite:scene.add.image(0,0,'creatures-phase-parts',def.frame),definition:def};obj.phaseParts.set(def.id,part);}
  }
  sync(obj);
 }
 function sync(obj){
  const sprite=obj.sprite,sign=sprite.flipX?-1:1;
  for(const [id,part]of obj.phaseParts||[]){
   const p=part.definition,j=obj.phaseJoints[id],at=anchor(sprite,...p.pivot),origin=[(p.pivot[0]-p.left)/p.width,(p.pivot[1]-p.top)/p.height];
   part.sprite.setOrigin(sign<0?1-origin[0]:origin[0],origin[1]).setFlipX(sprite.flipX).setPosition(at.x,at.y+j.dy).setScale(sprite.scaleX*j.sx,sprite.scaleY*j.sy).setAngle(sprite.angle+j.angle*sign).setAlpha(sprite.alpha).setVisible(true);
   part.x=obj.x;part.y=obj.y;part.hitTint=obj.hitTint;part.bodyBounds=spriteBodyBounds(part.sprite,[0,0,p.width,p.height]);if(p.tip)obj.phaseAnchors[id]=anchor(part.sprite,p.tip[0]-p.left,p.tip[1]-p.top);
  }
 }
 function occlude(obj,components){
  if(!obj.phaseParts)return;sync(obj);isolate(obj);
  for(const part of obj.phaseParts.values()){
   const layers=components.occlusionLayers({x:obj.x,y:obj.y},part.bodyBounds).filter(layer=>!obj.ignoreFenceOcclusion||!['gate','fence','mesh','spikes','bell'].includes(layer.kind));outlines.show(part,layers,obj.selected);isolate(part);
   const depth=obj.sprite.depth+(part.definition.layer||1)*.0002;part.sprite.setDepth(depth);part.outline?.setDepth(depth);part.selectionOutline?.setDepth(depth+.00001);
  }
 }
 function snapshot(obj){return obj.phaseParts?[...obj.phaseParts].map(([id,p])=>({id,angle:p.sprite.angle,x:p.sprite.x,y:p.sprite.y,scaleX:p.sprite.scaleX,scaleY:p.sprite.scaleY,visible:p.sprite.visible,occluded:!!p.occluded,joint:obj.phaseJoints[id]})):null;}
 function remove(obj){for(const p of obj.phaseParts?.values()||[]){outlines.remove(p);p.sprite.destroy();}obj.phaseParts?.clear();owners.delete(obj);}
 return {apply,occlude,snapshot,remove,destroy(){for(const obj of [...owners])remove(obj);if(ready)for(const key of ['creatures-phase-rig','creatures-phase-parts'])scene.textures.remove(key);}};
}
