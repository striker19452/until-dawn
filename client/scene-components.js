import {formatDurability} from '../src/format.js';
import { BUILDINGS,ZONES } from '../src/content.js';
import { HOUSE_ANCHOR } from '../src/yard-geometry.js';
import { yardFires } from '../src/campfire.js';
import {buildingHealth,BUILDING_MAX_HP,buildingPlot} from '../src/building-health.js';
import {buildingStateFrame,buildingStateRegistration,registerBuildingStateFrames} from './building-art.js';
import { CampfireComponent,registerCampfireFrames } from './campfire-art.js';
import { DefenseComponent,DEFENSE_KINDS,defenseLayout,defenseSignal } from './defense-art.js';
import registration from './assets/structures-v5.json';
import {latestStructureImpact} from './enemy-impact.js';
import { artPoint,PLOTS,structureState,unitOccluders,unitOcclusionLayers,fenceProjection,projectSurfacePoint,unprojectSurfacePoint } from './scene-layout.js';

// Small alpha masks keep transparent gutters and open roof corners from hiding units.
const masks=new WeakMap();
function spriteCovers(sprite,p,projection){
 let frames=masks.get(sprite.texture);if(!frames){frames=new Map();masks.set(sprite.texture,frames);}
 const frame=sprite.frame;let mask=frames.get(frame.name);
 if(!mask){const width=160,height=Math.round(frame.cutHeight/frame.cutWidth*width),canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(frame.source.image,frame.cutX,frame.cutY,frame.cutWidth,frame.cutHeight,0,0,width,height);mask={width,height,pixels:ctx.getImageData(0,0,width,height).data};frames.set(frame.name,mask);}
 const local=unprojectSurfacePoint({x:(p.x-sprite.parentContainer.x)/sprite.scaleX,y:(p.y-sprite.parentContainer.y)/sprite.scaleY},projection);
 const x=Math.floor((local.x+sprite.originX*frame.cutWidth)/frame.cutWidth*mask.width),y=Math.floor((local.y+sprite.originY*frame.cutHeight)/frame.cutHeight*mask.height);
 return x>=0&&y>=0&&x<mask.width&&y<mask.height&&mask.pixels[(y*mask.width+x)*4+3]>40;
}
const BUILD_IDS=Object.keys(BUILDINGS);
const atlas={'house':'house-states-v5','gate':'gate-states-v5','fence':'fence-states-v5','buildings':'buildings-v3'};
const polygon=(bounds)=>[{x:bounds.left,y:bounds.top},{x:bounds.right,y:bounds.top},{x:bounds.right,y:bounds.bottom},{x:bounds.left,y:bounds.bottom}];

