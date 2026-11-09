import { artPoint,worldPoint,DEFAULT_WALK_MAP } from './yard-geometry.js';

const EPS=1e-7,distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const finite=p=>!!p&&typeof p==='object'&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const cross=(a,b)=>a.x*b.y-a.y*b.x;
const subtract=(a,b)=>({x:a.x-b.x,y:a.y-b.y});
const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
function project(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return mix(a,b,t);}
function edges(polygon){return polygon.map((p,i)=>[p,polygon[(i+1)%polygon.length]]);}
function contains(p,polygon){
 let inside=false;for(let i=0;i<polygon.length;i++){
  const a=polygon[i],b=polygon[(i+1)%polygon.length];
  if(distance(p,project(p,a,b))<EPS)return 0;
  if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
 }return inside?1:-1;
}
function walkableArt(p,map){return contains(p,map.boundary)>=0&&map.obstacles.every(poly=>contains(p,poly)<=0);}
export function walkablePoint(p,map=DEFAULT_WALK_MAP){return finite(p)&&walkableArt(artPoint(p),map);}

function intersection(a,b,c,d){
 const r=subtract(b,a),s=subtract(d,c),den=cross(r,s);if(Math.abs(den)<EPS)return null;
 const offset=subtract(c,a),t=cross(offset,s)/den,u=cross(offset,r)/den;
 return t>=-EPS&&t<=1+EPS&&u>=-EPS&&u<=1+EPS?Math.max(0,Math.min(1,t)):null;
}
// Split at every boundary crossing; fixed sampling misses short corner cuts.
function clearPath(a,b,map,segments){
 const cuts=[0,1];for(const [c,d] of segments){const t=intersection(a,b,c,d);if(t!==null)cuts.push(t);}
 cuts.sort((x,y)=>x-y);for(let i=1;i<cuts.length;i++)if(cuts[i]-cuts[i-1]>EPS&&!walkableArt(mix(a,b,(cuts[i]+cuts[i-1])/2),map))return false;
 return true;
}
const graphs=new WeakMap(),routes=new WeakMap();
function graphFor(map){
 if(graphs.has(map))return graphs.get(map);
 const polygons=[map.boundary,...map.obstacles],segments=polygons.flatMap(edges),points=polygons.flat();
 // Include intersections when a placed facility overlaps a wall or hearth.
 for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){
  const t=intersection(...segments[i],...segments[j]);if(t!==null)points.push(mix(...segments[i],t));
 }
 const nodes=points.filter(p=>walkableArt(p,map)).filter((p,i,all)=>all.findIndex(q=>distance(p,q)<EPS)===i),links=nodes.map(()=>[]);
 for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++)if(clearPath(nodes[i],nodes[j],map,segments)){
  const d=distance(nodes[i],nodes[j]);links[i].push([j,d]);links[j].push([i,d]);
 }
 const graph={nodes,links,segments};graphs.set(map,graph);return graph;
}
function path(a,b,map,graph){
 if(clearPath(a,b,map,graph.segments))return [b];
 const {nodes,links}=graph,n=nodes.length,dist=nodes.map(p=>clearPath(a,p,map,graph.segments)?distance(a,p):Infinity),prev=nodes.map(()=>-1),done=new Set();
 let end=-1,best=Infinity;
 for(let step=0;step<n;step++){
  let k=-1;for(let j=0;j<n;j++)if(!done.has(j)&&(k<0||dist[j]<dist[k]))k=j;
  if(k<0||!Number.isFinite(dist[k])||dist[k]>best)break;done.add(k);
  if(clearPath(nodes[k],b,map,graph.segments)&&dist[k]+distance(nodes[k],b)<best){best=dist[k]+distance(nodes[k],b);end=k;}
  for(const [j,d] of links[k])if(dist[k]+d<dist[j]){dist[j]=dist[k]+d;prev[j]=k;}
 }
 if(end<0)return null;const result=[b];for(let k=end;k>=0;k=prev[k])result.unshift(nodes[k]);return result;
}
function nearestArt(p,map,graph,from=null){
 const reachable=q=>!from||path(from,q,map,graph)!==null;
 if(walkableArt(p,map)&&reachable(p))return {...p};
 const candidates=[...graph.nodes,...graph.segments.map(([a,b])=>project(p,a,b))].filter(q=>walkableArt(q,map)).sort((a,b)=>distance(p,a)-distance(p,b));
 return candidates.find(reachable)||null;
}
export function nearestWalkablePoint(p,map=DEFAULT_WALK_MAP,from=null){
 if(!finite(p))return null;const graph=graphFor(map),start=finite(from)?nearestArt(artPoint(from),map,graph):null,point=nearestArt(artPoint(p),map,graph,start);
 return point?(distance(point,artPoint(p))<EPS?{x:p.x,y:p.y}:worldPoint(point)):null;
}

function walkingRoute(p,t,map){
 let route=routes.get(p);
 if(!route||route.map!==map||route.tx!==t.x||route.ty!==t.y||route.x!==p.x||route.y!==p.y){
  const graph=graphFor(map),a=artPoint(p),start=nearestArt(a,map,graph),end=nearestArt(artPoint(t),map,graph,start);
  if(!start||!end)return null;const planned=path(start,end,map,graph);if(!planned)return null;
  route={map,tx:t.x,ty:t.y,x:p.x,y:p.y,goal:distance(end,artPoint(t))<EPS?{x:t.x,y:t.y}:worldPoint(end),points:distance(a,start)>EPS?[start,...planned]:planned,index:0};routes.set(p,route);
 }
 return route;
}

export function moveToward(p,t,speed,dt,avoid=false,map=DEFAULT_WALK_MAP){
 if(!avoid){const d=distance(p,t);if(d>EPS)Object.assign(p,mix(p,t,Math.min(1,speed*dt/d)));return distance(p,t)<8;}
 const route=walkingRoute(p,t,map);if(!route)return false;
 // Stop on a corner for this tick. Combining two legs would let render
 // interpolation cut diagonally through the obstacle between snapshots.
 if(route.index<route.points.length&&speed*dt>EPS){
  const target=route.points[route.index],world=route.index===route.points.length-1?route.goal:worldPoint(target),d=distance(p,world),fraction=d<EPS?1:Math.min(1,speed*dt/d);
  Object.assign(p,fraction===1?world:worldPoint(mix(artPoint(p),target,fraction)));if(fraction===1)route.index++;
 }
 route.x=p.x;route.y=p.y;return distance(p,route.goal)<8;
}

// Use the movement ticks and stopping distance the worker will actually use.
// An interaction range is measured to the real target, not its snapped point.
export function walkTravelTime(from,target,speed,dt,limit,map=DEFAULT_WALK_MAP,range=null){
 const p={x:from.x,y:from.y};
 if(range!==null&&distance(p,target)<=range)return 0;
 const route=walkingRoute(p,target,map);
 if(!route)return Infinity;
 const reached=()=>range===null?distance(p,route.goal)<8:distance(p,target)<=range;
 if(reached())return 0;
 for(let tick=1;tick*dt<=limit&&route.index<route.points.length;tick++){
  moveToward(p,target,speed,dt,true,map);
  if(reached())return tick*dt;
 }
 return Infinity;
}
