import {createPhaseCreatureRig} from './phase-creature-rig.js';
import {pickEnemy} from './enemy-input.js';
import {animateHuman} from './human-motion.js';
import {createHumanRig} from './human-rig.js';
import {createHumanFeedback} from './human-feedback.js';
import {animateRobot,createDayRobotPatrol,stepDayRobotPatrol} from './robot-motion.js';
import {createRobotRig} from './robot-rig.js';
import {createRobotFeedback} from './robot-feedback.js';
import robotUrl from './assets/robots-v1.png?url';
import robotRegistration from './assets/robots-v1.json';
import {ROBOT_TYPES} from '../src/robots.js';
import {leapFrame} from '../src/creature-leap.js';
import {animatePhaseCreature,cropPhaseBody} from './phase-creature-motion.js';
import {PHASE_ART} from './phase-creature-art.js';
import {animateBurrow,cropBurrow} from './burrow-animation.js';
import {burrowFrame} from '../src/burrow.js';
import {puppyUrl,puppyWalkUrl,registerPuppy,createDogArt} from './dog-art.js';
import {bossRenderPoint,animateBoss,spriteBodyBounds} from './boss-motion.js';
import {BOSS_ART} from './boss-art.js';
import {bossForDay,bossSpriteForm,bossFormName,BOSS_TWIN_FORMS} from '../src/boss-content.js';
import {fearStatus} from '../src/fear.js';
import {STRIKE_RANGE} from '../src/rules.js';
import Phaser from 'phaser';
import dayUrl from './assets/yard-ground-day-v5.webp?url';
import nightUrl from './assets/yard-ground-night-v5.webp?url';
import peopleAUrl from './assets/survivors-walk-a-v4.webp?url';
import peopleBUrl from './assets/survivors-walk-b-v4.webp?url';
import mengUrl from './assets/meng-walk-v5.webp?url';
import creatureAUrl from './assets/creatures-walk-a-v4.webp?url';
import creatureBUrl from './assets/creatures-walk-b-v4.webp?url';
import humanRegistration from './assets/survivors-walk-v4.json';
import mengRegistration from './assets/meng-walk-v5.json';
import {woundedUrl,woundedRegistration,woundedFrame} from './wounded-art.js';
import skitterUrl from './assets/skitter-walk-v1.webp?url';
import skitterRegistration from './assets/skitter-walk-v1.json';
import creatureRegistration from './assets/creatures-walk-v4.json';
import buildingUrl from './assets/buildings-v3.webp?url';
import {buildingStatesUrl} from './building-art.js';
import houseUrl from './assets/house-states-v5.webp?url';
import fenceUrl from './assets/fence-states-v5.webp?url';
import gateUrl from './assets/gate-states-v5.webp?url';
import campfireBaseUrl from './assets/campfire-base-v6.webp?url';
import campfireFlamesUrl from './assets/campfire-flames-v6.webp?url';
import { moveToward,nearestWalkablePoint } from '../src/movement.js';
import { createWalkMap,HOUSE_ANCHOR } from '../src/yard-geometry.js';
import {isIndoors} from '../src/shelter.js';
import {CENTRAL_FIRE} from '../src/campfire.js';
import { artPoint,worldPoint,pickPerson } from './scene-layout.js';
import { createSceneComponents, registerStructureFrames } from './scene-components.js';
import { createUnitOutlines } from './unit-outline.js';
import propUrl from './assets/props-v3.webp?url';
import defenseSpikeUrl from './assets/defense-spike-v7.webp?url';
import defenseMeshUrl from './assets/defense-mesh-v7.webp?url';
import defenseBellUrl from './assets/defense-bell-v7.webp?url';
import woodUrl from './assets/wood.wav?url';
import bellUrl from './assets/bell.wav?url';
import { ZONES, ENEMIES, weather } from '../src/content.js';
import { sceneMetrics, makeMotion, advanceMotion, createRenderBudget } from './presentation.js';
import { createCombatFeedback, enemyFeedback } from './combat-feedback.js';
import {creatureActionAim,facingToward,facingFlip} from './creature-facing.js';
const HUMAN_IDS=['hero','lin','zhou','chen','xu','yuan','meng','visitor'];
const ENEMY_IDS=Object.keys(ENEMIES);
const canPatrolByDay=robot=>robot.enabled&&robot.hp>0;
const WALK_SHEETS={'robots-rig':robotRegistration,'robots':robotRegistration,'creatures-phase-rig':PHASE_ART.registration,'creatures-phase':PHASE_ART.registration,'people-wounded':woundedRegistration,'creatures-skitter':skitterRegistration,...Object.fromEntries(Object.entries(BOSS_ART).map(([id,art])=>['boss-'+id,art.registration])),'human-rig-people-a':humanRegistration.sheets[0],'human-rig-people-b':humanRegistration.sheets[1],'human-rig-people-meng':mengRegistration,'people-a':humanRegistration.sheets[0],'people-b':humanRegistration.sheets[1],'people-meng':mengRegistration,'creatures-a':creatureRegistration.sheets[0],'creatures-b':creatureRegistration.sheets[1]};

