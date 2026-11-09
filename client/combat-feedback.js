import {createPhaseCreatureFeedback} from './phase-creature-feedback.js';
import {leapFrame} from '../src/creature-leap.js';
import {PHASE_CREATURE_RULES as PHASE} from '../src/phase-creatures.js';
import {formatDurability,formatDurabilityText} from '../src/format.js';
import {drawBossFeedback} from './boss-feedback.js';
import {bossStatus} from '../src/bosses.js';
import { ZONES,ENEMIES,ENEMY_WINDUP } from '../src/content.js';
import { yardFires,campfireActive,CAMPFIRE_HEAT } from '../src/campfire.js';
import { quencherMouth,createSprayArc,sprayFrame,sprayPoint } from './quencher-spray.js';
import { defenseLayout } from './defense-art.js';
import {enemyImpactFrame,ENEMY_IMPACT_LIFE} from './enemy-impact.js';
import {burrowFrame} from '../src/burrow.js';
import {BURROW_LABELS,drawBurrow} from './burrow-animation.js';
import {inner} from '../src/battle.js';
import {COMBAT} from '../src/balance.js';

const MAJOR=new Set(['heavy','interrupt-order','robot-dispatch','robot-disabled','robot-repair','leap-ready','leap-cancel','shell-break','armor-hit','spores','death','weakpoint','boss-impact','boss-warn','boss-break','boss-mound','boss-hatch','boss-siphon','boss-burst','boss-split','boss-down','boss-revive','boss-defeat','destroyed','trap','impact','blocked','wet','fire','clearWet','repair','breach','vault','dig','call','throw','compact','bait','bell','fear']);
const COLORS={'leap-ready':0xc4cf8b,'leap-cancel':0xe6c29b,'shell-break':0xf2c372,'armor-hit':0xe3bb80,spores:0xc6b1e5,death:0xf28a80,weakpoint:0xf0c58b,destroyed:0xf08c70,fear:0xe7b4cf,trap:0xf1d18b,impact:0xef9b72,blocked:0xa9d4bc,spikes:0xe6bc83,wet:0x8ed8e0,clearWet:0x9de6d9,fire:0xffcc75,repair:0xbde1a0,'robot-repair':0xbde1a0,breach:0xf18d76,call:0xd6a2e8,throw:0xffe0a3,bait:0xc7db92,compact:0xd8c49e,hit:0xe6b38c,attack:0xf0d7b0,warning:0xe5d095,bell:0xf1db96,vault:0xefb77d,dig:0xd9bc91};
const lifetime=e=>e.type==='enemy-hit'?ENEMY_IMPACT_LIFE:MAJOR.has(e.type)?3.2:e.type==='spikes'?1.4:1;
export function activeFeedback(b,t=b?.elapsed||0){return (b?.events||[]).filter(e=>t>=e.time-.001&&t-e.time<=lifetime(e));}
export function sporeVictimFeedback(events,t){
 const hits=new Map();
 for(const e of events){
  const age=t-e.time;if(e.type!=='spores'||age<0||age>=1.8)continue;
  for(const target of e.targets||[]){
   let hit=hits.get(target.id);if(!hit){hit={id:target.id,x:target.x,y:target.y,age,staminaLoss:0,fearGain:0,known:true};hits.set(target.id,hit);}
   hit.age=Math.min(hit.age,age);hit.known&&=Number.isFinite(target.staminaLoss)&&Number.isFinite(target.fearGain);
   hit.staminaLoss+=target.staminaLoss||0;hit.fearGain+=target.fearGain||0;
  }
 }
 return [...hits.values()].map(hit=>({...hit,text:hit.known?`体力 −${formatDurability(hit.staminaLoss)}\n恐惧 +${formatDurability(hit.fearGain)}`:'孢雾命中'}));
}
export function enemyFeedback(b,e){
 const z=b.zones.find(z=>z.id===e.zone),heat=campfireActive(b),result={label:'接近防线',progress:0,color:0xe7d9b5,heat,restrained:false};
 if(e.bossDormant)return {...result,label:'倒地 · 等待另一体',color:0xd3c7ed};
 if(e.boss){const boss=bossStatus(b);if(boss&&e.mode==='attack')return {...result,label:boss.label,progress:boss.progress,color:boss.phase==='exposed'?0xffd182:0xd0b2db};}
 if(e.stun>0){const trap=[...b.events].reverse().find(v=>v.type==='trap'&&v.enemyId===e.id&&b.elapsed-v.time<v.stun+.1);return {...result,label:trap?'陷阱绊住':'眩晕',color:0xf1d18b,restrained:!!trap};}
 if(e.mode==='inside'&&e.type==='sporetoad')return {...result,label:'院内蓄雾 · 体力威胁',progress:e.progress/PHASE.spores,color:0xc6b1e5};
 if(e.mode==='inside')return {...result,label:e.attackTarget?.kind==='person'?`攻击${e.attackTarget.name}`:e.targetName?`破坏${e.targetName}`:'已入院',color:0xef967b};
 if(e.mode==='retreat')return {...result,label:'撤离'};
 if(e.type==='skitter'&&e.mode==='approach')return {...result,label:e.huntPath?.length?'沿墙绕行 · 寻找薄弱处':`突袭${ZONES.find(z=>z.id===e.zone).name}`,color:0xf0c58b};
 if(e.mode!=='attack')return result;
 if(e.type==='bladebeast'){const leap=leapFrame(e);return {...result,label:leap?({crouch:'压身蓄力',airborne:'腾空越栏',land:'落地收足'}[leap.phase]):z.mesh?'埋网拖慢蓄跳':'蓄跳越栏',progress:e.progress/PHASE.leap,color:0xc8d593};}
 if(e.type==='shellcrab')return {...result,label:e.shellExposedUntil>b.elapsed?'甲缝暴露 · 夹击奏效':'厚甲 · 分开夹击或投掷',color:0xe3bb80};
 if(e.type==='sporetoad')return {...result,label:'蓄势孢雾 · 体力威胁',progress:e.progress/PHASE.spores,color:0xc6b1e5};
 if(e.type==='echomantis')return {...result,label:e.echoShifted?'已转场 · 追击':'半血转场',progress:e.attack/ENEMIES.echomantis.interval,color:0x9bd5ca};
 if(e.type==='skitter')return {...result,label:z.hp<=0?'破口突入':'啃咬薄弱防线',progress:e.attack/ENEMIES.skitter.interval,color:0xf0c58b};
 if(e.type==='climber')return {...result,label:z.spikes?'翻刺挡攀':'正在攀爬',progress:z.spikes?0:e.progress/ENEMY_WINDUP.climb,color:z.spikes?0xa9d4bc:0xeec77c};
 if(e.type==='burrower'){const frame=burrowFrame(e);return {...result,label:z.mesh?'埋网挡掘':frame?BURROW_LABELS[frame.phase]:z.compacted?'压实地面 · 慢掘':'正在浅掘',progress:z.mesh?0:e.progress/ENEMY_WINDUP.dig,color:z.mesh?0xa9d4bc:0xd9bc91};}
 if(e.type==='rammer')return {...result,label:'蓄势重撞',progress:e.attack/ENEMIES.rammer.interval,color:0xef9b72};
 if(e.type==='caller')return {...result,label:e.called?'已召援':'蓄势啼叫',progress:e.called?0:e.progress/ENEMY_WINDUP.call,color:0xd6a2e8};
 if(e.type==='quencher')return {...result,label:'蓄势喷污',progress:e.progress/ENEMY_WINDUP.spray,color:0x8ed8e0};
 return {...result,label:'抓挠围栏',progress:e.attack/ENEMIES[e.type].interval};
}

