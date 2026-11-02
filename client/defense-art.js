import { fenceProjection } from './scene-layout.js';
import art from './assets/defenses-v7.json' with {type:'json'};

export const DEFENSE_KINDS=new Set(['spikes','mesh','bell','trap']);
const COLORS={ink:0x292b28,wood:0xa57d4d,grain:0xe3bc7c,rope:0xf0d39a,steel:0xd2e6d8,mesh:0x82b7a2,gold:0xe9bb61};

// Along the wall and towards the yard are separate axes. Posts stay upright;
// a side installation must not become a horizontal bar across its opening.
export function defenseLayout(zone,p){
 const along=fenceProjection(zone)||{x:1,y:0};
 const inward=zone==='left'?{x:1,y:.15}:zone==='right'?{x:-1,y:.15}:zone==='gate'?{x:0,y:-1}:{x:0,y:1};
 return {along,inward,
  spikes:{x:p.x-inward.x*10,y:p.y-inward.y*10+10},
  mesh:{x:p.x+inward.x*13,y:p.y+inward.y*13+9},
  bell:{x:p.x+along.x*23+inward.x*5,y:p.y+along.y*23-1},
  traps:{x:p.x-inward.x*(zone==='left'||zone==='right'?18:30),y:p.y-inward.y*(zone==='left'||zone==='right'?18:30)+12}};
}
export function defenseSignal(kind,zone,battle){
 const events=battle?.events||[];for(let i=events.length-1;i>=0;i--){const e=events[i];if(e.zone===zone&&(
  kind==='bell'?e.type==='bell':kind==='mesh'?e.type==='blocked'&&e.defense==='mesh':
  kind==='spikes'?e.type==='spikes'||e.type==='blocked'&&e.defense==='spikes':e.type==='trap'))return e;}return null;
}
function polygon(g,points,color,alpha=1){g.fillStyle(color,alpha);g.beginPath();g.moveTo(points[0].x,points[0].y);for(const p of points.slice(1))g.lineTo(p.x,p.y);g.closePath();g.fillPath();}
function path(g,points,color,width=1,alpha=1,close=false){g.lineStyle(width,color,alpha);g.beginPath();g.moveTo(points[0].x,points[0].y);for(const p of points.slice(1))g.lineTo(p.x,p.y);if(close)g.closePath();g.strokePath();}