// Each installed item owns its display objects, state and lifetime independently.
class YardComponent{
 constructor(scene,record){this.scene=scene;this.id=record.id;this.root=scene.add.container(record.x,record.y).setName(record.id);this.graphic=scene.add.graphics();this.root.add(this.graphic);this.sprite=null;this.key='';this.data=null;}
 update(r,t){
  this.root.setPosition(r.x,r.y).setDepth(r.depth??r.y);this.data=r;
  const key=JSON.stringify(r);if(key!==this.key){this.key=key;this.graphic.clear();
   if(r.texture){if(!this.sprite){this.sprite=r.projection?this.scene.add.mesh2d(0,0,r.texture,new Array(16).fill(0),[0,3,1,0,3,1,2,0]):this.scene.add.image(0,0,r.texture,String(r.frame||0));if(r.projection)this.sprite.buildOrderedIndices(1,true);this.root.addAt(this.sprite,0);}this.sprite.setTexture(r.texture,String(r.frame||0));
    const meta=r.texture==='building-states'?buildingStateRegistration.frames[r.frame]:atlas[r.texture]&&registration[atlas[r.texture]].frames[r.frame||0];
    const origin=meta?.origin||[.5,.8];this.sprite.setOrigin(...origin);const cellWidth=meta?.rect[2]||this.sprite.frame.cutWidth;
    this.sprite.setVisible(true).setScale((r.size||80)/(meta?.scaleWidth||cellWidth));if(r.night&&['buildings','building-states'].includes(r.texture))this.sprite.setTint(0x9daec5);else this.sprite.clearTint();
    if(meta){
     const [w,h]=meta.rect.slice(2),scale=this.sprite.scaleX;
     const local=(x,y)=>projectSurfacePoint({x:x-origin[0]*w,y:y-origin[1]*h},r.projection);
     if(r.projection){const frame=this.sprite.frame;this.sprite.vertices=[[0,0],[w,0],[w,h],[0,h]].flatMap(([x,y])=>{const p=local(x,y);return [p.x,p.y,frame.u0+(frame.u1-frame.u0)*x/w,frame.v0+(frame.v1-frame.v0)*y/h];});}
     const b=meta.bounds;this.surface=[[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]]].map(([x,y])=>{const p=local(x,y);return {x:r.x+p.x*scale,y:r.y+p.y*scale};});
     this.bounds={left:Math.min(...this.surface.map(p=>p.x)),top:Math.min(...this.surface.map(p=>p.y)),right:Math.max(...this.surface.map(p=>p.x)),bottom:Math.max(...this.surface.map(p=>p.y))};
    }
   }else{this.draw(r);this.bounds={left:r.x-(r.width||45)/2,top:r.y-(r.height||35),right:r.x+(r.width||45)/2,bottom:r.y};}
   if(r.kind==='house'&&r.state==='damaged'){this.graphic.lineStyle(1.5,0x8d6b53,.8);for(const x of [-65,61]){this.graphic.lineBetween(x,-48,x+5,-34);this.graphic.lineBetween(x+5,-34,x-2,-24);}}
   if(['buildings','building-states'].includes(r.texture))this.drawBuilding(r);
  }
  if(r.impact?.flash)this.sprite?.setTint(0xffb49a);
 }
 draw(r){const g=this.graphic;
  if(r.kind==='compacted'){g.lineStyle(2,0xd6bd91,.8);for(const off of [-8,0,8])g.lineBetween(-23,off,23,off);}
 }
 drawBuilding(r){
  const g=this.graphic,ruined=r.state==='destroyed',color=r.hp<=3?0xf39b7c:0xdabf7c;
  // Physical damage and ruins use sixteen dedicated painted sprites. The
  // graphics layer only owns the shared UI, never a substitute rubble icon.
  if(r.attacked){g.lineStyle(2.5,0xf59973,.95);g.strokeEllipse(0,-5,75,33);}
  g.fillStyle(0x242e30,.95);g.fillRoundedRect(-27,5,54,6,2);g.fillStyle(ruined?0xb66559:color,1);g.fillRoundedRect(-26,6,52*r.hp/BUILDING_MAX_HP,4,1);
  if(!this.healthLabel){this.healthLabel=this.scene.add.text(0,15,'',{fontFamily:'PingFang SC, sans-serif',fontSize:'12px',color:'#fff0d0',backgroundColor:'#253033e8',padding:{x:3,y:2}}).setOrigin(.5,0);this.root.add(this.healthLabel);}
  this.healthLabel.setText(`${BUILDINGS[r.kind].name} ${formatDurability(r.hp)}/${BUILDING_MAX_HP}${ruined?' · 损毁':''}`);
 }
 inspect(){return {id:this.id,kind:this.data.kind,zone:this.data.zone,state:this.data.state,frame:this.data.frame,texture:this.data.texture,plot:this.data.plot,depth:this.root.depth,impact:this.data.impact||null,projection:this.data.projection||null,uv:this.sprite?.type==='Mesh2D'?Array.from({length:4},(_,i)=>({x:this.sprite.vertices[i*4+2],y:this.sprite.vertices[i*4+3]})):null,renderer:this.sprite?.type,quad:this.sprite?.type==='Mesh2D'?Array.from({length:4},(_,i)=>({x:this.root.x+this.sprite.vertices[i*4]*this.sprite.scaleX,y:this.root.y+this.sprite.vertices[i*4+1]*this.sprite.scaleY})):null,hp:this.data.hp,occludes:!!this.data.occludes,bounds:this.bounds};}
 paintOcclusion(ctx,point){
  if(!this.sprite||!this.data.occludes)return;
  const sprite=this.sprite,frame=sprite.frame,projection=this.data.projection;
  ctx.save();
  // Receding side boards have a different front/back depth in each column.
  if(projection){const slope=projection.y/projection.x,edge=this.root.x+(point.y+2-this.root.depth)/slope,b=this.bounds;
   const left=slope>0?Math.max(b.left,edge):b.left,right=slope<0?Math.min(b.right,edge):b.right;
   if(right<=left){ctx.restore();return;}ctx.beginPath();ctx.rect(left,b.top,right-left,b.bottom-b.top);ctx.clip();
  }else if(point.y>=this.root.depth-2){ctx.restore();return;}
  ctx.translate(this.root.x,this.root.y);ctx.scale(sprite.scaleX,sprite.scaleY);
  if(projection)ctx.transform(projection.x,projection.y,0,1,0,0);
  ctx.drawImage(frame.source.image,frame.cutX,frame.cutY,frame.cutWidth,frame.cutHeight,-sprite.originX*frame.cutWidth,-sprite.originY*frame.cutHeight,frame.cutWidth,frame.cutHeight);
  ctx.restore();
 }
 occlusion(){return {...this.inspect(),maskKey:['buildings','building-states'].includes(this.data.texture)?`${this.data.texture}:${this.data.frame}:${this.data.x}:${this.data.y}:${this.data.size}:${this.data.occludes}`:this.key,paintMask:(ctx,point)=>this.paintOcclusion(ctx,point),polygon:this.surface||(this.bounds?polygon(this.bounds):[]),depthAt:this.data.projection?p=>this.root.depth+(p.x-this.root.x)*this.data.projection.y/this.data.projection.x:null,covers:this.sprite?p=>spriteCovers(this.sprite,p,this.data.projection):null};}
 destroy(){this.root.destroy(true);}
}

