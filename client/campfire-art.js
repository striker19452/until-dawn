import registration from './assets/campfire-v6.json';

const BASE='campfire-base-v6',FLAMES='campfire-flames-v6',GLOW='campfire-soft-light';
export function registerCampfireFrames(scene){
 for(const [key,name] of [['campfire-base',BASE],['campfire-flames',FLAMES]])for(const [i,f] of registration[name].frames.entries())scene.textures.get(key).add(String(i),0,...f.rect);
 if(!scene.textures.exists(GLOW)){
  const texture=scene.textures.createCanvas(GLOW,256,128),ctx=texture.context;
  ctx.scale(2,1);const glow=ctx.createRadialGradient(64,64,2,64,64,64);
  glow.addColorStop(0,'rgba(255,182,78,0.6)');glow.addColorStop(.3,'rgba(239,135,49,0.28)');glow.addColorStop(.7,'rgba(221,106,31,0.08)');glow.addColorStop(1,'rgba(221,106,31,0)');
  ctx.fillStyle=glow;ctx.fillRect(0,0,128,128);texture.refresh();
 }
}

export class CampfireComponent{
 constructor(scene,record){
  this.id=record.id;this.root=scene.add.container(record.x,record.y).setName(record.id);
  this.glow=scene.add.image(0,3,GLOW).setBlendMode('ADD');this.base=scene.add.image(0,0,'campfire-base','0');
  this.embers=scene.add.image(0,-7,GLOW).setDisplaySize(34,13).setBlendMode('ADD');
  this.flame=scene.add.image(0,-8,'campfire-flames','1');this.sparks=scene.add.graphics();
  this.root.add([this.glow,this.base,this.embers,this.flame,this.sparks]);
  this.reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 }
 update(r,t){
  this.data=r;this.root.setPosition(r.x,r.y).setDepth(r.depth);this.baseFrame=r.night?1:0;
  const meta=registration[BASE].frames[this.baseFrame],scale=70/meta.rect[2];
  this.base.setTexture('campfire-base',String(this.baseFrame)).setOrigin(...meta.origin).setScale(scale);
  const [left,top,right,bottom]=meta.bounds,[w,h]=meta.rect.slice(2);
  this.bounds={left:r.x+(left-meta.origin[0]*w)*scale,right:r.x+(right-meta.origin[0]*w)*scale,top:r.y+(top-meta.origin[1]*h)*scale,bottom:r.y+(bottom-meta.origin[1]*h)*scale};
  const burning=r.heat>0,weak=burning&&r.heat<=15,strength=Math.max(0,Math.min(1,r.heat/60)),wet=r.wet>0;
  this.state=!burning?'unlit':wet?'wet':weak?'embers':'burning';
  this.base.setTint(weak&&!wet?0xb9aba5:r.night&&burning&&!wet?0xffdcaa:0xffffff);
  const flicker=this.reduced?1:1+Math.sin(t*7.3)*.035+Math.sin(t*11.1)*.018;
  // The alternate painted frames lean left and right. Keep the upright flame
  // anchored to the logs, and animate only its upward reach and brightness.
  this.flameFrame=1;
  const rise=this.reduced?1:1+Math.sin(t*6.4)*.025+Math.sin(t*9.7)*.012;
  const flame=registration[FLAMES].frames[this.flameFrame],unit=46/registration[FLAMES].bodyHeight;
  this.flame.setTexture('campfire-flames',String(this.flameFrame)).setOrigin(...flame.origin).setScale(unit*(.6+.4*strength),unit*(.55+.45*strength)*rise).setAlpha(weak?0:(wet?.22:.93)*flicker).setVisible(burning&&!weak);
  // Below the gameplay threshold only the coal bed glows; no tall flame or
  // surrounding pool of warm light should suggest that protection is active.
  this.glow.setDisplaySize(175+strength*35,72+strength*16).setAlpha(burning&&!weak?(r.night?.76:.1)*strength*(wet?.12:1)*flicker:0);
  const breath=this.reduced?1:.85+Math.sin(t*1.8)*.15;
  this.embers.setDisplaySize(weak?28:34,weak?9:13).setTint(weak?0xff8050:0xffffff).setAlpha(burning?(wet?.12:weak?.55*breath:(.55+.3*strength)*flicker):0);
  const g=this.sparks;g.clear();
  if(burning&&!weak&&!wet&&!this.reduced)for(let i=0;i<4;i++){
   const life=(t*.45+i*.27)%1,x=Math.sin(i*4.1)*6,y=-16-life*(24+strength*18);
   g.fillStyle(i%2?0xffb65c:0xffdf91,(1-life)*.65*strength);g.fillCircle(x,y,.45+(1-life)*.35);
  }
  if(weak&&!wet)for(let i=0;i<5;i++){
   g.fillStyle(i%2?0xa6402b:0xd26738,(.4+i*.08)*breath);g.fillEllipse((i-2)*4,-8+(i%2)*2,3.5,1.7);
  }
  // Smouldering coals emit slow grey smoke; damp logs retain pale steam.
  this.smokeVisible=burning&&(weak||wet);
  if(this.smokeVisible)for(let i=0;i<(wet?3:2);i++){
   const life=this.reduced?.5:(t*(wet?.3:.16)+i*.43)%1;g.fillStyle(wet?0xc5d2ce:0x929894,(1-life)*(wet?.055:.22));g.fillEllipse((i-.5)*4,-12-life*(wet?24:32),6+life*11,4+life*7);
  }
 }
 inspect(){return {id:this.id,kind:'fire',zone:'central',state:this.state,frame:this.baseFrame,flameFrame:this.flameFrame,flameVisible:this.flame.visible,flameX:this.flame.x,flameScaleX:this.flame.scaleX,flameScaleY:this.flame.scaleY,flameAngle:this.flame.angle,flameAlpha:this.flame.alpha,glowAlpha:this.glow.alpha,emberAlpha:this.embers.alpha,smokeVisible:this.smokeVisible,baseScale:this.base.scaleX,depth:this.root.depth,heat:this.data.heat,wet:this.data.wet,night:this.data.night,occludes:false,bounds:this.bounds};}
 occlusion(){return {...this.inspect(),polygon:[],occludes:false};}
 destroy(){this.root.destroy(true);}
}