export class DefenseComponent{
 constructor(scene,r){
  this.id=r.id;this.root=scene.add.container(r.x,r.y).setName(r.id);this.base=scene.add.graphics();this.motion=scene.add.graphics();this.bell=scene.add.container();this.stakes=[];
  this.sprite=r.kind==='trap'?scene.add.image(0,0,'props','3').setOrigin(...art.trap.origin).setDisplaySize(55,55):null;
  this.mesh=r.kind==='mesh'?scene.add.mesh2d(0,0,'defense-mesh',new Array(16).fill(0),[0,3,1,0,3,1,2,0]):null;if(this.mesh)this.mesh.buildOrderedIndices(1,true);
  if(r.kind==='spikes')for(let i=0;i<7;i++){const image=scene.add.image(0,0,'defense-spike');this.stakes.push(image);}
  this.bellImage=r.kind==='bell'?scene.add.image(0,0,'defense-bell'):null;if(this.bellImage)this.bell.add(this.bellImage);
  this.root.add([this.base,...(this.mesh?[this.mesh]:[]),...this.stakes,...(this.sprite?[this.sprite]:[]),this.bell,this.motion]);
  this.key='';this.wasActive=false;this.reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 }
 wall(x,y){return {x:x*this.data.along.x,y:y+x*this.data.along.y};}
 floor(x,y){const {along,inward}=this.data;return {x:x*along.x+y*inward.x,y:x*along.y+y*inward.y*.5};}
 update(r,t){
  this.data=r;this.root.setPosition(r.x,r.y).setDepth(r.depth);const key=JSON.stringify([r.kind,r.zone,r.night,r.index]);
  if(key!==this.key){this.key=key;this.draw();}
  const age=r.signal?t-r.signal.time:Infinity,duration=r.kind==='bell'?2.8:r.kind==='mesh'?1.8:1.2;
  this.active=age>=0&&age<duration;this.phase=this.active?Math.min(1,age/duration):0;
  if(this.active||this.wasActive){this.motion.clear();this.bell.setAngle(0);if(this.active)this.animate(age,duration);}
  this.wasActive=this.active;
 }
 draw(){
  const g=this.base,r=this.data;g.clear();const w=(x,y)=>this.wall(x,y),edge=r.night?0xf4d9a5:COLORS.grain;
  if(r.kind==='spikes'){
   const feet=[w(-40,3),w(40,3),w(43,8),w(-37,8)];polygon(g,feet,0x101a1c,.42);
   path(g,[w(-38,0),w(38,0)],COLORS.ink,7);path(g,[w(-38,-1),w(38,-1)],COLORS.wood,4);
   const meta=art.spike;for(let i=-3;i<=3;i++){const p=w(i*12,0),image=this.stakes[i+3],height=28+(i%2===0?4:0);image.setPosition(p.x,p.y).setOrigin(...meta.origin).setScale(height/(meta.bounds[3]-meta.bounds[1])).setTint(r.night?0xe9d1a5:0xffffff);}
   for(const image of [...this.stakes].sort((a,b)=>a.y-b.y))this.root.bringToTop(image);this.root.bringToTop(this.motion);
  }
  if(r.kind==='mesh'){
   const meta=art.mesh,[width,height]=meta.size,scale=74/(meta.bounds[2]-meta.bounds[0]),frame=this.mesh.frame;
   const cross=r.zone==='left'?{x:1,y:.15}:r.zone==='right'?{x:-1,y:.15}:{x:0,y:1};
   this.mesh.vertices=[[0,0],[width,0],[width,height],[0,height]].flatMap(([u,v])=>{const x=(u-meta.origin[0]*width)*scale,y=(v-meta.origin[1]*height)*scale;return [x*r.along.x+y*cross.x,x*r.along.y+y*cross.y,frame.u0+(frame.u1-frame.u0)*u/width,frame.v0+(frame.v1-frame.v0)*v/height];});
   this.mesh.setTint(r.night?0xcfe3d4:0xffffff);
  }
  if(r.kind==='bell'){
   const a=w(-21,0),b=w(18,0);for(const p of [a,b]){
    path(g,[p,{x:p.x,y:p.y-30}],COLORS.ink,6);path(g,[p,{x:p.x,y:p.y-30}],COLORS.wood,3.5);path(g,[{x:p.x-1,y:p.y-2},{x:p.x-1,y:p.y-27}],edge,1,.7);
   }
   const left=w(-21,-27),middle=w(0,-24),right=w(18,-27);path(g,[left,middle,right],COLORS.ink,4);path(g,[left,middle,right],COLORS.rope,1.8);
   const tag=w(-12,-25);polygon(g,[tag,{x:tag.x+5,y:tag.y+1},{x:tag.x+4,y:tag.y+12},{x:tag.x,y:tag.y+9}],0xba7750);
   const point=w(0,-26);this.bell.setPosition(point.x,point.y);const meta=art.bell;this.bellImage.setOrigin(...meta.origin).setScale(29/(meta.bounds[3]-meta.bounds[1])).setTint(r.night?0xffe4a8:0xffffff);
  }
  if(r.kind==='trap'){
   g.fillStyle(0x0e1a20,.25);g.fillEllipse(0,0,34,7);this.sprite.setTint(r.night?0xe7d9b7:0xffffff);
  }
 }
 animate(age,duration){
  const g=this.motion,r=this.data,fade=1-age/duration,still=this.reduced,u=still?.4:age;
  if(r.kind==='bell'){
   this.bell.setAngle(still?0:Math.sin(age*22)*18*fade);const p=this.wall(0,-10);
   for(const side of [-1,1])for(let i=0;i<2;i++){const x=p.x+side*(13+i*7+(still?0:age*4));path(g,[{x:x-side*3,y:p.y-7-i*2},{x,y:p.y},{x:x-side*3,y:p.y+7+i*2}],0xffdf8b,2,fade);}
  }
  if(r.kind==='mesh'){
   const pulse=still?1:.5+Math.sin(age*12)*.5,corners=[this.floor(-35,-17),this.floor(35,-17),this.floor(35,17),this.floor(-35,17)];
   polygon(g,corners,0xc8f2d4,fade*(.12+pulse*.14));path(g,corners,0xe3ffe6,2.5,fade,true);
   for(const x of [-21,0,21])path(g,[this.floor(x,-17),this.floor(x+5*Math.sin(u*9),0),this.floor(x,17)],0xf4ffe3,1.8,fade);
  }
  if(r.kind==='spikes')for(let i=0;i<4;i++){
   const p=this.wall(-22+i*14,-22),length=still?7:4+Math.min(age,.35)*24;
   path(g,[{x:p.x,y:p.y},{x:p.x+(i-1.5)*length*.45,y:p.y-length}],0xffe0a2,1.8,fade);
  }
 }
 inspect(){const r=this.data;return {id:this.id,kind:r.kind,zone:r.zone,state:r.state||'ready',x:this.root.x,y:this.root.y,depth:this.root.depth,occludes:false,renderer:'DefenseComponent',visual:'v7',along:r.along,active:this.active,phase:this.phase,bellAngle:this.bell.angle,signal:r.signal?.type||null,signalId:r.signal?.id??null,index:r.index??null};}
 occlusion(){return {...this.inspect(),polygon:[],occludes:false};}
 destroy(){this.root.destroy(true);}
}