function createYardFog(scene){
 const texture=scene.textures.createCanvas('yard-fog',128,64),ctx=texture.getContext();
 // A few overlapping soft lobes make one reusable, uneven bank of mist.
 for(const [x,y,rx,ry,opacity] of [[33,35,32,20,.48],[65,29,40,27,.8],[94,39,32,18,.45]]){
  ctx.save();ctx.translate(x,y);ctx.scale(rx,ry);
  const gradient=ctx.createRadialGradient(0,0,0,0,0,1);
  gradient.addColorStop(0,`rgba(207,219,215,${opacity})`);
  gradient.addColorStop(.5,`rgba(207,219,215,${opacity*.64})`);
  gradient.addColorStop(1,'rgba(207,219,215,0)');
  ctx.fillStyle=gradient;ctx.fillRect(-1,-1,2,2);ctx.restore();
 }
 texture.refresh();
 // Keep the mist over the painted ground and below sprites, labels and combat cues.
 const banks=[
  {x:133,y:78,width:242,height:114,opacity:.38,drift:12},
  {x:351,y:126,width:224,height:105,opacity:.31,drift:-10},
  {x:318,y:330,width:280,height:72,opacity:.15,drift:-8},
  {x:251,y:520,width:376,height:102,opacity:.33,drift:14},
 ].map(bank=>({...bank,image:scene.add.image(bank.x,bank.y,'yard-fog').setDisplaySize(bank.width,bank.height).setDepth(-1)}));
 return {render(visible,time,night){
  for(const {image,x,opacity,drift} of banks){
   image.setVisible(visible);
   if(visible)image.setX(x+Math.sin(time*.13)*drift).setAlpha(opacity*(night ? .8 : 1));
  }
 }};
}

