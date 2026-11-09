import {ZONES} from '../src/content.js';
import {phaseBodyPoint} from './phase-creature-motion.js';

const tint={repair:0xe6b772,defense:0xc9d19d,dispatch:0x9dcfc8};
const mix=(a,b,p)=>({x:a.x+(b.x-a.x)*p,y:a.y+(b.y-a.y)*p});
function line(g,a,b,color,alpha=1,width=1){g.lineStyle(width,color,alpha);g.lineBetween(a.x,a.y,b.x,b.y);}
function sparks(g,p,age,color,count=5){
 for(let i=0;i<count;i++){const angle=i*2.399+age*1.4,speed=8+i*2.8,from={x:p.x+Math.cos(angle)*age*speed,y:p.y-3+Math.sin(angle)*age*speed*.5+age*age*9};line(g,from,{x:from.x-Math.cos(angle)*3,y:from.y-Math.sin(angle)*2},color,Math.max(0,1-age*1.5),1.3);}
}
export function createRobotFeedback(scene,toArt,registration,reduced){
 const ground=scene.add.graphics().setDepth(300),fx=scene.add.graphics().setDepth(681);let snapshot=[];
 function render(campaign,b,t,tokens){
  ground.clear();fx.clear();snapshot=[];
  for(const r of b?.robots||campaign.robots||[]){
   const obj=tokens.get('r-'+r.id),v=obj?.robotVisual;if(!obj||!v)continue;
   const foot={x:obj.x,y:obj.y},meta=registration.frames[v.frame],head=obj.robotAnchors?.antenna||obj.robotAnchors?.head||phaseBodyPoint(obj.sprite,meta,.58,.19),tool=obj.robotAnchors?.tool||phaseBodyPoint(obj.sprite,meta,.84,.60),color=tint[r.type];
   const record={robotId:r.id,phase:v.phase,frame:v.frame,effects:[],work:v.work,clock:v.clock};snapshot.push(record);
   ground.fillStyle(0x1d1c19,.2);ground.fillEllipse(foot.x,foot.y+1,r.type==='defense'?32:25,7);
   if(v.phase==='travel'&&!reduced){
    const cycle=obj.distance/8;record.effects.push('foot-dust');
    for(let i=0;i<3;i++){const age=(cycle+i/3)%1;ground.fillStyle(0xb8a286,(1-age)*.17);ground.fillEllipse(foot.x-obj.facing*(4+age*12),foot.y-1+age*2,2+age*5,1+age*2);}
   }
   if(r.type==='dispatch'&&v.phase==='travel'&&!reduced&&!obj.occluded){
    record.effects.push('wheel-roll');
    for(const [u,vv]of [[.27,.865],[.74,.86]]){const hub=phaseBodyPoint(obj.sprite,meta,u,vv),rotation=obj.distance/3;for(let i=0;i<3;i++){const a=rotation+i*Math.PI*2/3;line(fx,hub,{x:hub.x+Math.cos(a)*2.6,y:hub.y+Math.sin(a)*3.5},0xd0aa73,.8,1);}}
   }
   if(v.phase==='repair'){
    record.effects.push('tool-contact');const z=ZONES.find(z=>z.id===r.task?.zone),recipient=v.targetRobotId&&tokens.get('r-'+v.targetRobotId);
    if(z||recipient){const wall=z&&toArt(z),contact=recipient?{x:recipient.x+Math.sign(obj.x-recipient.x)*8,y:recipient.bodyBounds.top+recipient.bodyBounds.height*.62}:{x:wall.x+Math.sign(obj.x-wall.x)*11,y:wall.y-8};
     if(recipient){record.targetRobotId=v.targetRobotId;record.contact=contact;record.effects.push('robot-repair-contact');ground.lineStyle(1,color,.7);ground.strokeEllipse(recipient.x,recipient.y,30,10);}
     const beat=reduced?.58:v.beat;
     if(beat>.46&&beat<.82){
      if((recipient||Math.hypot(contact.x-tool.x,contact.y-tool.y)<48)&&!obj.occluded)line(fx,tool,contact,0xbba180,.5,1.5);
      fx.fillStyle(0xffe1a2,reduced?.65:.95);fx.fillCircle(contact.x,contact.y,reduced?1.5:2.5);
      if(!reduced){sparks(fx,contact,(beat-.46)*1.9,0xffd598,5);record.effects.push('repair-sparks');}
     }
     // Show progress from the simulation’s repair task.
     const top=obj.bodyBounds.top-6;fx.fillStyle(0x2a2924,.85);fx.fillRoundedRect(obj.x-14,top,28,3,1);fx.fillStyle(color,1);fx.fillRoundedRect(obj.x-14,top,28*v.work,3,1);
    }
   }
   if(v.phase==='strike'&&v.attack){
    record.effects.push('shield-strike');const hit=toArt(v.attack),age=v.beat;
    if(age<.55){if(!reduced){sparks(fx,hit,age,0xefe2bc,4);const a={x:hit.x-obj.facing*13,y:hit.y-12};line(fx,a,{x:hit.x+obj.facing*4,y:hit.y-6},0xf2ddb2,(1-age)*.75,2);}
     else{fx.lineStyle(1.3,color,.75);fx.strokeEllipse(hit.x,hit.y-6,12,8);}}
   }
   if(r.type==='dispatch'&&v.signal){
    const age=v.beat,fade=Math.max(0,1-age);record.effects.push(v.phase==='listen'?'listen-cue':'radio-transmit');
    if(!obj.occluded){fx.lineStyle(1.1,color,.8*fade);for(let i=0;i<2;i++){const radius=reduced?7+i*4:5+i*5+age*9;fx.strokeEllipse(head.x,head.y-4,radius,radius*.7);}}
    if(v.phase==='transmit'){
     const worker=tokens.get('r-'+v.signal.robotId),end=worker?{x:worker.x,y:worker.y-25}:toArt(v.signal.target),start={x:head.x,y:head.y-6};
     if(end){
      const length=Math.hypot(end.x-start.x,end.y-start.y),pieces=Math.max(1,Math.min(24,Math.ceil(length/10)));
      for(let i=0;i<pieces;i++){const a=mix(start,end,i/pieces),c=mix(start,end,(i+.48)/pieces);line(fx,a,c,color,fade*.55);}
      if(!reduced){const dot=mix(start,end,Math.min(1,(age*2)%1));fx.fillStyle(0xe1f0dc,fade);fx.fillCircle(dot.x,dot.y,2);}
      if(worker){ground.lineStyle(1.2,color,fade*.9);ground.strokeEllipse(worker.x,worker.y,27+(reduced?0:age*14),10+(reduced?0:age*5));}
      record.receiver=v.signal.robotId;record.effects.push('dispatch-link');
     }
    }else if(v.signal.point){const p=toArt(v.signal.point);fx.lineStyle(1,color,fade*.65);fx.strokeEllipse(p.x,p.y-7,12+(reduced?0:age*15),7+(reduced?0:age*7));}
   }
   if(v.flash>0){record.effects.push('damage-recoil');if(!reduced)sparks(fx,{x:obj.x,y:obj.y-24},(1-v.flash)*.42,0xf1bb8d,3);}
   if(v.phase==='offline'||v.phase==='broken'){
    record.effects.push('power-off');if(!obj.occluded){fx.lineStyle(1.2,0xc1957c,.8);fx.strokeRect(head.x-3,head.y-1,6,3);}
   }
  }
 }
 return {render,snapshot:()=>snapshot,destroy(){ground.destroy();fx.destroy();}};
}