export function combatCaption(b,zoneId){
 const z=b.zones.find(z=>z.id===zoneId),name=ZONES.find(z=>z.id===zoneId).name;
 const features=[`陷阱×${z.traps}`,z.spikes&&'翻刺',z.mesh&&'埋网',z.bell&&'铃绳',z.compacted&&'已压实'].filter(Boolean);

 const recent=[...b.events].reverse().find(e=>(MAJOR.has(e.type)||(e.type==='hit'&&(e.prevented>0||e.targetName)))&&b.elapsed-e.time<=10);
 const eventName=recent?.targetName|| (recent?.zone?ZONES.find(z=>z.id===recent.zone)?.name:recent?.targetId==='central'?'中央篝火':'');
 return {status:`${name} · ${features.join(' · ')}`,message:recent?`${eventName?eventName+'：':''}${formatDurabilityText(recent.text)}${recent.type==='trap'&&Number.isInteger(recent.remaining)?` · 剩余${recent.remaining}`:''}`:'先选成员，再点生物指定重击；点空地移动。未选人时，点蓄力生物自动派遣。'};
}

// Canvas-only presentation: all lifetimes follow game time, so pausing freezes feedback.
export function createCombatFeedback(scene,toArt,resolution,cssScale=()=>1){
 const soil=scene.add.graphics().setDepth(0),bossGround=scene.add.graphics().setDepth(609),ground=scene.add.graphics().setDepth(640),fx=scene.add.graphics().setDepth(790),labels=new Map();
 const baitAreas=new Map(ZONES.map(zone=>{
  const center=inner(zone),range=COMBAT.bait.range;
  // Project the world-space circle point by point because map perspective varies with depth.
  const points=Array.from({length:120},(_,i)=>{
   const angle=i*Math.PI/60;
   return toArt({x:center.x+range*Math.cos(angle),y:center.y+range*Math.sin(angle)});
  });
  return [zone.id,{center,range,points}];
 }));
 const reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 const sprays=new Map(),phaseFeedback=createPhaseCreatureFeedback(scene,toArt,reduced);let battleId=null;
 let snapshot={defenses:[],fires:[],effects:[],enemies:[]};
 const poly=(g,points,fill,alpha=1)=>{g.fillStyle(fill,alpha);g.beginPath();g.moveTo(points[0].x,points[0].y);for(const p of points.slice(1))g.lineTo(p.x,p.y);g.closePath();g.fillPath();};
 function text(key,value,x,y,color,used,size=12){used.add(key);let label=labels.get(key);const fontSize=`${size}px`;if(!label){label=scene.add.text(x,y,value,{fontFamily:'PingFang SC, sans-serif',fontSize,resolution:resolution(),color:'#fff1cd',backgroundColor:'#202a2de8',padding:{x:5,y:3},align:'center'}).setOrigin(.5,1).setDepth(820);labels.set(key,label);}if(label.style.resolution!==resolution())label.setResolution(resolution());if(label.style.fontSize!==fontSize)label.setFontSize(fontSize);label.setText(value);const safeX=Math.max(label.width/2+7,Math.min(480-label.width/2-7,x));label.setPosition(safeX,y);const cssColor='#'+color.toString(16).padStart(6,'0');if(label.style.color!==cssColor)label.setColor(cssColor);return label;}
 const statusSize=()=>Math.max(13,Math.min(32,Math.ceil(10/cssScale())));
 function cross(g,p,r,color,alpha=1){g.lineStyle(2,color,alpha);g.lineBetween(p.x-r,p.y-r,p.x+r,p.y+r);g.lineBetween(p.x+r,p.y-r,p.x-r,p.y+r);}
 function ring(g,p,width,height,color,alpha=1){g.lineStyle(2,color,alpha);g.strokeEllipse(p.x,p.y,width,height);}
 function showBaitArea(zone){
  const area=baitAreas.get(zone),p=toArt(area.center);
  poly(soil,area.points,COLORS.bait,.13);
  ground.lineStyle(4,0x1a2524,.86);ground.strokePoints(area.points,true);
  ground.lineStyle(2.5,COLORS.bait,1);
  for(let i=0;i<area.points.length;i+=3)ground.strokePoints(area.points.slice(i,i+2),false);
  ring(ground,p,22,12,COLORS.bait);
  ground.fillStyle(COLORS.bait);ground.fillCircle(p.x,p.y,2.5);
  return area;
 }
 function showLures(b,used){
  // Lures in the same zone share the exact placement point.
  const active=new Map();
  for(const lure of b.lures||[]){
   if(lure.until<=b.elapsed)continue;
   const last=active.get(lure.zone);
   if(!last||last.until<lure.until)active.set(lure.zone,lure);
  }
  return [...active.values()].map(lure=>{
   const p=toArt(lure),seconds=Math.ceil(lure.until-b.elapsed),scale=Math.max(1,.58/cssScale());
   ground.save().translateCanvas(p.x,p.y).scaleCanvas(scale,scale);
   ground.fillStyle(0x22291e,.9);ground.fillEllipse(0,2,29,12);
   ground.fillStyle(0xa3af73);ground.fillEllipse(0,-4,20,14);
   ground.fillRoundedRect(-4,-14,8,5,1);
   ground.lineStyle(2,0x434633);ground.lineBetween(-5,-9,5,-9);
   ground.lineStyle(1.5,0xe1ddb2);ground.lineBetween(-3,-6,-5,-2);
   ground.restore();
   const label=text('lure-'+lure.zone,`诱饵 · ${seconds}秒`,p.x,p.y-10*scale,COLORS.bait,used,statusSize());
   label.setX(p.x+(p.x>=330?-1:1)*(label.width/2+14*scale));
   return {zone:lure.zone,x:p.x,y:p.y,seconds};
  });
 }
 function showCompacted(zone,used){
  const center=inner(zone),dx=center.x-zone.x,dy=center.y-zone.y,length=Math.hypot(dx,dy);
  const along=(depth,side)=>toArt({x:zone.x+(dx*depth-dy*side)/length,y:zone.y+(dy*depth+dx*side)/length});
  const patch=[[6,-14],[21,-19],[36,-15],[42,-7],[40,12],[24,18],[7,12]].map(([d,s])=>along(d,s));
  poly(soil,patch,0x5c4934,.9);
  soil.lineStyle(1.4,0xbea17a,.8);soil.strokePoints(patch,true);
  for(const depth of [12,19,26,33]){
   const a=along(depth,-11),mid=along(depth+2,0),c=along(depth,12);
   soil.lineStyle(2.4,0x3a3027,.85);soil.strokePoints([a,mid,c],false);
   soil.lineStyle(1,0xd5b786,.9);soil.strokePoints([a,mid,c].map(p=>({x:p.x,y:p.y-1.4})),false);
  }
  const p=along(25,0),label=along(29,17);
  ground.lineStyle(1.3,COLORS.compact,.9);ground.lineBetween(p.x,p.y,label.x,label.y);
  text('compacted-'+zone.id,'已压实',label.x,label.y+16,COLORS.compact,used,statusSize());
 }
 function spray(e,age,fade,tokens,used){
  used.add(e.id);let arc=sprays.get(e.id);
  if(!arc){
   const target=toArt(e),source=toArt(e.source),sprite=tokens.get('e-'+e.enemyId)?.sprite;
   const mouth=sprite?quencherMouth(sprite):{x:source.x+(target.x>=source.x?14:-14),y:source.y-29};
   arc=createSprayArc(mouth,{x:target.x,y:target.y-8});sprays.set(e.id,arc);
  }
  const frame=sprayFrame(arc,age,reduced),{end}=arc;
  if(reduced){
   fx.lineStyle(1.5,0xadc58c,fade*.4);fx.beginPath();fx.moveTo(arc.start.x,arc.start.y);
   for(let i=1;i<=20;i++){const p=sprayPoint(arc,i/20);fx.lineTo(p.x,p.y);}fx.strokePath();
  }
  for(const drop of frame.drops){
   const radius=drop.index===0?3.8:Math.max(1.7,3.2-drop.index*.3),alpha=fade*(reduced?.65:1-drop.index*.09);
   fx.lineStyle(radius*2+2,0x40534b,alpha);fx.lineBetween(drop.tail.x,drop.tail.y,drop.x,drop.y);
   fx.fillStyle(0x40534b,alpha);fx.fillCircle(drop.x,drop.y,radius+1);
   fx.lineStyle(radius*2,0xa6bd77,alpha);fx.lineBetween(drop.tail.x,drop.tail.y,drop.x,drop.y);
   fx.fillStyle(0xb7ca86,alpha);fx.fillCircle(drop.x,drop.y,radius);
   fx.fillStyle(0xe4ebbb,alpha*.8);fx.fillCircle(drop.x-1,drop.y-1,radius*.36);
  }
  if(frame.impactAge>=0){
   const impact=reduced?0:frame.impactAge,splash=Math.max(0,1-impact/.7);
   ground.fillStyle(0x587656,fade*.36);ground.fillEllipse(end.x,end.y+8,35,13);
   if(splash>0){
    ring(fx,{x:end.x,y:end.y+5},22+impact*42,8+impact*15,0xb7ca86,splash*.8);
    for(let i=0;i<7;i++){
     const angle=i*Math.PI*2/7,speed=15+i%3*8,spread=reduced?.35:impact;
     const x=end.x+Math.cos(angle)*speed*spread,y=end.y+Math.sin(angle)*speed*spread*.4-Math.sin(Math.min(1,spread/.7)*Math.PI)*12;
     fx.fillStyle(i%2?0x9db875:0xd0db9b,splash*fade);fx.fillCircle(x,y,1.8+i%2*.7);
    }
   }
  }
  return {phase:frame.phase,progress:frame.progress,start:arc.start,control:arc.control,end:arc.end,duration:arc.duration,drops:frame.drops.map(({x,y})=>({x,y})),impactAge:frame.impactAge};
 }
 function zoneShape(z,p,t,used,battleState){
  if(z.traps>0)text('traps-'+z.id,`陷阱×${z.traps}`,p.x-18,p.y+39,0xf1d18b,used,11);
  if(z.bell&&battleState?.events.some(e=>e.type==='bell'&&e.zone===z.id&&t-e.time<3.2)){const pulse=(Math.sin(t*4)+1)/2;if(pulse>.4)ring(ground,{x:p.x+14,y:p.y-15},18+pulse*8,12+pulse*5,0xe7d49e,.35);}
 }
 function enemyHit(e,t,tokens){
  const frame=enemyImpactFrame(e,t,reduced);if(!frame)return null;
  const attacker=tokens.get('e-'+e.enemyId),victim=e.targetKind==='person'?tokens.get('p-'+e.targetId):null;
  const from=attacker?{x:attacker.x,y:attacker.y-24}:toArt(e.source),at=toArt(e);
  const to=victim?{x:victim.x,y:victim.y-(victim.wounded?13:27)}:{x:at.x,y:at.y-8};
  const length=Math.hypot(to.x-from.x,to.y-from.y)||1,dx=(to.x-from.x)/length,dy=(to.y-from.y)/length;
  const alpha=frame.alpha,color=e.targetKind==='person'?0xff8075:0xffd19b;
  if(attacker&&!attacker.burrowVisual&&!attacker.phaseVisual){attacker.sprite.x+=dx*frame.lunge;attacker.sprite.y+=dy*frame.lunge;attacker.sprite.angle+=dx*frame.lunge*.8;attacker.attackVisual={targetId:e.targetId,style:e.style,lunge:frame.lunge};}
  if(victim){victim.sprite.x+=dx*frame.recoil;victim.sprite.y+=dy*frame.recoil;victim.sprite.angle+=frame.recoil;if(frame.flash)victim.hitTint=0xff8278;victim.hurtVisual={enemyId:e.enemyId,flash:frame.flash,recoil:frame.recoil};ground.fillStyle(0xc54b40,alpha*.32);ground.fillEllipse(victim.x,victim.y-2,35,13);}
  // The short trail connects the attacking body to the victim. Different marks
  // make a heavy collision, a claw rake and a small bite readable at phone size.
  fx.lineStyle(e.heavy?4:2,0x392d2d,alpha*.8);fx.lineBetween(from.x+dx*12,from.y+dy*12,to.x,to.y);
  fx.lineStyle(e.heavy?2:1,color,alpha*.7);fx.lineBetween(from.x+dx*12,from.y+dy*12,to.x,to.y);
  if(e.style==='claw')for(let i=-1;i<=1;i++){
   const x=to.x+i*7;fx.lineStyle(4,0x39262a,alpha);fx.lineBetween(x-6,to.y+9,x+6,to.y-10);fx.lineStyle(2,color,alpha);fx.lineBetween(x-6,to.y+9,x+6,to.y-10);
  }else if(e.style==='bite'){
   for(const side of [-1,1]){const y=to.y+side*(5+frame.alpha*4);fx.lineStyle(3,0x39262a,alpha);fx.strokePoints([{x:to.x-10,y},{x:to.x-4,y:y-side*5},{x:to.x+2,y},{x:to.x+8,y:y-side*5}],false);fx.lineStyle(1.5,color,alpha);fx.strokePoints([{x:to.x-10,y},{x:to.x-4,y:y-side*5},{x:to.x+2,y},{x:to.x+8,y:y-side*5}],false);}
  }else{
   ring(fx,to,19+(1-alpha)*32,12+(1-alpha)*22,color,alpha);
   for(let i=0;i<8;i++){const a=i*Math.PI/4;fx.lineStyle(2.5,color,alpha);fx.lineBetween(to.x+Math.cos(a)*6,to.y+Math.sin(a)*5,to.x+Math.cos(a)*20,to.y+Math.sin(a)*16);}
  }
  if(e.targetKind!=='person')for(let i=0;i<7;i++){
   const spread=reduced?8:frame.age*42,a=i*2.4,x=to.x+Math.cos(a)*spread,y=to.y+Math.sin(a)*spread*.45-(reduced?0:Math.sin(Math.min(1,frame.age/.62)*Math.PI)*13);
   fx.fillStyle(i%2?0xf4d2a0:0xb89371,alpha);fx.fillRect(x,y,2+i%2*2,2);
  }
  return {visual:e.style==='slam'?'heavy-impact':e.style==='bite'?'bite-impact':'claw-impact',targetKind:e.targetKind,targetId:e.targetId,enemyId:e.enemyId,from,to,flash:frame.flash,lunge:frame.lunge,recoil:frame.recoil};
 }
 function render(b,campaign,t,tokens,chosen,context=null){
  phaseFeedback.begin(b);
  soil.clear();bossGround.clear();ground.clear();fx.clear();const used=new Set(),zones=b?.zones||campaign.zones;
  for(const obj of tokens.values()){obj.hitTint=null;obj.attackVisual=null;obj.hurtVisual=null;}
  if(b?.id!==battleId){sprays.clear();battleId=b?.id;}const usedSprays=new Set();
  snapshot={defenses:[],fires:[],effects:[],enemies:[],sporeHits:[]};snapshot.boss=drawBossFeedback(fx,b,tokens,toArt,t,reduced,text,used,bossGround);
  snapshot.baitPreview=b&&context?.baitPreview?{zone:chosen,...showBaitArea(chosen)}:null;
  for(const z of zones){const zone=ZONES.find(q=>q.id===z.id);zoneShape(z,toArt(zone),t,used,b);if(b&&z.compacted)showCompacted(zone,used);snapshot.defenses.push({id:z.id,traps:z.traps,spikes:z.spikes,mesh:z.mesh,bell:z.bell,compacted:!!z.compacted});}
  snapshot.lures=b?showLures(b,used):[];
  const fireStates=yardFires(campaign,b);
  for(const f of fireStates){const p=toArt(f);
   const active=f.heat>CAMPFIRE_HEAT.active&&f.wet<=0;

   if(f.wet>0){ground.fillStyle(0x66b8c8,.3);ground.fillEllipse(p.x,p.y+3,43,17);cross(fx,{x:p.x,y:p.y-12},7,0x9cdeeb,.9);}
   if(b)text('fire-'+f.id,f.wet>0?`湿污 ${Math.ceil(f.wet)}秒 · 火${Math.round(f.heat)}`:f.heat<=0?'未点燃':f.heat<=CAMPFIRE_HEAT.active?'火势不足 · 请拨火':`火势 ${Math.round(f.heat)}`,p.x,p.y+34,f.wet>0?0x9cdeeb:active?0xffd087:f.heat>0?0xe7ac86:0xb3bcb5,used,10);
   snapshot.fires.push({id:f.id,heat:f.heat,wet:f.wet,active,shade:!!f.shade});
  }
  if(b){for(const e of b.enemies){const state=enemyFeedback(b,e),obj=tokens.get('e-'+e.id);snapshot.enemies.push({id:e.id,...state});if(!obj)continue;obj.sprite.clearTint();snapshot.effects.push(...phaseFeedback.drawCreature(b,e,obj,t,ground,fx,context));
    if(obj.burrowVisual){const frame=obj.burrowVisual;drawBurrow(ground,fx,{x:obj.x,y:obj.y},frame,reduced);snapshot.effects.push({type:'burrow',enemyId:e.id,phase:frame.phase,progress:frame.progress,visible:frame.visible,x:obj.x,y:obj.y});}
    if(e.type==='rammer'&&e.mode==='attack'&&e.stun<=0&&!reduced)obj.sprite.setAngle(obj.lean+Math.sin(state.progress*Math.PI/2)*7);
    if(state.progress>0){const y=obj.phaseVisual?Math.max(14,obj.phaseVisual.top-15):obj.y-(e.type==='skitter'?49:69);fx.fillStyle(0x263034,.95);fx.fillRoundedRect(obj.x-21,y,42,5,2);fx.fillStyle(state.color,1);fx.fillRoundedRect(obj.x-21,y,42*Math.min(1,state.progress),5,2);}
    if(state.restrained){ring(fx,{x:obj.x,y:obj.y-8},40,25,0xeac887,.95);cross(fx,{x:obj.x,y:obj.y-8},12,0xeac887,.9);}
   }
   const visible=activeFeedback(b,t).filter(e=>e.type!=='interrupt-order'),priority={death:12,destroyed:11,trap:10,breach:9,wet:8,blocked:7,impact:6,'enemy-hit':6,fire:5,repair:5,spikes:2,attack:1},floatIds=new Set(),occupied=new Set();for(const e of [...visible].filter(e=>e.text&&(MAJOR.has(e.type)||e.type==='spikes'||e.type==='attack'||e.type==='hit'||e.type==='enemy-hit')).sort((a,c)=>(priority[c.type]||4)-(priority[a.type]||4)||c.id-a.id)){const key=e.enemyId||e.targetId||e.zone||`${Math.round(e.x/40)},${Math.round(e.y/40)}`;if(!occupied.has(key)&&floatIds.size<4){occupied.add(key);floatIds.add(e.id);}}
   const newestHits=new Map(visible.filter(e=>e.type==='enemy-hit').map(e=>[e.enemyId,e.id]));
   for(const e of visible){if(e.type==='enemy-hit'&&newestHits.get(e.enemyId)!==e.id)continue;const age=Math.max(0,t-e.time),life=lifetime(e),fade=Math.min(1,(life-age)/.65),p=toArt(e),color=COLORS[e.type]||0xe5d3aa;const major=MAJOR.has(e.type);snapshot.effects.push({id:e.id,type:e.type,defense:e.defense,text:e.text,age,x:p.x,y:p.y});
    const phaseEffect=phaseFeedback.drawEvent(b,e,t,tokens,ground,fx);
    if(phaseEffect){snapshot.effects.at(-1).visual=phaseEffect;}else if(e.type==='enemy-hit'){
     Object.assign(snapshot.effects.at(-1),enemyHit(e,t,tokens));
    }else if(e.type==='trap'){
     snapshot.effects.at(-1).visual='snare-tighten';const victim=b.enemies.find(q=>q.id===e.enemyId),obj=tokens.get('e-'+e.enemyId),held=victim?.stun>0;
     const foot=held&&obj?{x:obj.x,y:obj.y-5}:{x:p.x,y:p.y-6},tight=Math.min(age/.28,1),alpha=fade*(held||age<.35?1:Math.max(0,1-(age-.35)/.35));
     const width=58-tight*31,height=26-tight*11;
     ring(fx,foot,width,height,0x3d3021,alpha);fx.lineStyle(2.5,0xf7dda5,alpha);fx.strokeEllipse(foot.x,foot.y,width,height);
     fx.lineBetween(foot.x-width*.4,foot.y-5,foot.x+width*.38,foot.y+5);fx.lineBetween(foot.x+width*.4,foot.y-5,foot.x-width*.38,foot.y+5);
     if(e.source){const layout=defenseLayout(e.zone,toArt(e.source)),slot=((e.remaining||0)-1)*22,from={x:layout.traps.x+layout.along.x*slot,y:layout.traps.y+layout.along.y*slot};fx.lineStyle(4,0x3d3021,alpha);fx.lineBetween(from.x,from.y,foot.x,foot.y);fx.lineStyle(1.9,0xf5cf8c,alpha);fx.lineBetween(from.x,from.y,foot.x,foot.y);}
     if(age<.5)for(let i=0;i<6;i++){const angle=i*Math.PI/3,spread=age*32;fx.fillStyle(0xe8d0a1,(1-age*2)*.65);fx.fillCircle(foot.x+Math.cos(angle)*spread,foot.y+Math.sin(angle)*spread*.35,1.3);}
    }
    else if(e.type==='wet'&&e.source){snapshot.effects.at(-1).spray=spray(e,age,fade,tokens,usedSprays);}
    else if(e.type==='impact'||e.type==='breach'||e.type==='destroyed'){for(let i=0;i<7;i++){const a=i*Math.PI*2/7,r=12+Math.min(age,1)*20;fx.lineStyle(2.4,color,fade);fx.lineBetween(p.x+Math.cos(a)*9,p.y+Math.sin(a)*7,p.x+Math.cos(a)*r,p.y+Math.sin(a)*r*.65);}}
    else if(e.type==='spikes'||e.type==='throw'){if(e.type==='spikes')snapshot.effects.at(-1).visual='spike-scrape';for(let i=-1;i<=1;i++){fx.lineStyle(4,0x3b3024,fade);fx.lineBetween(p.x+i*9-5,p.y-12,p.x+i*9+5,p.y-29);fx.lineStyle(1.9,0xffe0a3,fade);fx.lineBetween(p.x+i*9-5,p.y-12,p.x+i*9+5,p.y-29);}}
    else if(e.type==='blocked'){
     if(e.defense==='mesh'){
      snapshot.effects.at(-1).visual='mesh-catch';const points=[{x:p.x-23,y:p.y-35},{x:p.x+20,y:p.y-31},{x:p.x+24,y:p.y-5},{x:p.x-20,y:p.y}];poly(fx,points,0x76b59b,fade*.26);
      fx.lineStyle(4,0x1f3930,fade);fx.strokePoints(points,true);fx.lineStyle(2,0xe2f5d7,fade);fx.strokePoints(points,true);
      for(let i=-2;i<=2;i++){fx.lineStyle(1.4,0xc2e3b9,fade);fx.lineBetween(p.x+i*8-4,p.y-33+i*.7,p.x+i*8,p.y-2+i*.7);fx.lineBetween(p.x-22,p.y-29+(i+2)*6,p.x+22,p.y-25+(i+2)*6);}
     }else{
      snapshot.effects.at(-1).visual='spike-block';for(let i=-2;i<=2;i++){const x=p.x+i*9;poly(fx,[{x:x-4,y:p.y-3},{x:x+4,y:p.y-3},{x,y:p.y-23}],0xffd28f,fade*.8);fx.lineStyle(1.3,0x4b3626,fade);fx.lineBetween(x-4,p.y-3,x,p.y-23);}
     }
    }
    else if(e.type==='bell'){
     snapshot.effects.at(-1).visual='bell-rings';const anchor=defenseLayout(e.zone,toArt(ZONES.find(z=>z.id===e.zone))).bell;
     for(const side of [-1,1])for(let i=0;i<3;i++){const radius=15+i*8+(reduced?0:age*7),angle=side>0?0:Math.PI;fx.lineStyle(2.1,0xffdf8a,fade*(1-i*.18));fx.beginPath();fx.arc(anchor.x,anchor.y-10,radius,angle-.65,angle+.65);fx.strokePath();}
    }
    else if(e.type==='dig'){if(age<.65)drawBurrow(ground,fx,p,{phase:'emerge',progress:.7+Math.min(1,age/.65)*.3},reduced,1-age/.65);}
    else if(e.type==='call'){for(let i=0;i<3;i++)ring(fx,{x:p.x,y:p.y-15},20+i*15+age*6,10+i*8,color,fade*(1-i*.2));}
    else{ring(fx,p,20+Math.min(age,1)*25,12+Math.min(age,1)*12,color,fade);}
    if(e.enemyId&&!reduced&&(e.type==='impact'||e.type==='trap'||e.type==='spikes')){const obj=tokens.get('e-'+e.enemyId);if(obj&&!obj.burrowVisual&&!obj.phaseVisual){obj.hitTint=color;if(age<.4)obj.sprite.setAngle(obj.lean+Math.sin(age*25)*3*Math.max(0,1-age/.4));}}
    if(floatIds.has(e.id)){const offset=reduced?0:Math.min(age*9,17);text('effect-'+e.id,formatDurabilityText(e.text),p.x,p.y-49-offset,color,used,major?15:12).setAlpha(fade);}
   }
  }
  snapshot.sporeHits=sporeVictimFeedback(b?.events||[],t);
  for(const hit of snapshot.sporeHits){const obj=tokens.get('p-'+hit.id),at=obj||toArt(hit),top=obj?.bodyBounds?.top??at.y-(obj?.wounded?45:75),offset=reduced?0:Math.min(hit.age*5,7);text('spore-victim-'+hit.id,hit.text,at.x,top-8-offset,0xe1c6f4,used,11).setAlpha(Math.min(1,(1.8-hit.age)/.45));}
  phaseFeedback.end();
  for(const id of sprays.keys())if(!usedSprays.has(id))sprays.delete(id);
  for(const [key,label] of labels)if(!used.has(key)){label.destroy();labels.delete(key);}
 }
 return {render,snapshot:()=>snapshot,destroy(){phaseFeedback.destroy();soil.destroy();bossGround.destroy();ground.destroy();fx.destroy();for(const label of labels.values())label.destroy();labels.clear();sprays.clear();}};
}
