// A low-health hunter evaluates real walls, attachments and available guards.
// No random draws: the same preparation and commands produce the same route.
export function defenseStrength(state,zone,positions){
 const hp=Math.max(0,zone.hp),ratio=hp/Math.max(1,zone.max||100);
 if(hp===0)return -100;
 const point=positions.find(p=>p.id===zone.id);
 const guards=(state.people||[]).filter(p=>{
  if(p.dead||p.wound==='severe'||p.nightRole==='sleep'||state.indoorPeople?.[p.id])return false;
  if(p.task&&!['guard','brace','move'].includes(p.task.type))return false;
  if(Number.isFinite(p.x)&&Number.isFinite(p.y)&&point)return Math.hypot(p.x-point.x,p.y-point.y)<110;
  return (p.task?.target||p.zone)===zone.id;
 }).length;
 return ratio*100+(zone.spikes?28:0)+(zone.mesh?12:0)+(zone.bell?4:0)+Math.max(0,zone.traps||0)*18+guards*24;
}

export function weakestZone(state,positions,current=null){
 return [...state.zones].sort((a,b)=>defenseStrength(state,a,positions)-defenseStrength(state,b,positions)
  ||Number(b.id===current)-Number(a.id===current))[0]?.id||current;
}

// Painted-ground coordinates, outside every intact fence and the courtyard.
// Retargeting follows this ring instead of cutting through the house or yard.
const PERIMETER=[{x:240,y:510},{x:-12,y:510},{x:-12,y:258},{x:35,y:90},
 {x:169,y:90},{x:311,y:90},{x:445,y:90},{x:492,y:258},{x:492,y:510}];
const ENTRANCES={gate:0,left:2,backLeft:4,backRight:5,right:7};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function skitterDetour(from,zone){
 let start=0;for(let i=1;i<PERIMETER.length;i++)if(distance(from,PERIMETER[i])<distance(from,PERIMETER[start]))start=i;
 const end=ENTRANCES[zone],routes=[1,-1].map(direction=>{
  const points=[PERIMETER[start]];let i=start;
  while(i!==end){i=(i+direction+PERIMETER.length)%PERIMETER.length;points.push(PERIMETER[i]);}
  return {points,length:points.reduce((n,p,j)=>n+distance(j?points[j-1]:from,p),0)};
 });
 return routes.sort((a,b)=>a.length-b.length)[0].points.map(p=>({...p}));
}

export function rethinkSkitter(state,e,dt,positions,toArt,fromArt){
 if(e.type!=='skitter'||e.mode!=='approach'||state.elapsed<(e.huntLuredUntil||0))return null;
 e.huntRecheck=Math.max(0,(e.huntRecheck||0)-dt);if(e.huntRecheck>1e-8)return null;
 e.huntRecheck=1.25;
 const next=weakestZone(state,positions,e.zone),current=state.zones.find(z=>z.id===e.zone),target=state.zones.find(z=>z.id===next);
 if(!target||next===e.zone||defenseStrength(state,current,positions)-defenseStrength(state,target,positions)<18)return null;
 const from=e.zone;e.zone=next;e.attack=0;e.progress=0;e.huntPath=skitterDetour(toArt(e),next).map(fromArt);
 return {from,to:next};
}
