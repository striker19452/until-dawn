import {spriteBodyBounds} from './boss-motion.js';

// Source-space joints from the existing painted atlas. Images are clipped into
// articulated parts at load time; the original PNG and portrait stay untouched.
export const ROBOT_PARTS={
 repair:[
  {id:'tool',pivot:[520,460],tip:[627,319],points:[[483,423],[506,404],[532,365],[551,353],[571,358],[578,333],[576,315],[594,295],[626,280],[638,284],[640,294],[619,321],[628,338],[649,330],[655,306],[661,312],[663,334],[651,359],[627,373],[612,380],[612,404],[598,423],[577,436],[547,477],[523,488],[502,480]]},
  {id:'claw',pivot:[167,382],points:[[153,382],[164,402],[143,431],[151,452],[155,479],[171,512],[182,526],[194,544],[218,575],[211,614],[195,635],[186,639],[174,630],[177,611],[185,592],[179,585],[160,594],[152,618],[146,641],[134,641],[111,620],[96,589],[101,565],[121,547],[119,525],[102,497],[86,481],[70,471],[62,454],[68,427],[80,416],[102,417],[130,390]]},
  {id:'legL',pivot:[285,565],layer:-1,points:[[250,548],[311,548],[334,567],[329,598],[305,639],[325,652],[343,681],[346,710],[272,714],[209,699],[215,675],[224,650],[243,613],[247,585]]},
  {id:'legR',pivot:[446,564],layer:-1,points:[[395,533],[446,532],[485,551],[492,579],[471,608],[456,638],[493,652],[518,676],[529,692],[525,703],[437,706],[373,691],[381,662],[391,637],[408,596],[403,575]]}
 ],
 defense:[
  {id:'shield',pivot:[544,327],tip:[662,480],points:[[533,282],[571,276],[642,279],[690,293],[712,326],[720,372],[710,435],[701,510],[681,571],[649,618],[627,627],[591,613],[564,582],[546,537],[533,487],[527,425],[519,367],[516,319]]},
  {id:'claw',pivot:[130,308],points:[[100,279],[156,280],[180,298],[189,329],[177,359],[174,391],[178,428],[185,467],[173,505],[145,538],[110,548],[66,530],[42,507],[22,467],[10,425],[14,382],[20,345],[38,316],[71,298]]},
  {id:'legL',pivot:[244,485],layer:-1,points:[[194,468],[269,467],[324,489],[336,520],[316,566],[308,600],[315,654],[316,702],[278,715],[166,715],[106,698],[110,675],[128,633],[131,588],[147,542],[160,499]]},
  {id:'legR',pivot:[442,496],layer:-1,points:[[408,480],[469,474],[504,494],[523,543],[545,599],[570,638],[606,666],[615,704],[562,714],[402,706],[361,697],[367,668],[380,638],[377,611],[388,570],[400,540]]}
 ],
 dispatch:[
  {id:'head',pivot:[417,316],tip:[535,219],points:[[352,160],[380,146],[397,135],[398,127],[432,125],[476,129],[511,147],[544,158],[578,167],[600,185],[614,217],[612,247],[600,263],[580,274],[550,278],[523,272],[506,263],[477,266],[468,281],[452,303],[434,327],[409,337],[382,320],[389,301],[397,278],[387,264],[360,255],[348,230],[344,194]]},
  {id:'antenna',pivot:[307,224],tip:[275,16],points:[[266,6],[278,1],[286,14],[289,30],[281,37],[309,179],[320,191],[326,232],[291,238],[285,207],[287,186],[269,43],[265,22]]}
 ]
};
export function robotJointPose(type,pose,distance=0,reduced=false){
 const joints={},walk=pose.phase==='travel'?Math.sin(distance/7*Math.PI):0;
 for(const p of ROBOT_PARTS[type])joints[p.id]={angle:0,dy:0};
 if(!reduced){
  if(joints.legL){joints.legL.angle=walk*(type==='defense'?7:10);joints.legR.angle=-joints.legL.angle;joints.legL.dy=-Math.max(0,walk)*1.2;joints.legR.dy=-Math.max(0,-walk)*1.2;}
  if(joints.claw)joints.claw.angle=-walk*9;
  if(joints.tool)joints.tool.angle=walk*11;
 }
 if(pose.phase==='repair'){
  // A lifted spanner follows through into the real contact stage.
  const beat=reduced?.62:pose.beat;
  joints.tool.angle=beat<.46?-24+beat/.46*8:45*Math.sin((beat-.46)/.54*Math.PI);
  joints.claw.angle=5;
 }else if(pose.phase==='brace'){joints.shield.angle=14;joints.claw.angle=-8;}
 else if(pose.phase==='strike'){joints.shield.angle=reduced?-20:14-47*Math.sin(pose.beat*Math.PI);joints.claw.angle=reduced?-12:-10-Math.sin(pose.beat*Math.PI)*17;}
 if(type==='dispatch'){
  if(pose.phase==='listen'){joints.head.angle=reduced?-8:-13;joints.antenna.angle=reduced?-4:-7;}
  else if(pose.phase==='transmit'){joints.head.angle=-5;joints.antenna.angle=reduced?5:7+Math.sin(pose.beat*Math.PI*3)*4;}
  else if(!reduced&&pose.phase==='travel'){joints.head.angle=-3-Math.sin(distance/8)*1.5;joints.antenna.angle=Math.sin(distance/9)*3;}
 }
 if(pose.phase==='broken'){for(const p of Object.values(joints))p.angle=7;}
 return joints;
}
const polygon=(ctx,points)=>{ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();};
function anchor(sprite,x,y){
 const width=sprite.frame.cutWidth,px=sprite.flipX?width-x:x,dx=(px-sprite.originX*width)*sprite.scaleX,dy=(y-sprite.originY*sprite.frame.cutHeight)*sprite.scaleY,c=Math.cos(sprite.rotation),s=Math.sin(sprite.rotation);
 return {x:sprite.x+dx*c-dy*s,y:sprite.y+dx*s+dy*c};
}
export function createRobotRig(scene,registration,outlines){
 const source=scene.textures.get('robots').getSourceImage(),body=scene.textures.createCanvas('robots-rig',source.width,source.height),ctx=body.context,parts=new Map(),owners=new Set();ctx.drawImage(source,0,0);
 for(const [row,type]of Object.keys(ROBOT_PARTS).entries())for(const part of ROBOT_PARTS[type]){
  const ox=registration.frames[row*4].rect[0],xs=part.points.map(p=>p[0]),ys=part.points.map(p=>p[1]),left=Math.max(0,Math.floor(Math.min(...xs))-2),top=Math.max(0,Math.floor(Math.min(...ys))-2),right=Math.min(724,Math.ceil(Math.max(...xs))+2),bottom=Math.min(724,Math.ceil(Math.max(...ys))+2),width=right-left,height=bottom-top,key=`robot-part-${type}-${part.id}`;
  const texture=scene.textures.createCanvas(key,width,height),paint=texture.context;
  paint.save();paint.translate(-left,-top);polygon(paint,part.points);paint.clip();paint.drawImage(source,ox,0,724,724,0,0,724,724);paint.restore();texture.refresh();texture.add('0',0,0,0,width,height);
  ctx.save();ctx.translate(ox,0);ctx.globalCompositeOperation='destination-out';polygon(ctx,part.points);ctx.fill();ctx.restore();
  parts.set(type+':'+part.id,{...part,key,left,top,width,height});
 }
 body.refresh();registration.frames.forEach((f,i)=>body.add(String(i),0,...f.rect));
 function apply(obj,r,pose,reduced){
  owners.add(obj);obj.robotParts??=new Map();const joints=robotJointPose(r.type,pose,obj.distance,reduced),sign=obj.sprite.flipX?-1:1;obj.robotAnchors={};
  for(const definition of ROBOT_PARTS[r.type]){
   const p=parts.get(r.type+':'+definition.id),j=joints[p.id];let part=obj.robotParts.get(p.id);
   if(!part){part={sprite:scene.add.image(0,0,p.key,'0'),isCreature:false};obj.robotParts.set(p.id,part);}
   const at=anchor(obj.sprite,...p.pivot),origin=[(p.pivot[0]-p.left)/p.width,(p.pivot[1]-p.top)/p.height];
   part.sprite.setOrigin(sign<0?1-origin[0]:origin[0],origin[1]).setPosition(at.x,at.y+j.dy).setScale(obj.sprite.scaleX,obj.sprite.scaleY).setFlipX(sign<0).setAngle(obj.sprite.angle+j.angle*sign).setAlpha(1);
   part.x=obj.x;part.y=obj.y;part.baseTint=obj.baseTint;part.layer=p.layer||1;part.bodyBounds=spriteBodyBounds(part.sprite,[0,0,p.width,p.height]);
   if(p.tip)obj.robotAnchors[p.id]=anchor(part.sprite,p.tip[0]-p.left,p.tip[1]-p.top);
  }
  obj.robotVisual.joints=joints;return joints;
 }
 function occlude(obj,components){
  for(const part of obj.robotParts?.values()||[]){
   outlines.show(part,components.occlusionLayers({x:obj.x,y:obj.y},part.bodyBounds),false);
   const depth=obj.sprite.depth+part.layer*.00001;part.sprite.setDepth(depth);part.outline?.setDepth(depth);
  }
 }
 function remove(obj){for(const part of obj.robotParts?.values()||[]){outlines.remove(part);part.sprite.destroy();}obj.robotParts?.clear();owners.delete(obj);}
 return {apply,occlude,remove,destroy(){for(const owner of [...owners])remove(owner);}};
}
