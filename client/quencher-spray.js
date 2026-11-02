const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
// Mouth anchors in the four 362px quencher frames, before horizontal mirroring.
const MOUTHS=[{x:262,y:108},{x:263,y:110},{x:271,y:113},{x:244,y:110}];

export function quencherMouth(sprite){
 const frame=sprite.frame,mouth=MOUTHS[Number(frame.name)%4];
 const x=((sprite.flipX?frame.cutWidth-mouth.x:mouth.x)-sprite.originX*frame.cutWidth)*sprite.scaleX;
 const y=(mouth.y-sprite.originY*frame.cutHeight)*sprite.scaleY,angle=sprite.rotation||0;
 return {x:sprite.x+x*Math.cos(angle)-y*Math.sin(angle),y:sprite.y+x*Math.sin(angle)+y*Math.cos(angle)};
}

export function createSprayArc(start,end){
 const distance=Math.hypot(end.x-start.x,end.y-start.y);
 return {start:{...start},end:{...end},control:{x:(start.x+end.x)/2,y:Math.min(start.y,end.y)-Math.min(95,30+distance*.18)},duration:clamp(.4+distance/700,.5,.95)};
}

export function sprayPoint(arc,progress){
 const u=clamp(progress,0,1),v=1-u,{start:a,control:b,end:c}=arc;
 return {x:v*v*a.x+2*v*u*b.x+u*u*c.x,y:v*v*a.y+2*v*u*b.y+u*u*c.y};
}

// Sample using simulation time only. Flight geometry survives movement or death
// of the emitter after launch, and a paused snapshot cannot advance the spray.
export function sprayFrame(arc,age,reduced=false){
 const drops=[];
 for(let i=0;i<(reduced?3:5);i++){
  const u=reduced?.2+i*.3:(age-i*.035)/arc.duration;
  if(u<0||u>1)continue;
  drops.push({index:i,progress:u,...sprayPoint(arc,u),tail:sprayPoint(arc,Math.max(0,u-.035))});
 }
 return {phase:reduced?'reduced':age<arc.duration?'flight':'impact',progress:reduced?1:clamp(age/arc.duration,0,1),drops,impactAge:reduced?0:age-arc.duration};
}