export function registerStructureFrames(scene){for(const [key,name] of Object.entries(atlas)){const texture=scene.textures.get(key);for(const [i,frame] of registration[name].frames.entries())if(!texture.has(String(i)))texture.add(String(i),0,...frame.rect);}registerCampfireFrames(scene);registerBuildingStateFrames(scene);}
export function createSceneComponents(scene){
 const items=new Map();let descriptors=[];
 const reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 function render(campaign,battle,t){const night=!!battle,zones=battle?.zones||campaign.zones,records=[];
  const houseHp=battle?.house??campaign.house;
  records.push({id:'house',kind:'house',...HOUSE_ANCHOR,depth:HOUSE_ANCHOR.y,texture:'house',frame:night?1:0,hp:houseHp,state:structureState(houseHp),occludes:true,night});
  for(const z of zones){const p=artPoint(ZONES.find(q=>q.id===z.id)),state=structureState(z.hp,z.max);
   records.push(z.id==='gate'?{id:'gate',kind:'gate',zone:z.id,x:p.x,y:p.y+25,depth:p.y-8,texture:'gate',frame:(night?3:0)+['intact','damaged','destroyed'].indexOf(state),size:116,hp:z.hp,state,occludes:state!=='destroyed',night}:{id:'fence-'+z.id,kind:'fence',zone:z.id,x:p.x,y:p.y+12,depth:p.y-6,texture:'fence',projection:fenceProjection(z.id),frame:(night?3:0)+['intact','damaged','destroyed'].indexOf(state),size:64,hp:z.hp,state,occludes:state!=='destroyed',night});
   const layout=defenseLayout(z.id,p);
   for(const kind of ['mesh','spikes','bell'])if(z.hp>0&&z[kind]){const q=layout[kind];records.push({id:kind+'-'+z.id,kind,zone:z.id,...q,along:layout.along,inward:layout.inward,depth:q.y+(kind==='mesh'?8:6),night,signal:defenseSignal(kind,z.id,battle)});}
   if(z.compacted)records.push({id:'compacted-'+z.id,kind:'compacted',zone:z.id,x:p.x,y:p.y+22,depth:p.y+5,night});
   for(let i=0;i<(z.hp>0?z.traps:0);i++){const offset=(i-1)*22;records.push({id:'trap-'+z.id+'-'+i,kind:'trap',zone:z.id,x:layout.traps.x+layout.along.x*offset,y:layout.traps.y+layout.along.y*offset,depth:layout.traps.y+layout.along.y*offset+2,along:layout.along,inward:layout.inward,index:i,night});}
  }
  for(const [i,b] of campaign.buildings.entries()){const plot=buildingPlot(b,i),p=artPoint(PLOTS[plot]),hp=buildingHealth(battle?.buildings?.find(q=>q.id===b.id)||b),state=hp===0?'destroyed':hp<BUILDING_MAX_HP?'damaged':'intact';records.push({id:'building-'+b.id,kind:b.type,plot,x:p.x,y:p.y,depth:p.y,texture:state==='intact'?'buildings':'building-states',frame:buildingStateFrame(b.type,state)??BUILD_IDS.indexOf(b.type),size:b.type==='watchtower'?128:114,hp,state,attacked:!!battle?.enemies.some(e=>e.mode==='inside'&&e.targetId===b.id&&e.attackTarget?.kind!=='person'),occludes:hp>0,night});}
  for(const f of yardFires(campaign,battle)){const p=artPoint(f);records.push({id:'fire-central',kind:'fire',zone:'central',x:p.x,y:p.y,depth:p.y,heat:f.heat,wet:f.wet,night});}
  const used=new Set();for(const r of records){
   if(r.texture){const id=r.zone||r.id.replace(/^building-/,''),impact=latestStructureImpact(battle,id,t,reduced);if(impact){r.impact={age:impact.age,shake:impact.shake,flash:impact.flash};r.x+=impact.shake;r.y+=impact.shake*.35;}}
   used.add(r.id);if(!items.has(r.id))items.set(r.id,r.kind==='fire'?new CampfireComponent(scene,r):DEFENSE_KINDS.has(r.kind)?new DefenseComponent(scene,r):new YardComponent(scene,r));items.get(r.id).update(r,t);}
  for(const [id,item] of items)if(!used.has(id)){item.destroy();items.delete(id);}
  descriptors=[...items.values()].map(item=>item.occlusion());
 }
 return {render,occluders(point,body){return unitOccluders(point,body,descriptors);},occlusionLayers(point,body){return unitOcclusionLayers(point,body,descriptors);},snapshot:()=>[...items.values()].map(item=>item.inspect()),destroy(){for(const item of items.values())item.destroy();items.clear();}};
}