export function createYard(parent,onZone,onRenderError=()=>{},{onPerson=()=>{},onMove=()=>{},onFire=()=>{},onEnemy=()=>{}}={}){
 let moveArmed=false,tappedEnemy=null,baitPreview=false,dayKey='',dayPeople=new Map(),walkMap=createWalkMap(),mapCampaign=null,mapBattle=null,mengReady=false,mengLoading=false,idleFireTimer=null;
 const reducedMotion=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 let robotRig=null,robotFeedback=null,humanRig=null,humanFeedback=null,phaseRig=null;
 let campaign=null,battle=null,chosen='gate',actor='hero',activeScene=null,ready=false,artReady=false,soundOn=false,lastSound=0,lastEvent=0,visualTime=0,metrics=null,maxBufferSize=16384,sceneDirty=true,draws=0,wakeQueued=false;
 const budget=createRenderBudget(window.devicePixelRatio||1);
 const indoors=p=>battle?isIndoors(battle,p):campaign?.phase==='ready'&&p.nightRole==='sleep';
 function invalidate(){sceneDirty=true;if(!activeScene||activeScene.game.loop.running||wakeQueued)return;wakeQueued=true;queueMicrotask(()=>{wakeQueued=false;activeScene?.game.loop.wake();});}
 const bossLoads=new Map();
 async function prepareBoss(scene){const boss=bossForDay(campaign?.day);if(!boss)return true;const key='boss-'+boss.id;if(scene.textures.exists(key))return true;if(!bossLoads.has(key)){bossLoads.set(key,new Promise(resolve=>{const done=()=>{scene.load.off('loaderror',failed);frames(scene,key,4,BOSS_ART[boss.id].registration.frames.length/4);invalidate();resolve(true);},failed=file=>{if(file.key!==key)return;scene.load.off('filecomplete-image-'+key,done);scene.load.off('loaderror',failed);bossLoads.delete(key);onRenderError('首领素材未能载入，请检查网络后重试。');resolve(false);};scene.load.once('filecomplete-image-'+key,done);scene.load.on('loaderror',failed);scene.load.image(key,BOSS_ART[boss.id].url);scene.load.start();}));}return bossLoads.get(key);}
 let tokens=new Map(),components=null,outlines=null,feedback=null,dogArt=null,audioReady=false,audioLoading=false,confirmSound=false,nightReady=false,nightPromise=null;
 const day=document.createElement('img'),night=document.createElement('img');for(const img of [day,night]){img.className='yard-art';img.alt='';img.draggable=false;parent.append(img);}day.src=dayUrl;day.fetchPriority='high';night.style.opacity='0';
 day.decode().then(()=>{artReady=true;parent.dataset.ready=String(ready);}).catch(()=>onRenderError('院子画面未能载入，请检查网络后刷新。'));
 async function prepareNight(){
  if(!nightPromise){night.src=nightUrl;nightPromise=night.decode().then(()=>{nightReady=true;invalidate();if(battle)parent.dataset.ready=String(ready&&artReady);return true;}).catch(()=>{nightPromise=null;onRenderError('夜间背景未能载入，请检查网络后重试入夜。');return false;});}
  if(!await nightPromise)return false;return activeScene?prepareBoss(activeScene):false;
 }
 function prepareMeng(scene){
  if(mengReady||mengLoading)return;mengLoading=true;scene.load.image('people-meng',mengUrl);
  scene.load.once('filecomplete-image-people-meng',()=>{frames(scene,'people-meng',2,2);mengReady=true;mengLoading=false;invalidate();});scene.load.start();
 }
 function audioDiagnostics(){return {enabled:soundOn,ready:audioReady,loading:audioLoading,context:activeScene?.sound.context?.state||'unavailable',muted:activeScene?.sound.mute??true};}
 function puppyBark(){const context=activeScene?.sound.context;if(!context||context.state!=='running')return;for(const delay of [0,.16]){const at=context.currentTime+delay,voice=context.createOscillator(),gain=context.createGain();voice.type='triangle';voice.frequency.setValueAtTime(540,at);voice.frequency.exponentialRampToValueAtTime(210,at+.095);gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.065,at+.01);gain.gain.exponentialRampToValueAtTime(.001,at+.11);voice.connect(gain);gain.connect(context.destination);voice.onended=()=>{voice.disconnect();gain.disconnect();};voice.start(at);voice.stop(at+.12);}}
 function prepareAudio(scene){
  if(audioReady||audioLoading)return;audioLoading=true;
  scene.load.audio('wood',[woodUrl]);scene.load.audio('bell',[bellUrl]);
  scene.load.once('complete',()=>{audioLoading=false;if(!['wood','bell'].every(key=>scene.cache.audio.exists(key)))return;audioReady=true;scene.sound.setMute(!soundOn);invalidate();});
  scene.load.start();
 }
 function fit(){if(!activeScene)return;invalidate();const rect=parent.getBoundingClientRect();metrics=sceneMetrics(rect.width,rect.height,budget.ratio,maxBufferSize);const {width,height,bufferWidth,bufferHeight,cameraZoom,cssScale,centerY,textResolution}=metrics;activeScene.scale.resize(bufferWidth,bufferHeight);activeScene.cameras.main.setZoom(cameraZoom).centerOn(240,centerY);for(const img of [day,night]){img.style.width=`${480*cssScale}px`;img.style.height=`${600*cssScale}px`;img.style.left=`${width/2-240*cssScale}px`;img.style.top=`${height/2-centerY*cssScale}px`;}for(const obj of tokens.values())obj.label.setResolution(textResolution);activeScene.houseRest?.setResolution(textResolution);parent.style.setProperty('--house-hud-x',`${width/2+(HOUSE_ANCHOR.x-240)*cssScale}px`);parent.style.setProperty('--house-hud-y',`${height/2+(HOUSE_ANCHOR.y-HOUSE_ANCHOR.size*.4-centerY)*cssScale}px`);const canvas=activeScene.game.canvas;canvas.dataset.zoom=String(cameraZoom);canvas.dataset.centerY=String(centerY);canvas.dataset.logicalHeight=String(metrics.logicalHeight);canvas.dataset.pixelRatio=String(metrics.pixelRatio);}
 function frames(scene,key,columns,rows){const texture=scene.textures.get(key),source=texture.getSourceImage();for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){const index=row*columns+col,registered=WALK_SHEETS[key]?.frames[index]?.rect;if(registered){texture.add(String(index),0,...registered);continue;}const x=Math.round(col*source.width/columns),y=Math.round(row*source.height/rows),right=Math.round((col+1)*source.width/columns),bottom=Math.round((row+1)*source.height/rows);texture.add(String(index),0,x,y,right-x,bottom-y);}}
 function removeUnused(map,used){for(const[key,obj]of map)if(!used.has(key)){phaseRig?.remove(obj);humanRig?.remove(obj);robotRig?.remove(obj);obj.sprite?.destroy();outlines?.remove(obj);obj.label?.destroy();if(obj.destroy)obj.destroy();map.delete(key);}}
 function token(scene,key,texture,row,point,size,label,working,time,delta,paused,woundedPerson=null,facePoint=null){
  let obj=tokens.get(key);
  if(!obj){obj={isCreature:key.startsWith('e-'),sprite:scene.add.image(point.x,point.y,texture,String(row*4+1)),label:scene.add.text(point.x,point.y,label,{fontFamily:'PingFang SC, sans-serif',fontSize:key.startsWith('e-')?'11px':'10px',align:'center',resolution:metrics?.textResolution||1,color:'#f5e8c5',backgroundColor:'#30291ddd',padding:{x:4,y:2}}).setOrigin(.5,0),...makeMotion(point)};tokens.set(key,obj);}
  advanceMotion(obj,point,delta,paused,key.startsWith('p-')?7:6);
  obj.facing=facingToward(obj,facePoint,obj.facing);
  if(woundedPerson&&!obj.wounded)obj.woundedSince=time;
  obj.wounded=!!woundedPerson;
  const crawling=obj.wounded&&obj.moving&&time-obj.woundedSince>.35;
  if(obj.wounded)texture='people-wounded';
  const sheet=WALK_SHEETS[texture];obj.baseFacing=sheet.baseFacing;const index=obj.wounded?woundedFrame(woundedPerson,crawling):row*4+obj.frame,meta=sheet.frames[index],origin=meta.origin,flip=facingFlip(sheet.baseFacing,obj.facing);
  const pulse=obj.wounded?1:working&&!obj.moving?1+Math.sin(time*4)*.012:1,scale=meta.renderScale||(sheet.displaySize||size)/(sheet.cellSize||creatureRegistration.frameWidth);
  const bob=obj.wounded?(crawling&&!reducedMotion?Math.sin(time*8)*.35:0):obj.bob,lean=obj.wounded?(crawling&&!reducedMotion?Math.sin(time*8)*1.1:0):obj.lean;
  obj.pose=obj.wounded?(crawling?'crawl':'seated'):(obj.moving?'walking':'standing');
  obj.burrowVisual=null;obj.phaseVisual=null;obj.ignoreFenceOcclusion=false;delete obj.phaseBodyCrop;delete obj.burrowCrop;obj.sprite.setCrop();
  obj.sprite.setTexture(texture,String(index)).setOrigin(flip?1-origin[0]:origin[0],origin[1]).setPosition(obj.x,obj.y+bob).setScale(scale*pulse).setFlipX(flip).setAngle(lean).setAlpha(1).setDepth(obj.y+1);
  obj.label.setText(label).setPosition(obj.x,obj.y+5).setDepth(700).setAlpha(.9).setBackgroundColor(obj.wounded?'#511f1fe8':'#30291ddd');
  return obj;
 }
 class Yard extends Phaser.Scene{
  preload(){this.load.image('robots',robotUrl);this.load.image('creatures-phase',PHASE_ART.url);this.load.image('puppy',puppyUrl);this.load.image('puppy-walk',puppyWalkUrl);this.load.image('people-wounded',woundedUrl);this.load.image('building-states',buildingStatesUrl);this.load.image('people-a',peopleAUrl);this.load.image('people-b',peopleBUrl);if(campaign?.people.some(p=>p.id==='meng'))this.load.image('people-meng',mengUrl);this.load.image('creatures-skitter',skitterUrl);this.load.image('creatures-a',creatureAUrl);this.load.image('creatures-b',creatureBUrl);this.load.image('buildings',buildingUrl);this.load.image('house',houseUrl);this.load.image('gate',gateUrl);this.load.image('fence',fenceUrl);this.load.image('props',propUrl);this.load.image('defense-spike',defenseSpikeUrl);this.load.image('defense-mesh',defenseMeshUrl);this.load.image('defense-bell',defenseBellUrl);this.load.image('campfire-base',campfireBaseUrl);this.load.image('campfire-flames',campfireFlamesUrl);this.load.on('loaderror',()=>onRenderError('有场景素材未能载入，请检查网络后刷新。'));}
  create(){activeScene=this;if(['robots','creatures-phase','puppy','puppy-walk','people-a','people-b','people-wounded','creatures-skitter','creatures-a','creatures-b','buildings','building-states','house','gate','fence','props','defense-spike','defense-mesh','defense-bell','campfire-base','campfire-flames'].some(key=>!this.textures.exists(key))){onRenderError('美术素材加载失败，已停止开战。请检查网络后刷新。');return;}frames(this,'robots',4,3);frames(this,'creatures-phase',4,4);registerPuppy(this);frames(this,'people-wounded',4,4);frames(this,'people-a',4,4);frames(this,'people-b',4,4);mengReady=this.textures.exists('people-meng');if(mengReady)frames(this,'people-meng',2,2);frames(this,'creatures-skitter',4,1);frames(this,'creatures-a',4,3);frames(this,'creatures-b',4,3);registerStructureFrames(this);frames(this,'props',2,2);prepareBoss(this);components=createSceneComponents(this);this.houseRest=this.add.text(240,280,'',{fontFamily:'PingFang SC, sans-serif',fontSize:'11px',color:'#f5e8c5',backgroundColor:'#30291ddd',padding:{x:5,y:3}}).setOrigin(.5,1).setDepth(700);outlines=createUnitOutlines(this);phaseRig=createPhaseCreatureRig(this,PHASE_ART.registration,outlines);humanRig=createHumanRig(this,outlines);humanFeedback=createHumanFeedback(this,reducedMotion);robotRig=createRobotRig(this,robotRegistration,outlines);robotFeedback=createRobotFeedback(this,artPoint,robotRegistration,reducedMotion);dogArt=createDogArt(this,artPoint,reducedMotion);this.g=this.add.graphics().setDepth(650);feedback=createCombatFeedback(this,artPoint,()=>metrics?.textResolution||1,()=>metrics?.cssScale||1);this.sound.setMute(true);if(soundOn)prepareAudio(this);const canvas=this.game.canvas;maxBufferSize=this.game.renderer.gl.getParameter(this.game.renderer.gl.MAX_RENDERBUFFER_SIZE);Object.defineProperty(canvas,'getYardDiagnostics',{value:()=>({draws,dog:dogArt?.snapshot(),qualityRatio:budget.ratio,audio:audioDiagnostics(),metrics:metrics&&{...metrics},camera:{zoom:this.cameras.main.zoom,width:this.cameras.main.width,height:this.cameras.main.height,scrollX:this.cameras.main.scrollX,scrollY:this.cameras.main.scrollY,bufferWidth:canvas.width,bufferHeight:canvas.height,cssWidth:canvas.getBoundingClientRect().width,cssHeight:canvas.getBoundingClientRect().height},paused:battle?.paused??false,clickedEnemy:tappedEnemy,movement:{armed:moveArmed,actor,walkMap,target:battle?.people.find(p=>p.id===actor)?.task?.type==='move'?battle.people.find(p=>p.id===actor).task.target:!battle?dayPeople.get(actor)?.target||null:null},feedback:feedback?.snapshot(),robots:robotFeedback?.snapshot(),humans:humanFeedback?.snapshot(),components:components?.snapshot(),outlineTextures:outlines?.size,shelter:{people:(battle?.people||campaign?.people||[]).filter(p=>!p.dead&&indoors(p)).map(p=>p.id),label:this.houseRest.text},tokens:[...tokens].map(([id,o])=>({id,x:o.x,y:o.y,pose:o.pose,wounded:!!o.wounded,label:o.label.text,frame:o.sprite.frame.name,texture:o.sprite.texture.key,alpha:o.sprite.alpha,visible:o.sprite.visible,selected:!!o.selected,highlighted:!!o.selected&&!!(o.outline?.visible||o.selectionOutline?.visible),bossVisual:o.bossVisual,phaseVisual:o.phaseVisual,phaseRig:phaseRig?.snapshot(o),robotVisual:o.robotVisual,humanVisual:o.humanVisual,humanHand:o.humanArmActive?o.humanHand:null,humanWrist:o.humanArmActive?{x:o.humanWrist.sprite.x,y:o.humanWrist.sprite.y,angle:o.humanWrist.sprite.angle,visible:o.humanWrist.sprite.visible,occluded:!!o.humanWrist.occluded}:null,humanArm:o.humanArmActive?{angle:o.humanArm.sprite.angle,visible:o.humanArm.sprite.visible,occluded:!!o.humanArm.occluded}:null,phaseBodyCrop:o.phaseBodyCrop,burrowVisual:o.burrowVisual,burrowCrop:o.burrowCrop,attackVisual:o.attackVisual,facing:o.facing,baseFacing:o.baseFacing,actionAim:o.actionAim,hurtVisual:o.hurtVisual,hitTint:o.hitTint,angle:o.sprite.angle,spriteX:o.sprite.x,spriteY:o.sprite.y,scaleX:o.sprite.scaleX,scaleY:o.sprite.scaleY,occlusion:outlines?.inspect(o),occluded:!!o.occluded,occluders:o.occluders||[],outlineVisible:!!o.outline?.visible,outlineFrame:o.outline?.texture.key,bodyBounds:o.bodyBounds,moving:o.moving,flipX:o.sprite.flipX,bob:o.bob,lean:o.lean}))})});canvas.addEventListener('webglcontextlost',ev=>{ev.preventDefault();ready=false;onRenderError('画面暂时中断，夜战已暂停。恢复后再继续。');});canvas.addEventListener('webglcontextrestored',()=>{ready=true;fit();onRenderError('画面已恢复，确认后点击继续。');});this.input.on('pointerup',pointer=>{
   if(Math.hypot(pointer.x-pointer.downX,pointer.y-pointer.downY)>10*(metrics?.pixelRatio||1))return;
   const p=this.cameras.main.getWorldPoint(pointer.x,pointer.y);
   const zoneAtPoint=()=>{
    const z=ZONES.reduce((a,c)=>Math.hypot(artPoint(a).x-p.x,artPoint(a).y-p.y)<Math.hypot(artPoint(c).x-p.x,artPoint(c).y-p.y)?a:c);
    if(Math.hypot(artPoint(z).x-p.x,artPoint(z).y-p.y)<68)onZone(z.id);
   };
   if(baitPreview){zoneAtPoint();return;}
   const person=pickPerson(tokens,p,7/(metrics?.cssScale||1),moveArmed?actor:null);
   const enemy=pickEnemy(battle,tokens,p);if(enemy){onEnemy(enemy);return;}
   if(person){onPerson(person);return;}
   const nearbyEnemy=pickEnemy(battle,tokens,p,7/(metrics?.cssScale||1));if(nearbyEnemy){onEnemy(nearbyEnemy);return;}
   const robot=[...tokens.entries()].filter(([key])=>key.startsWith('r-')).find(([,o])=>p.x>=o.bodyBounds?.left&&p.x<=o.bodyBounds?.left+o.bodyBounds?.width&&p.y>=o.bodyBounds?.top&&p.y<=o.bodyBounds?.top+o.bodyBounds?.height);if(robot){onPerson(robot[0].slice(2));return;}
   const hearth=artPoint(CENTRAL_FIRE);
   if(battle&&Math.abs(p.x-hearth.x)<=36&&p.y>=hearth.y-60&&p.y<=hearth.y+20){onFire();return;}
   if(moveArmed){onMove(worldPoint(p));return;}
   zoneAtPoint();
  });ready=true;parent.dataset.ready=String(artReady);fit();}
  update(time,delta){
   if(!campaign||!this.g)return;
   const isNight=!!battle,paused=battle?.paused,robots=battle?.robots||campaign.robots||[];
   const patrolByDay=!isNight&&!document.hidden&&!reducedMotion&&(campaign.phase==='day'||campaign.phase==='ready');
   const dayPatrolActive=patrolByDay&&robots.some(canPatrolByDay);
   const staticScene=!isNight||paused;
   if(staticScene&&!sceneDirty&&!dayPatrolActive&&(!campaign.flags.dog||isNight)&&(paused||![...tokens.values()].some(o=>o.moving)&&![...dayPeople.values()].some(p=>p.target))){
    this.game.loop.sleep();
    if(!isNight&&!document.hidden&&!reducedMotion&&!idleFireTimer)idleFireTimer=setTimeout(()=>{idleFireTimer=null;invalidate();},150);
    return;
   }
   if(budget.observe(delta,(isNight&&!paused||!isNight&&!!campaign.flags.dog||dayPatrolActive)&&!document.hidden))fit();
   sceneDirty=false;draws++;const dt=Math.min(50,delta);visualTime=isNight?(paused?battle.elapsed:Math.min(battle.elapsed+.12,visualTime+delta/1000)):time/1000;const t=visualTime,g=this.g;g.clear();day.style.opacity=isNight&&nightReady?'0':'1';night.style.opacity=isNight&&nightReady?'1':'0';
   components.render(campaign,battle,t);
   const zones=battle?.zones||campaign.zones;for(const z of zones){const p=artPoint(ZONES.find(a=>a.id===z.id)),selected=z.id===chosen;g.lineStyle(selected?2:1,selected?0xe6c683:0xb6a581,selected?.85:.3);g.strokeEllipse(p.x,p.y,selected?48:32,selected?21:13);}
   const persons=battle?.people||campaign.people.map((p,i)=>{
    if(!dayPeople.has(p.id))dayPeople.set(p.id,{x:215+i%3*27,y:350+Math.floor(i/3)*36,target:null});
    const pose=dayPeople.get(p.id);if(pose.target){moveToward(pose,pose.target,43,dt/1000,true,walkMap);if(Math.hypot(pose.x-pose.target.x,pose.y-pose.target.y)<.1)pose.target=null;}
    return {...p,x:pose.x,y:pose.y,task:null};
   }),used=new Set();dogArt.update(campaign,battle,persons.filter(p=>!p.dead&&!indoors(p)),dt,walkMap);for(const p of persons){
    if(p.dead||indoors(p))continue;
    const key='p-'+p.id;used.add(key);const point=artPoint(p),index=Math.max(0,HUMAN_IDS.indexOf(p.id)),severe=p.wound==='severe';
    const name=severe?`${p.name}\n重伤`:battle&&(fearStatus(p,battle).retreat||p.fear>70)?`${p.name}\n${fearStatus(p,battle).retreat?fearStatus(p,battle).label:p.task&&!p.task.automatic?'手动指令优先':'保守防守'}`:p.name;
    const fighting=battle&&!severe&&(!p.task&&p.nightRole!=='sleep'||p.task?.type==='guard'||p.task?.type==='move'&&p.task.stage==='work');
    const opponent=fighting?battle.enemies.filter(e=>e.hp>0&&e.mode!=='retreat'&&!e.bossDormant&&Math.hypot(e.x-p.x,e.y-p.y)<=STRIKE_RANGE&&(!p.task?.threatIds||p.task.threatIds.includes(e.id))).sort((a,c)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(c.x-p.x,c.y-p.y))[0]:null;
    const humanTexture=p.id==='meng'&&mengReady?'people-meng':index<4?'people-a':'people-b';
    const obj=token(this,key,humanTexture,p.id==='meng'&&mengReady?0:index%4,point,75,name,p.task||p.cooldown>1.2,t,dt,paused,severe?p.id:null,opponent?artPoint(opponent):dogArt.interactionAim(p.id,battle));
    animateHuman(obj,battle,p,t,WALK_SHEETS[humanTexture],reducedMotion);humanRig.apply(obj,humanTexture,WALK_SHEETS[humanTexture]);
    if(severe){g.lineStyle(1.4,0xe3a18e,.75);g.strokeEllipse(obj.x,obj.y,28,10);}
    if(p.task&&p.task.type!=='move'){const top=obj.bodyBounds?.top??obj.y-56;g.fillStyle(0x352d24,.65);g.fillRoundedRect(obj.x-13,top-7,26,4,2);g.fillStyle(0xe2c580,1);g.fillRoundedRect(obj.x-13,top-7,26*obj.humanVisual.workProgress,4,2);}
   }
   for(const [i,r]of robots.entries()){
    const key='r-'+r.id,previous=tokens.get(key);used.add(key);
    const patrol=isNight?null:previous?.dayPatrol??createDayRobotPatrol(i,walkMap);
    if(patrol&&patrolByDay&&canPatrolByDay(r))stepDayRobotPatrol(patrol,r.type,dt/1000,walkMap);
    const point=artPoint(patrol??r);
    const obj=token(this,key,'robots-rig',Object.keys(ROBOT_TYPES).indexOf(r.type),point,72,previous?.label.text??'',!!r.task,t,dt,paused,null);
    obj.dayPatrol=patrol;
    animateRobot(obj,battle,r,t,robotRegistration,reducedMotion);robotRig.apply(obj,r,obj.robotVisual,reducedMotion);
    const top=obj.y-(r.type==='defense'?59:55);g.fillStyle(0x282923,.8);g.fillRoundedRect(obj.x-14,top,28,3,1);g.fillStyle(r.hp>0?0xabcbb0:0xc18d76,1);g.fillRoundedRect(obj.x-14,top,28*r.hp/100,3,1);
    if(battle?.paused&&r.plan.route.length){g.lineStyle(1,0xa6c5bf,.38);let prev=point;for(const id of r.plan.route){const z=artPoint(ZONES.find(z=>z.id===id));g.lineBetween(prev.x,prev.y,z.x,z.y);prev=z;}}
   }
   const occupants=persons.filter(p=>!p.dead&&indoors(p));this.houseRest.setText(occupants.length?`屋内休息 · ${occupants.length}人`:'').setVisible(occupants.length>0);
   const selected=battle?.people.find(p=>p.id===actor),destination=battle?(selected?.task?.type==='move'?selected.task.target:null):dayPeople.get(actor)?.target;
   const heavyTarget=selected?.task?.type==='heavy'?battle.enemies.find(e=>e.id===selected.task.enemyId&&e.hp>0&&!e.bossDormant&&e.mode!=='retreat'):null;
   if(destination&&moveArmed){const point=artPoint(destination);g.lineStyle(2,0x9ce0c9,.95);g.strokeEllipse(point.x,point.y,24,11);g.lineBetween(point.x-5,point.y,point.x+5,point.y);g.lineBetween(point.x,point.y-4,point.x,point.y+4);}
   for(const e of battle?.enemies||[]){const key='e-'+e.id,isBossArt=!!BOSS_ART[e.type];if(isBossArt&&!this.textures.exists('boss-'+e.type))continue;used.add(key);const burrow=burrowFrame(e,battle.paused||e.stun>0?0:Math.max(0,Math.min(.1,t-battle.elapsed))),leap=leapFrame(e,battle.paused||e.stun>0?0:Math.max(0,Math.min(.1,t-battle.elapsed))),point=isBossArt?bossRenderPoint(e,artPoint,BOSS_ART[e.type].registration):artPoint(burrow?.point||leap?.point||e),size=isBossArt?156:e.type==='skitter'?56:e.type==='rammer'?104:82,index=ENEMY_IDS.indexOf(e.type),texture=isBossArt?'boss-'+e.type:PHASE_ART.ids.includes(e.type)?'creatures-phase':e.type==='skitter'?'creatures-skitter':index<3?'creatures-a':'creatures-b',row=isBossArt?bossSpriteForm(e):PHASE_ART.ids.includes(e.type)?PHASE_ART.ids.indexOf(e.type):e.type==='skitter'?0:index%3,actionAim=creatureActionAim(battle,e,t),obj=token(this,key,texture,row,point,size,`${bossFormName(e)||ENEMIES[e.type].name}\n${enemyFeedback(battle,e).label}`,e.mode==='attack',t,dt,paused,null,actionAim?artPoint(actionAim):null);obj.baseTint=e.type==='twinvein'&&e.bossForm>0?BOSS_TWIN_FORMS[e.bossForm-1].tint:null;obj.actionAim=actionAim;obj.actionFacing=actionAim?obj.facing:null;animateBurrow(obj,battle,e,t,WALK_SHEETS[texture].frames[Number(obj.sprite.frame.name)],reducedMotion);if(PHASE_ART.ids.includes(e.type)&&['left','right'].includes(e.zone)&&e.mode!=='inside'&&obj.sprite.displayWidth>84){const ratio=84/obj.sprite.displayWidth;obj.sprite.setScale(obj.sprite.scaleX*ratio,obj.sprite.scaleY*ratio);}if(PHASE_ART.ids.includes(e.type)){animatePhaseCreature(obj,battle,e,t,WALK_SHEETS[texture].frames[Number(obj.sprite.frame.name)],reducedMotion);phaseRig.apply(obj,e,reducedMotion);}if(e.type==='skitter'||PHASE_ART.ids.includes(e.type))obj.label.setX(Math.max(obj.label.width/2+4,Math.min(480-obj.label.width/2-4,obj.x)));if(e.bossBrood)obj.sprite.setScale(obj.sprite.scaleX*.45,obj.sprite.scaleY*.45);if(isBossArt){if(['left','right'].includes(e.zone)&&e.mode!=='inside'&&obj.sprite.displayWidth>120){const ratio=120/obj.sprite.displayWidth;obj.sprite.setScale(obj.sprite.scaleX*ratio,obj.sprite.scaleY*ratio);}if(e.zone==='gate'&&e.mode!=='inside'&&!e.bossBrood&&obj.sprite.displayHeight>104){const ratio=104/obj.sprite.displayHeight;obj.sprite.setScale(obj.sprite.scaleX*ratio,obj.sprite.scaleY*ratio);}animateBoss(obj,battle,e,t,reducedMotion);const v=obj.bossVisual,top=v.cy-v.height/2;obj.label.setText((bossFormName(e)||ENEMIES[e.type].name)+(e.mode==='inside'&&e.attackTarget?'\n'+enemyFeedback(battle,e).label:'')).setPosition(Math.max(v.width/3,Math.min(480-v.width/3,v.cx)),top<50?obj.y+7:top-31);}if(e.stun>0){g.lineStyle(1.2,0xd9d0a5,.8);g.strokeEllipse(obj.x,obj.y-size*.63,17,5);}const healthY=obj.phaseVisual?Math.max(8,obj.phaseVisual.top-7):isBossArt?obj.bossVisual.cy-obj.bossVisual.height/2-8:obj.y-size*.73;g.fillStyle(0x282923,.8);g.fillRoundedRect(obj.x-15,healthY,30,3,1);g.fillStyle(isBossArt?0xe5b579:0xba9e69,1);g.fillRoundedRect(obj.x-15,healthY,30*Math.max(0,e.hp/e.max),3,1);}
   dogArt.render(campaign,battle,persons.filter(p=>!p.dead&&!indoors(p)),dt,t,walkMap,tokens,components,outlines);
   removeUnused(tokens,used);feedback.render(battle,campaign,t,tokens,chosen,{outlines,components,baitPreview});
   for(const [id,obj] of tokens){
    const sprite=obj.sprite,frame=sprite.frame,bounds=WALK_SHEETS[sprite.texture.key].frames[Number(frame.name)].bounds;
    obj.bodyBounds=spriteBodyBounds(sprite,bounds);
    const layers=components.occlusionLayers({x:obj.x,y:obj.y},obj.bodyBounds).filter(layer=>!obj.ignoreFenceOcclusion||!['gate','fence','mesh','spikes','bell'].includes(layer.kind));outlines.show(obj,layers,(moveArmed||!!heavyTarget)&&id==='p-'+actor||!!heavyTarget&&id==='e-'+heavyTarget.id);if(id.startsWith('r-'))robotRig.occlude(obj,components);if(id.startsWith('p-'))humanRig.occlude(obj,components);if(obj.phaseVisual)phaseRig.occlude(obj,components);cropBurrow(obj);cropPhaseBody(obj);
    obj.label.setColor(obj.selected?'#fff0b3':obj.wounded?'#ffd4c5':'#f5e8c5');
   }
   if(heavyTarget){
    const from=tokens.get('p-'+actor),to=tokens.get('e-'+heavyTarget.id);
    if(from&&to){g.lineStyle(1,0xe6c683,.5);g.lineBetween(from.x,from.y,to.x,to.y);g.lineStyle(2,0xffdf91,.95);g.strokeEllipse(to.x,to.y,38,16);}
   }
   const clicked=tokens.get('e-'+tappedEnemy);
   if(clicked?.bodyBounds){
    const r=clicked.bodyBounds,left=r.left-3,right=r.left+r.width+3,top=r.top-3,bottom=r.top+r.height+3;
    g.lineStyle(2,0xfff1c9,1);
    for(const [x,y,sx,sy]of [[left,top,1,1],[right,top,-1,1],[left,bottom,1,-1],[right,bottom,-1,-1]]){
     g.lineBetween(x,y,x+sx*7,y);g.lineBetween(x,y,x,y+sy*7);
    }
   }
   humanFeedback.render(battle,t,tokens);
   robotFeedback.render(campaign,battle,t,tokens);
   if(confirmSound&&soundOn&&audioReady&&!this.sound.locked&&(!this.sound.context||this.sound.context.state==='running')){this.sound.play('bell',{volume:.55});confirmSound=false;lastSound=time;}for(const event of battle?.events||[]){if(event.id>lastEvent){lastEvent=event.id;if(soundOn&&audioReady&&time-lastSound>160){if(event.type==='dog-bark')puppyBark();else this.sound.play(event.type==='warning'||event.type==='bell'?'bell':'wood',{volume:event.type==='warning'||event.type==='bell'?.55:.45});lastSound=time;}}}
   const currentWeather=battle?.weather||weather(campaign.day,campaign.seed);
   if(currentWeather==='fog'&&!this.fog)this.fog=createYardFog(this);
   this.fog?.render(currentWeather==='fog',reducedMotion?0:t,isNight);
   if(currentWeather==='rain'){g.lineStyle(.8,0xd3d9dc,.2);for(let i=0;i<24;i++){const x=(i*83+t*13)%480,y=(i*131+t*150)%600;g.lineBetween(x,y,x-2,y+8);}}
  }
 }
 const game=new Phaser.Game({type:Phaser.WEBGL,parent,width:480,height:600,transparent:true,backgroundColor:'#00000000',antialias:true,antialiasGL:false,powerPreference:'high-performance',audio:{noAudio:false},loader:{imageLoadType:'HTMLImageElement'},scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},scene:Yard,render:{roundPixels:false},fps:{target:60,forceSetTimeOut:false}});
 const onVisibility=()=>{if(!document.hidden)invalidate();};document.addEventListener('visibilitychange',onVisibility);
 const observer=new ResizeObserver(fit);observer.observe(parent);window.addEventListener('resize',fit);
 return {get ready(){return ready&&artReady;},movePerson(id,target){const pose=dayPeople.get(id);if(battle||!pose||indoors(campaign.people.find(p=>p.id===id)))return false;const point=nearestWalkablePoint(target,walkMap,pose);if(!point)return false;pose.target=point;invalidate();return true;},prepareNight,audio(enabled){soundOn=enabled;confirmSound=enabled;if(activeScene){activeScene.sound.setMute(!enabled);if(enabled){prepareAudio(activeScene);activeScene.sound.context?.resume().then(invalidate).catch(()=>{});}}invalidate();},set(s,b,z,person='hero',armed=false,tap=null,preview=false){if(s!==campaign||b!==battle||z!==chosen||person!==actor||armed!==moveArmed||tap!==tappedEnemy||preview!==baitPreview)invalidate();moveArmed=armed;tappedEnemy=tap;baitPreview=preview;if(s!==mapCampaign||b?.id!==mapBattle){walkMap=b?.walkMap||createWalkMap(s,b);mapCampaign=s;mapBattle=b?.id;for(const pose of dayPeople.values())if(pose.target)pose.target=nearestWalkablePoint(pose.target,walkMap,pose);}if(dayKey!==`${s.seed}:${s.day}`){dayPeople.clear();dayKey=`${s.seed}:${s.day}`;}for(const id of dayPeople.keys())if(!s.people.some(p=>p.id===id&&!p.dead))dayPeople.delete(id);if(b&&!battle)for(const p of dayPeople.values())p.target=null;campaign=s;if(activeScene&&s.people.some(p=>p.id==='meng'))prepareMeng(activeScene);if(s.phase==='ready'||b)prepareNight();if(b?.id!==battle?.id){lastEvent=0;visualTime=b?.elapsed||0;removeUnused(tokens,new Set());}if(b&&Math.abs(visualTime-b.elapsed)>.25)visualTime=b.elapsed;battle=b;chosen=z;actor=person;},destroy(){clearTimeout(idleFireTimer);document.removeEventListener('visibilitychange',onVisibility);observer.disconnect();window.removeEventListener('resize',fit);phaseRig?.destroy();humanRig?.destroy();humanFeedback?.destroy();robotRig?.destroy();robotFeedback?.destroy();dogArt?.destroy();feedback?.destroy();components?.destroy();outlines?.destroy();game.destroy(true);day.remove();night.remove();}};
}
