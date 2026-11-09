import {artPoint} from '../src/yard-geometry.js';

// Small, bounded effects share the characters' simulation clock. Paint only
// current work beats and confirmed actions, with no particle emitters/timers.
export function createHumanFeedback(scene,reduced=false){
 const ground=scene.add.graphics().setDepth(609.8),fx=scene.add.graphics().setDepth(788),throws=new Map();let battleId=null,snapshot=[];
 function line(a,b,color,alpha,width=1.4){fx.lineStyle(width+1.8,0x302a23,alpha*.75);fx.lineBetween(a.x,a.y,b.x,b.y);fx.lineStyle(width,color,alpha);fx.lineBetween(a.x,a.y,b.x,b.y);}
 function render(b,t,tokens){
  ground.clear();fx.clear();snapshot=[];
  if(b?.id!==battleId){throws.clear();battleId=b?.id;}
  const used=new Set();
  for(const [key,obj]of tokens){
   if(!key.startsWith('p-'))continue;
   const pose=obj.humanVisual;if(!pose)continue;
   const sign=obj.facing,hand=obj.humanArmActive&&obj.humanHand||{x:obj.x+sign*12,y:obj.y-29};
   // A compressed contact shadow gives leaning and stamping a grounded foot.
   ground.fillStyle(0x161b1b,.18);ground.fillEllipse(obj.x,obj.y-1,pose.phase==='compact'?25:21,6);
   const effect={personId:key.slice(2),phase:pose.phase,effects:[]};snapshot.push(effect);
   if(pose.phase==='strike'&&pose.event){
    const age=pose.clock-pose.event.time,enemy=tokens.get('e-'+pose.event.enemyId),at=enemy?{x:enemy.x,y:enemy.y-27}:artPoint(pose.event);
    const alpha=Math.max(0,1-age/.4);
    if(alpha>0){
     effect.effects.push('strike-contact');
     if(!reduced){
      const from={x:hand.x-sign*6,y:hand.y+3};
      fx.lineStyle(1.6,0xf2dbab,alpha*.85);fx.beginPath();fx.arc(from.x,from.y,9,sign>0?-.9:Math.PI-.7,sign>0?.7:Math.PI+.9);fx.strokePath();
      for(let i=0;i<3;i++){const angle=-1.2+i*1.1;line({x:at.x+Math.cos(angle)*3,y:at.y+Math.sin(angle)*3},{x:at.x+Math.cos(angle)*(7+age*15),y:at.y+Math.sin(angle)*(7+age*15)},0xffe1a8,alpha);}
     }else line({x:at.x-3,y:at.y-3},{x:at.x+3,y:at.y+3},0xffe1a8,alpha);
    }
   }else if(pose.phase==='release'&&pose.event){
    const e=pose.event,age=pose.clock-e.time;used.add(e.id);
    if(!throws.has(e.id))throws.set(e.id,{start:{x:hand.x,y:hand.y},end:{x:artPoint(e).x,y:artPoint(e).y-16}});
    const {start,end}=throws.get(e.id),u=Math.min(1,age/.32);
    effect.effects.push('thrown-stone');
    if(reduced){line(start,end,0xe9d4ac,.24,1);}
    else if(u<1){
     const point=v=>({x:start.x+(end.x-start.x)*v,y:start.y+(end.y-start.y)*v-Math.sin(v*Math.PI)*24});
     const at=point(u),tail=point(Math.max(0,u-.13));line(tail,at,0xe9d4ac,.8,1.6);
     fx.fillStyle(0x332c25,1);fx.fillCircle(at.x,at.y,3.4);fx.fillStyle(0xe2cfac,1);fx.fillCircle(at.x-.5,at.y-.6,2.2);
    }
   }
   if(reduced||!obj.humanArmActive)continue;
   if(['repair','barricade'].includes(pose.phase)&&pose.contact>0){
    effect.effects.push('repair-chips');
    for(let i=0;i<4;i++){const spread=1-pose.contact,x=hand.x+sign*(2+i*2+spread*6),y=hand.y+i%2*2-spread*(4+i*2);line({x,y},{x:x+sign*2,y:y-2},i%2?0xd3b480:0xffdfa3,pose.contact*.9,1.2);}
   }else if(pose.phase==='compact'&&pose.contact>0){
    effect.effects.push('stamp-dust');
    for(let i=0;i<3;i++){ground.fillStyle(0xb8a58a,pose.contact*.3);ground.fillEllipse(obj.x+(i-1)*9,obj.y-2,6+pose.contact*5,3);}
   }else if(['fire','stoke','addWood'].includes(pose.phase)){
    effect.effects.push('tend-embers');
    for(let i=0;i<2;i++){const u=(pose.beat+i*.5)%1;fx.fillStyle(i?0xd49b62:0xf2ca87,(1-u)*.7);fx.fillCircle(hand.x+sign*(3+u*5),hand.y-u*9,1);}
   }else if(['clearWet','extinguish'].includes(pose.phase)){
    effect.effects.push('water-drops');
    for(let i=0;i<2;i++){const u=(pose.beat+i*.5)%1;line({x:hand.x+sign*u*7,y:hand.y+u*9},{x:hand.x+sign*u*7+1,y:hand.y+u*9+2},0xa7cbcb,(1-u)*.6,1);}
   }
  }
  for(const key of throws.keys())if(!used.has(key))throws.delete(key);
 }
 return {render,snapshot:()=>snapshot,destroy(){ground.destroy();fx.destroy();throws.clear();}};
}
