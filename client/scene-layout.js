export { artPoint,worldPoint,PLOTS } from '../src/yard-geometry.js';
export function pickPerson(tokens,p,padding=8,after=null){
 const matches=[...tokens].filter(([id,o])=>id.startsWith('p-')&&o.bodyBounds).map(([id,o])=>{const b=o.bodyBounds,hit=p.x>=b.left-padding&&p.x<=b.left+b.width+padding&&p.y>=b.top-padding&&p.y<=Math.max(b.top+b.height,o.y+5)+Math.min(padding,4);return {id:id.slice(2),hit,score:Math.hypot(p.x-(b.left+b.width/2),p.y-(b.top+b.height*.55))};}).filter(o=>o.hit).sort((a,b)=>a.score-b.score);
 const previous=matches.findIndex(o=>o.id===after);return matches.length?matches[(previous+1)%matches.length].id:null;
}
// Side panels lie along the receding walls; vertical boards remain upright.
export function fenceProjection(zone){return zone==='left'?{x:.2,y:-1}:zone==='right'?{x:.2,y:1}:null;}
export function projectSurfacePoint(p,projection){return projection?{x:p.x*projection.x,y:p.y+p.x*projection.y}:{...p};}
export function unprojectSurfacePoint(p,projection){if(!projection)return {...p};const x=p.x/projection.x;return {x,y:p.y-x*projection.y};}
export function structureState(hp,max=100){return hp<=0?'destroyed':hp<max?'damaged':'intact';}
export function pointInPolygon(p,polygon){let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
 const a=polygon[i],b=polygon[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
 }return inside;}
export function unitOcclusionLayers(point,body,components){
 return components.filter(c=>{
  if(!c.occludes)return false;
  const b=c.bounds||{left:Math.min(...c.polygon.map(p=>p.x)),right:Math.max(...c.polygon.map(p=>p.x)),top:Math.min(...c.polygon.map(p=>p.y)),bottom:Math.max(...c.polygon.map(p=>p.y))};
  const left=Math.max(body.left-3,b.left),right=Math.min(body.left+body.width+3,b.right);
  if(right<=left||body.top+body.height+3<=b.top||body.top-3>=b.bottom)return false;
  const depth=c.depthAt?Math.max(c.depthAt({x:left}),c.depthAt({x:right})):c.depth;
  return point.y<depth-2;
 });
}
export function unitOccluders(point,body,components){
 const samples=[{x:point.x,y:body.top+body.height*.35},{x:point.x,y:body.top+body.height*.7},
  {x:body.left+body.width*.25,y:body.top+body.height*.6},{x:body.left+body.width*.75,y:body.top+body.height*.6}];
 return components.filter(c=>{
  if(!c.occludes||point.y>=(c.depthAt?c.depthAt(point):c.depth)-2)return false;
  const covered=p=>pointInPolygon(p,c.polygon)&&(!c.covers||c.covers(p));
  if(samples.some(covered))return true;
  // A receding side panel is narrower than a body. Sample the actual overlap,
  // so it cannot slip between the center/quarter-body probes.
  const bounds=c.bounds||{left:Math.min(...c.polygon.map(p=>p.x)),right:Math.max(...c.polygon.map(p=>p.x)),top:Math.min(...c.polygon.map(p=>p.y)),bottom:Math.max(...c.polygon.map(p=>p.y))};
  const left=Math.max(body.left,bounds.left),right=Math.min(body.left+body.width,bounds.right),top=Math.max(body.top,bounds.top),bottom=Math.min(body.top+body.height,bounds.bottom);
  if(right<=left||bottom<=top)return false;
  for(const x of [.2,.5,.8])for(const y of [.2,.5,.8])if(covered({x:left+(right-left)*x,y:top+(bottom-top)*y}))return true;
  return false;
 }).map(c=>c.id);
}
