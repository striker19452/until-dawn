import puppyUrl from './assets/puppy-v1.webp?url';
import registration from './assets/puppy-v1.json';
import puppyWalkUrl from './assets/puppy-walk-v2.webp?url';
import walkRegistration from './assets/puppy-walk-v2.json';
import {createDog,advanceDog,DOG_RULES} from '../src/dog.js';
import {spriteBodyBounds} from './boss-motion.js';

export {puppyUrl,puppyWalkUrl};
export function registerPuppy(scene){
 const texture=scene.textures.get('puppy');
 registration.frames.forEach((frame,i)=>texture.add(String(i),0,...frame.rect));
 const walking=scene.textures.get('puppy-walk');
 walkRegistration.frames.forEach((frame,i)=>walking.add(String(i),0,...frame.rect));
}
const labels={wander:'轻快小跑',sniff:'闻闻花草',wag:'摇着尾巴',tilt:'歪头看你',stretch:'伸个懒腰',roll:'翻肚皮打滚',nap:'呼噜…',greet:'想和你贴贴'};
function heart(g,x,y,size,alpha){
 const points=[];for(let i=0;i<28;i++){const a=i/28*Math.PI*2;points.push({x:x+Math.pow(Math.sin(a),3)*size,y:y-(13*Math.cos(a)-5*Math.cos(2*a)-2*Math.cos(3*a)-Math.cos(4*a))*size/16});}
 g.fillStyle(0xefb8a7,alpha);g.fillPoints(points,true);
}
export function createDogArt(scene,artPoint,reducedMotion){
 const sprite=scene.add.image(0,0,'puppy','4').setVisible(false),shadow=scene.add.ellipse(0,0,30,8,0x483522,.18).setVisible(false);
 const effects=scene.add.graphics().setDepth(699),label=scene.add.text(0,0,'',{fontFamily:'PingFang SC, sans-serif',fontSize:'10px',color:'#fff0d8',backgroundColor:'#504331df',padding:{x:5,y:3}}).setOrigin(.5,1).setDepth(700).setVisible(false);
 let dayDog=null,dayKey='',snapshot=null,obj={sprite,label},walkDistance=0,lastMode='';
 function update(campaign,battle,people,dt,walkMap){
  if(!campaign.flags.dog){dayDog=null;return;}
  const key=`${campaign.seed}:${campaign.day}:${campaign.flags.dog.adoptedDay}`;
  if(key!==dayKey||!dayDog){dayDog=createDog(campaign.seed+campaign.day*127,walkMap);dayKey=key;}
  if(!battle)advanceDog(dayDog,dt/1000,{people,walkMap});
 }
 function interactionAim(personId,battle){
  return !battle&&dayDog?.cuddling&&dayDog.personId===personId?artPoint(dayDog):null;
 }
 function render(campaign,battle,people,dt,t,walkMap,tokens,components,outlines){
  effects.clear();if(!campaign.flags.dog){sprite.setVisible(false);shadow.setVisible(false);label.setVisible(false);outlines.remove(obj);dayDog=null;snapshot=null;return;}
  const dog=battle?.dog||dayDog,point=artPoint(dog),clock=battle?t:dog.age,barking=!!battle&&battle.elapsed<dog.barkUntil,cuddling=!battle&&dog.cuddling;
  const mode=battle?`night:${battle.id}`:`day:${dayKey}`;
  if(mode!==lastMode){obj.x=point.x;obj.y=point.y;walkDistance=0;lastMode=mode;}
  const oldX=obj.x??point.x,oldY=obj.y??point.y,smoothing=battle&&!battle.paused?1-Math.exp(-dt/60):1;
  obj.x=oldX+(point.x-oldX)*smoothing;obj.y=oldY+(point.y-oldY)*smoothing;
  if(dog.moving&&(!battle||!battle.paused))walkDistance+=Math.hypot(obj.x-oldX,obj.y-oldY);
  const walking=dog.moving&&!barking,walkPhase=walkDistance/3.6,texture=walking?'puppy-walk':'puppy';
  let frame=barking?6:walking?Math.floor(walkPhase)%4:({wag:4,tilt:5,stretch:8+Math.floor(clock*.8)%2,roll:10,nap:12+Math.floor(clock*.5)%2,greet:cuddling?14+Math.floor(clock)%2:14,sniff:8,wander:4}[dog.action]??4);
  if(reducedMotion&&!barking)frame=dog.moving?1:({roll:10,nap:12,stretch:8,greet:14,tilt:5}[dog.action]??4);
  const meta=(walking?walkRegistration:registration).frames[frame],flip=dog.facing<0,animate=!reducedMotion;
  const bob=animate&&(walking||barking)?Math.abs(Math.sin(barking?clock*18:walkPhase*Math.PI/2))*(barking?1.8:.65):0;
  const angle=animate?(dog.action==='roll'&&!dog.moving?Math.sin(clock*5)*12:cuddling?Math.sin(clock*3)*3:dog.action==='wag'&&!dog.moving?Math.sin(clock*8)*2:0):0;
  const breath=animate&&!dog.moving?Math.sin(clock*(dog.action==='nap'?2:3))*.012:0;
  sprite.setVisible(true).setTexture(texture,String(frame)).setOrigin(flip?1-meta.origin[0]:meta.origin[0],meta.origin[1]).setFlipX(flip).setPosition(obj.x,obj.y-bob).setScale(meta.renderScale*(1+breath),meta.renderScale*(1-breath)).setAngle(angle).setDepth(obj.y+1).clearTint();
  obj.baseTint=battle?0xe9d8ba:null;
  shadow.setVisible(true).setPosition(obj.x,obj.y+1).setScale(dog.action==='roll'?1.15:1,dog.action==='nap'?1.1:1).setDepth(obj.y-.1);
  obj.bodyBounds=spriteBodyBounds(sprite,meta.bounds);outlines.show(obj,components.occlusionLayers(obj,obj.bodyBounds),false);
  const person=cuddling?tokens.get('p-'+dog.personId):null;
  if(person){
   if(animate)person.sprite.setAngle((dog.x<people.find(p=>p.id===dog.personId).x?-1:1)*(3+Math.sin(clock*3)*1.2));
   for(let i=0;i<2;i++){const phase=reducedMotion?.45:(clock*.55+i*.48)%1;heart(effects,(obj.x+person.x)/2+(i?6:-6),obj.y-28-phase*24,2.6+phase,Math.sin(phase*Math.PI)*.85);}
  }
  if(barking){
   const direction=dog.facing,phase=(clock*2)%1;effects.lineStyle(1.2,0xf4d99e,.9-phase*.65);
   for(let i=0;i<2;i++)effects.strokeEllipse(obj.x+direction*(22+i*7+phase*5),obj.y-18,4+i*2,8+i*5);
   if(dog.barkTarget){const target=artPoint(dog.barkTarget);effects.lineStyle(1,0xf4d99e,.6);effects.strokeEllipse(target.x,target.y,30,12);}
  }
  if(!barking&&!reducedMotion&&dog.action==='nap'&&!dog.moving){const phase=(clock*.3)%1;label.setText('z z').setPosition(obj.x+15,obj.y-20-phase*9).setAlpha(.8-phase*.5).setVisible(true);}
  else label.setText(barking?'汪！':cuddling?'摸摸小麦 ♡':'').setPosition(obj.x,obj.bodyBounds.top-5).setAlpha(.92).setVisible(barking||cuddling);
  snapshot={name:DOG_RULES.name,x:dog.x,y:dog.y,screenX:obj.x,screenY:obj.y,action:dog.action,label:labels[dog.action],frame,texture,walkDistance,moving:dog.moving,cuddling,personId:dog.personId,barking,clock,angle:sprite.angle,scaleY:sprite.scaleY,visible:sprite.visible};
 }
 return {update,interactionAim,render,snapshot:()=>snapshot,destroy(){sprite.destroy();shadow.destroy();effects.destroy();label.destroy();}};
}
