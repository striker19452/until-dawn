import {weakestZone,rethinkSkitter,skitterDetour} from './skitter.js';
import {createBossState,registerBoss,bossDamage,bossCounter,stepBossEnemy,stepBossWorld,finishBossStep} from './bosses.js';
import { moveToward as move,nearestWalkablePoint } from './movement.js';
import {nightProgress} from './night-progress.js';
import {markDead} from './health.js';
import {formatDurability} from './format.js';
import {arrivalTime,NIGHT_PACING} from './night-pacing.js';
import {rescueBenefits} from './rescue.js';
import {intrusionStep} from './intrusion.js';
import {enemyPersonTarget} from './enemy-target.js';
import {enemyDamageProfile,enemyDamageFeedback} from './enemy-damage.js';
import {approachCombat} from './combat-spacing.js';
import {normalizeBuildingHealth} from './building-health.js';
import { createWalkMap,artPoint,worldPoint } from './yard-geometry.js';
import { CENTRAL_FIRE,campfireActive,campfireWood,campfireNeedsWood,campfireHeatDecay,CAMPFIRE_BURN_RATE,CAMPFIRE_MAX_WOOD,tendedHeat } from './campfire.js';
import { ZONES, ENEMIES, ENEMY_WINDUP, enemySpeed, dailyIntel, enemyTypes, weather } from './content.js';
import { requireRule, clamp, living } from './campaign.js';
import { branch, facility,watchtowerRange,maxStamina,needs,STRIKE_RANGE,STRIKE_STUN } from './rules.js';
import { planChallenge, resolveChallenge } from './challenges.js';
import { orderDuration } from './night-orders.js';
import { fatigueEffects } from './fatigue.js';
import {FEAR_GAIN,fearEffects,fearSituation,fearRetreat,mayFearRetreat,endFearRetreat,witnessInjury,FEAR_RETREAT_SECONDS,FEAR_CALM_RATE} from './fear.js';
import {destroyZoneDefenses} from './zone-defenses.js';
import { recordResourceFlow } from './resource-flow.js';
import {HOUSE_DOOR as HOME,isIndoors,enterHouse,leaveHouse,sleepEligible,interruptSleep} from './shelter.js';
import {ownThreats,needsAutoRepair,chooseDefenseAssist,assistShouldReturn,autoBudgetAvailable,occupiedBreak,warningDistance,patrolTarget} from './cooperation.js';
export const inner=z=>({x:z.x+(240-z.x)*.15,y:z.y+(350-z.y)*.15});
function rng(b){b.rng=(Math.imul(b.rng,1664525)+1013904223)>>>0;return b.rng/4294967296;}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function event(b,type,x,y,text='',detail={}){b.events.push({...detail,id:++b.eventSeq,time:b.elapsed,type,x,y,text});b.events=b.events.slice(-60);}
const amount=n=>Number(n.toFixed(2));
function interaction(b,e,key,type,text,detail={},interval=3){e.feedbackAt||={};if(b.elapsed-(e.feedbackAt[key]??-Infinity)<interval)return;e.feedbackAt[key]=b.elapsed;event(b,type,e.x,e.y,text,{zone:e.zone,enemyId:e.id,...detail});}
function triggerTrap(b,e,z,seconds,stopsCharge=false){const dealt=bossDamage(b,e,18,'trap');z.traps--;e.hp-=dealt;e.stun=seconds;bossCounter(b,'trap',z.id,bossHooks);event(b,'trap',e.x,e.y,`陷阱 −${amount(dealt)} · ${e.hp<=0?'击退':`眩晕${seconds}秒`}${stopsCharge?' · 撞击中断':''}`,{zone:z.id,enemyId:e.id,damage:amount(dealt),stun:seconds,remaining:z.traps,stopsCharge,defeated:e.hp<=0,source:{x:ZONES.find(q=>q.id===z.id).x,y:ZONES.find(q=>q.id===z.id).y}});}
function note(b,text){b.log.push(text);b.log=b.log.slice(-50);}
function alarm(b,text,key){if(b.warned.includes(key))return;b.warned.push(key);b.pauseReason=text;if(b.autoPause){b.paused=true;b.reason=text;}note(b,text);}
export function createBattle(base,id,{autoPause=true}={}){
 requireRule(base.phase==='ready','先完成白天准备再入夜。');const b={id,day:base.day,elapsed:0,paused:true,reason:'准备好了再开始。夜战结束后统一保存。',autoPause,finished:false,resources:structuredClone(base.resources),zones:structuredClone(base.zones),people:structuredClone(base.people),house:base.house,buildings:normalizeBuildingHealth({buildings:structuredClone(base.buildings)}).buildings,flags:{cookedDay:base.flags.cookedDay},exposure:base.exposure,weather:weather(base.day,base.seed),rng:(base.seed+base.day*991)>>>0,enemies:[],schedule:[],fires:[],events:[],eventSeq:0,log:[],breaches:0,work:{},warned:[],seen:[...(base.flags.seenTypes||[])],supportBudget:{materials:4,firewood:2},supportUsed:{materials:0,firewood:0},lures:[],reinforcements:0};
 for(const z of b.zones)if(z.hp<=0)destroyZoneDefenses(z);
 b.boss=createBossState(base);b.braceCooldowns={};b.rationNeed=needs({...base,weather:b.weather});b.indoorPeople={};b.sleepInterrupted={};b.fearRetreats={};b.fearCooldowns={};
 const rescue=rescueBenefits(base),total=3+Math.floor((base.day-1)/3)+([7,14,21,28].includes(base.day)?3:0)+Math.min(3,base.exposure),types=enemyTypes(base.day),intel=dailyIntel(base);
 if(base.day===28&&rescue.route>0){for(const zone of rescue.trapZones){const z=b.zones.find(z=>z.id===zone);if(z.hp>0)z.traps=Math.min(3,z.traps+1);}note(b,'接应路线准备的外围路障已经布好，能挡下有限冲击。');}
 for(let i=0;i<total;i++){
  const type=i===0&&!intel.boss?intel.type:types[Math.floor(rng(b)*types.length)];let zi=rng(b)<.5?ZONES.findIndex(z=>z.id===intel.direction):Math.floor(rng(b)*5);if(type==='burrower')zi=3+Math.floor(rng(b)*2);
  b.schedule.push({at:arrivalTime(base.day,i,total),type,zone:ZONES[zi].id});
 }
 planChallenge(b,base);
 // Prepared aid removes the latest ordinary arrivals. Keep every remaining
 // species, position and arrival time, including the complete boss encounter.
 let relief=rescue.nightReduction;
 for(let i=b.schedule.length-1;i>=0&&relief>0;i--)if(!ENEMIES[b.schedule[i].type].boss){b.schedule.splice(i,1);relief--;}
 if(rescue.nightReduction>0)note(b,`路线与邻里援助使本夜少来${rescue.nightReduction-relief}只普通生物，首领仍会来袭。`);
 if(base.day===1)b.warned.push('daily-challenge');
 b.dayProduced=true;
 for(const p of b.people){const z=ZONES.find(z=>z.id===p.zone)||ZONES[0];Object.assign(p,p.wound==='severe'?HOME:inner(z));if(!p.dead&&p.wound!=='severe'&&p.nightRole!=='sleep')p.nightDutyDay=b.day;if(!p.dead&&(p.nightRole==='sleep'||p.wound==='severe'))enterHouse(b,p);p.task=null;delete p.manualPosition;p.cooldown=0;p.stamina=maxStamina(p);b.work[p.id]=0;}
 refreshNutrition(b);
 const tower=facility(base,'watchtower');b.warningLead=watchtowerRange(tower,b.weather)+(base.flags.scouted===base.day?12:0);
 b.scoutLead=base.flags.scouted===base.day?12:0;b.aidKit=!!base.flags.aidKit;
 const fires=[{...CENTRAL_FIRE,shade:true,enabled:base.flags.centralFire!==false}];
 b.fires=fires.map(f=>{let wood=campfireWood(base.flags.campfireWood);if(f.enabled&&wood<=0&&b.resources.materials>0){b.resources.materials--;wood++;recordResourceFlow(b,{materials:-1},'入夜添柴','spend');}const lit=f.enabled&&wood>0;return {...f,wood,heat:lit?60:0,wet:0};});
 b.walkMap=createWalkMap(base,b);refreshNutrition(b);
 return b;
}
function spawn(b,type,zid,extra=false,challenge=false,options={}){if(type==='skitter')zid=weakestZone(b,ZONES,zid);const z=ZONES.find(z=>z.id===zid),d=ENEMIES[type],lead=warningDistance(b,zid),length=Math.hypot(z.ox-z.x,z.oy-z.y);const e={id:`e${b.eventSeq}-${b.schedule.length}-${b.enemies.length}-${Math.floor(b.elapsed*1000)}`,type,zone:zid,x:z.ox+(z.ox-z.x)/length*lead+(rng(b)-.5)*16,y:z.oy+(z.oy-z.y)/length*lead+(rng(b)-.5)*16,hp:d.hp,max:d.hp,mode:'approach',attack:0,progress:0,stun:0,called:false,challenge,entered:false};if(challenge){e.hp*=b.challenge.strength;e.max=e.hp;}Object.assign(e,options);b.enemies.push(e);if(d.boss&&!e.bossBrood)registerBoss(b,e);if(challenge)b.challenge.spawned++;event(b,'warning',z.x,z.y,type==='skitter'?`${d.name} · 寻找${z.name}薄弱处`:d.name,{zone:zid,enemyId:e.id});if(b.zones.find(q=>q.id===zid).bell)event(b,'bell',z.x,z.y,'铃绳响起 · 提前预警',{zone:zid,enemyId:e.id});if(!b.seen.includes(type)){b.seen.push(type);alarm(b,`首次发现${d.name}：${d.warning}`,`new-${type}`);}if(extra)note(b,'啼叫者引来一只灰行者，增援仍有上限。');return e;}
function cancel(b,p){if(p.task?.reserved){for(const [key,n]of Object.entries(p.task.reserved))b.resources[key]+=n;recordResourceFlow(b,p.task.reserved,`${p.name} · 返还预留`,'refund');}p.task=null;delete p.manualPosition;}
function die(b,p){
 cancel(b,p);if(!markDead(p,'attack'))return;
 delete b.indoorPeople?.[p.id];delete b.fearRetreats?.[p.id];delete b.fearCooldowns?.[p.id];
 if(b.challenge)b.challenge.newDeaths=(b.challenge.newDeaths||0)+1;
 event(b,'death',p.x,p.y,`${p.name}死亡 · 健康归零`,{personId:p.id});note(b,`${p.name}受到攻击，健康归零，已死亡。`);
}
function completeTask(b,p){const t=p.task;if(t.automatic)for(const[k,n]of Object.entries(t.reserved)){const budget=t.type==='addWood'?'firewood':k;if(b.supportUsed[budget]!==undefined)b.supportUsed[budget]+=n;}t.reserved={};p.task=null;}
function refreshNutrition(b){b.rationNeed=needs(b);for(const p of b.people){p.hunger=!p.dead&&b.resources.food<b.rationNeed.food;p.thirst=!p.dead&&b.resources.water<b.rationNeed.water;}}
function setTask(b,p,type,target,automatic=false){
 if(['fire','stoke','addWood','extinguish','clearWet'].includes(type))requireRule(target==='central','院内只保留中央篝火。');
 requireRule(p.wound!=='severe'||type==='aid','重伤者需要先急救。');cancel(b,p);let cost={};if(type==='repair'||type==='barricade')cost={materials:1};if(type==='addWood')cost={materials:1};if(type==='throw')cost={materials:1};if(type==='bait')cost={food:1};if(type==='aid')cost={medicine:p.skills.medical>=2?1:2};
 for(const[k,n]of Object.entries(cost))requireRule(b.resources[k]>=n,'当前夜战剩余物资不足。');
 if(type==='repair'){const z=b.zones.find(z=>z.id===target);requireRule(z&&z.hp<z.max,'这里无需修补。');requireRule(z.hp>0||!b.enemies.some(e=>e.zone===z.id&&e.mode!=='approach'&&e.hp>0),'破口被生物占据，先驱赶或顶住。');}
 if(type==='fire')requireRule(b.fires.some(f=>f.id===target&&f.heat<=0&&f.wood>0),'需要已熄灭且有余柴；无柴时请添柴。');
 if(['stoke','addWood','extinguish','clearWet'].includes(type))requireRule(b.fires.some(f=>f.id===target),'火源不存在。');
 if(type==='stoke')requireRule(b.fires.some(f=>f.id===target&&f.heat>0&&f.wood>0),'需要仍有火星和余柴；熄灭时请重燃，无柴时请添柴。');
 if(type==='addWood'){requireRule(campfireNeedsWood(b.fires.find(f=>f.id===target)),'余柴充足，请免费拨火；低于0.25时再添柴。');requireRule(!b.people.some(q=>q.id!==p.id&&q.task?.type==='addWood'&&q.task.target===target),'已有成员正在添柴。');}
 if(type==='move'){target=nearestWalkablePoint(target,b.walkMap,p);requireRule(target,'移动目的地无效。');}
 if(!['move','fire','stoke','addWood','extinguish','clearWet','aid','retreat','barricade'].includes(type))requireRule(ZONES.some(z=>z.id===target),'防区不存在。');
 if(type==='barricade')requireRule(b.house<100,'小屋安全防线仍完好。');
 if(type==='repair')requireRule(b.people.filter(q=>q.id!==p.id&&q.task?.type==='repair'&&q.task.target===target).length<2,'同一处最多两人协作修补。');
 if(type==='brace')requireRule(p.stamina>=24&&(b.braceCooldowns?.[p.id]||0)<=0,'体力不足或仍在恢复，暂时无法顶住。');
 for(const[k,n]of Object.entries(cost))b.resources[k]-=n;p.task={type,target,stage:'travel',progress:0,reserved:cost,automatic};
 const names={repair:'修补',barricade:'加固小屋',addWood:'添柴',stoke:'拨火',throw:'投掷',bait:'诱饵',aid:'急救'};
 recordResourceFlow(b,Object.fromEntries(Object.entries(cost).map(([key,n])=>[key,-n])),`${p.name} · ${automatic?'自动':''}${names[type]||type}预留`);
 if(type==='guard')p.task.threatIds=b.enemies.filter(e=>e.zone===target&&e.hp>0&&e.mode!=='retreat').map(e=>e.id);
}
export function battleCommand(b,a){
 requireRule(!b.finished,'夜战已经结束。');requireRule(a&&typeof a==='object','命令格式错误。');
 if(a.type==='pause'){b.paused=true;b.reason='已暂停，可以安排命令。';return;}
 if(a.type==='resume'){b.paused=false;b.reason='';return;}
 if(a.type==='autoPause'){b.autoPause=a.enabled===true;return;}
 if(a.type==='budget'){for(const k of ['materials','firewood'])if(a[k]!==undefined){requireRule(Number.isInteger(a[k])&&a[k]>=0&&a[k]<=20,'预算必须是0至20的整数。');b.supportBudget[k]=a[k];}return;}
 const p=b.people.find(p=>p.id===a.person&&!p.dead);requireRule(p,'成员不存在。');
 if(a.type==='cancel'){cancel(b,p);endFearRetreat(b,p);refreshNutrition(b);return;}
 requireRule(['move','repair','barricade','fire','stoke','addWood','extinguish','guard','brace','throw','bait','compact','clearWet','retreat','aid'].includes(a.type),'没有这种夜间动作。');
 // Validate on a copy so a rejected replacement cannot cancel or refund the old task.
 const copy=structuredClone(b),cp=copy.people.find(x=>x.id===p.id);setTask(copy,cp,a.type,a.target||'gate');endFearRetreat(copy,cp);refreshNutrition(copy);Object.assign(b,copy);
}
function heatFactor(b,e){return campfireActive(b)?e.type==='rammer'?.85:.7:1;}
function hitZone(b,z,damage,e){
 if(z.hp<=0)return;let factor=heatFactor(b,e);
 if(b.people.some(p=>p.task?.type==='brace'&&p.task.target===z.id&&distance(p,inner(ZONES.find(q=>q.id===z.id)))<16))factor*=.45;
 e.lastAttackAt=b.elapsed;e.attackTarget={kind:'fence',id:z.id,name:ZONES.find(q=>q.id===z.id).name};
 const before=z.hp;z.hp=clamp(z.hp-damage*factor,0,z.max);event(b,e.type==='rammer'?'impact':'hit',e.x,e.y,`${e.type==='rammer'?'重撞':'围栏'} −${formatDurability(before-z.hp)}${factor<1?` · 抵消${formatDurability(damage*(1-factor))}`:''}`,{zone:z.id,enemyId:e.id,damage:amount(before-z.hp),prevented:amount(damage*(1-factor)),fireProtected:heatFactor(b,e)<1,braced:factor<heatFactor(b,e)});
 enemyDamageFeedback(b,e,{...ZONES.find(q=>q.id===z.id),kind:'fence'},before-z.hp,(...args)=>event(b,...args));
 if(before>25&&z.hp<=25)alarm(b,`${ZONES.find(q=>q.id===z.id).name}耐久偏低，可以修补或退守。`,`low-${z.id}`);
 if(z.hp===0){const lost=destroyZoneDefenses(z);if(lost.length){b.defenseLosses||=[];b.defenseLosses.push({zone:z.id,defenses:lost});}if(lost.length)note(b,`${ZONES.find(q=>q.id===z.id).name}护栏损毁，${lost.join('、')}一同损毁；修补护栏后需重新安装。`);b.breaches++;if(b.challenge&&!b.challenge.broken.includes(z.id))b.challenge.broken.push(z.id);alarm(b,`${ZONES.find(q=>q.id===z.id).name}出现破口！先驱赶近处生物，再封堵。`,`breach-${z.id}`);event(b,'breach',e.x,e.y,lost.length?`护栏损毁 · ${lost.join('、')}一同损毁`:'围栏破口',{zone:z.id,enemyId:e.id,lostDefenses:lost});}
}
function automatic(b,p){
 if(p.wound==='severe'||p.nightRole==='sleep')return;if(p.nightRole==='support'){
  const hasBudget=key=>autoBudgetAvailable(b,key);
  const fire=b.fires.find(f=>f.enabled!==false&&!b.people.some(q=>['fire','stoke','addWood','extinguish'].includes(q.task?.type)&&q.task.target===f.id));
  if(fire){if(campfireNeedsWood(fire)&&b.resources.materials>0&&hasBudget('firewood')){setTask(b,p,'addWood',fire.id,true);return;}if(fire.wood>0){if(fire.heat<=0){setTask(b,p,'fire',fire.id,true);return;}if(fire.heat<22){setTask(b,p,'stoke',fire.id,true);return;}}}
  const weak=b.zones.filter(z=>(z.id===p.zone||fearEffects(p.fear).autoAssist)&&b.resources.materials>0&&hasBudget('materials')&&(p.id==='hero'?z.hp>0&&z.hp<60&&!b.people.some(q=>q.task?.type==='repair'&&q.task.target===z.id):needsAutoRepair(b,z,p)&&(z.id===p.zone||!ownThreats(b,p).length))).sort((a,c)=>(p.id==='hero'?0:Number(c.id===p.zone)-Number(a.id===p.zone))||a.hp-c.hp)[0];
  if(weak){setTask(b,p,'repair',weak.id,true);if(p.id!=='hero'&&weak.id!==p.zone)p.task.assist=true;return;}
 }
 const help=chooseDefenseAssist(b,p);if(help){setTask(b,p,'guard',help,true);p.task.assist=true;note(b,`${p.name}完成本区工作，自动支援${ZONES.find(z=>z.id===help).name}，结束后恢复原分工。`);}
}
function strike(b,p,target){if(p.cooldown>0||p.stamina<=8||distance(p,target)>STRIKE_RANGE)return;const dmg=7+Math.floor(p.skills.guard)*3;const dealt=bossDamage(b,target,dmg,'strike');target.hp-=dealt;target.progress=Math.max(0,target.progress-3);if(!target.boss)target.stun=Math.max(target.stun,STRIKE_STUN);p.cooldown=fearEffects(p.fear).attackInterval;p.stamina-=7;b.work[p.id]+=2;event(b,'attack',target.x,target.y,`−${amount(dealt)}${dealt<dmg?' · 护甲减伤':''}`,{zone:target.zone,enemyId:target.id,damage:amount(dealt),source:{x:p.x,y:p.y}});}
function fight(b,p,enemy,speed,dt){
 const inRange=distance(p,enemy)<=STRIKE_RANGE;
 if(enemy.mode==='approach'&&!inRange){move(p,inner(ZONES.find(z=>z.id===enemy.zone)||ZONES[0]),speed,dt,true,b.walkMap);return;}
 approachCombat(b,p,enemy,speed,dt);
 if(inRange)strike(b,p,enemy);
}
function stepFearRetreat(b,p,dt,fatigue){
 const retreat=fearRetreat(b,p);if(!retreat)return false;
 if(p.wound==='severe'){endFearRetreat(b,p);return false;}
 if(retreat.stage==='travel'){
  if(move(p,HOME,40*fatigue.movement,dt,true,b.walkMap)&&distance(p,HOME)<.1){enterHouse(b,p);retreat.stage='calm';}
  return true;
 }
 retreat.progress+=dt;p.fear=clamp(p.fear-dt*FEAR_CALM_RATE);
 if(retreat.progress+1e-8>=FEAR_RETREAT_SECONDS){endFearRetreat(b,p);leaveHouse(b,p);event(b,'fear',p.x,p.y,'镇定结束 · 恢复原岗位',{personId:p.id});note(b,`${p.name}镇定结束，恢复原岗位和重点防区。`);}
 return true;
}
function peopleStep(b,dt){const warm=campfireActive(b);for(const p of b.people){if(p.dead)continue;const fatigue=fatigueEffects(p.fatigue);if(b.braceCooldowns)b.braceCooldowns[p.id]=Math.max(0,(b.braceCooldowns[p.id]||0)-dt);p.cooldown=Math.max(0,p.cooldown-dt);p.stamina=clamp(p.stamina+dt*(warm?2:1.6)*fatigue.recovery,0,maxStamina(p));if(warm)p.fear=clamp(p.fear-dt*.04);
 if(stepFearRetreat(b,p,dt,fatigue))continue;
 if(p.task){p.nightDutyDay=b.day;if(interruptSleep(b,p))note(b,`${p.name}被叫醒执行临时任务，睡眠已中断，本夜不再获得睡眠收益。`);}
 if(isIndoors(b,p)){if(!p.task&&(p.nightRole==='sleep'||p.wound==='severe')){if(sleepEligible(b,p))p.fear=clamp(p.fear-dt*.035);continue;}if(!(['retreat','aid'].includes(p.task?.type)&&p.task.stage==='work'))leaveHouse(b,p);}
 if(p.wound==='severe'&&!p.task){if(move(p,HOME,35*fatigue.movement,dt,true,b.walkMap)&&distance(p,HOME)<.1)enterHouse(b,p);continue;}
 const situation=fearSituation(b,p);p.fear=clamp(p.fear+dt*(situation.isolation+situation.breach-situation.calm));
 if(mayFearRetreat(b,p,situation)){
  cancel(b,p);b.fearRetreats??={};b.fearRetreats[p.id]={stage:'travel',progress:0};
  event(b,'fear',p.x,p.y,'恐惧过高 · 暂退小屋',{personId:p.id});note(b,`${p.name}恐惧超过90且遭到近身攻击，暂退小屋镇定4秒，之后恢复原岗位；手动指令可立即接管。`);
  stepFearRetreat(b,p,dt,fatigue);continue;
 }
 if(assistShouldReturn(b,p))cancel(b,p);if(p.task?.automatic&&p.task.type==='repair'){const z=b.zones.find(z=>z.id===p.task.target);if(!z||z.hp>=z.max||occupiedBreak(b,z))cancel(b,p);}
 if(!p.task)automatic(b,p);
 const t=p.task;
 if(t){let target=t.type==='move'?t.target:['retreat','aid','barricade'].includes(t.type)?HOME:['fire','stoke','addWood','extinguish','clearWet'].includes(t.type)?b.fires.find(f=>f.id===t.target):inner(ZONES.find(z=>z.id===t.target)||ZONES[0]);if(!target){cancel(b,p);continue;}
  if(t.type==='guard'){
   const threats=b.enemies.filter(e=>t.threatIds?.includes(e.id)&&e.hp>0&&e.mode!=='retreat'&&(!t.assist||e.zone===t.target)).sort((a,c)=>distance(p,a)-distance(p,c));
   if(!threats.length){completeTask(b,p);continue;}
   const enemy=threats[0];t.stage=distance(p,enemy)<=STRIKE_RANGE?'work':'travel';
   fight(b,p,enemy,43*fatigue.movement,dt);
   continue;
  }
  if(t.stage!=='work'){const arrived=move(p,target,43*fatigue.movement,dt,true,b.walkMap);if(!arrived||t.type==='move'&&distance(p,target)>.1)continue;t.stage='work';if(['retreat','aid'].includes(t.type))enterHouse(b,p);}
  if(t.type==='move'||t.type==='retreat'){
   t.progress+=dt;
   if(t.type==='move'){const enemy=b.enemies.filter(e=>e.hp>0&&e.mode!=='retreat'&&distance(p,e)<=STRIKE_RANGE).sort((a,c)=>distance(p,a)-distance(p,c))[0];if(enemy)strike(b,p,enemy);}
   else p.fear=clamp(p.fear-dt*.035);
   if(t.progress>=orderDuration(p,t.type))completeTask(b,p);
   continue;
  }
  t.progress+=dt;b.work[p.id]+=dt;p.stamina=clamp(p.stamina-dt*2,0,maxStamina(p));
  const duration=orderDuration(p,t.type,b.aidKit);
  if(t.progress<duration)continue;const z=b.zones.find(z=>z.id===t.target);
  if(t.type==='repair'){if(z.hp===0&&b.enemies.some(e=>e.zone===z.id&&e.mode==='inside'&&distance(e,target)<35)){cancel(b,p);note(b,'洞口仍被占据，未消耗修补材料。');continue;}const healed=Math.min(z.max-z.hp,23+Math.floor(p.skills.engineering)*3);z.hp+=healed;event(b,'repair',p.x,p.y,`围栏 +${formatDurability(healed)}`,{zone:z.id,gain:amount(healed)});note(b,`${p.name}修补了${ZONES.find(q=>q.id===z.id).name}，消耗1建材。`);}
  if(t.type==='fire'||t.type==='stoke'){if(t.type==='stoke'&&target.heat<=0){cancel(b,p);note(b,'火已熄灭，请改为重燃。');continue;}const added=tendedHeat(target.heat)-target.heat;if(target.wood<=0){cancel(b,p);note(b,'柴堆已烧尽，请先添柴。');continue;}target.heat+=added;target.enabled=true;event(b,'fire',target.x,target.y,t.type==='stoke'?'拨火 · 免费':'免费重燃',{zone:null,targetId:target.id,gain:amount(added),action:t.type});note(b,`${p.name}${t.type==='stoke'?'拨旺':'重燃'}中央篝火，不消耗建材。`);}
  if(t.type==='addWood'){if(!campfireNeedsWood(target)){cancel(b,p);note(b,'余柴已足，退还添柴预留建材。');continue;}target.wood=CAMPFIRE_MAX_WOOD;target.heat=tendedHeat(target.heat);target.enabled=true;event(b,'fire',target.x,target.y,'添柴 · 补满1 · 1建材',{targetId:target.id,action:'addWood'});note(b,`${p.name}添柴，消耗1建材，余柴补满到1。`);}
  if(t.type==='extinguish'){for(const q of b.people)if(q!==p&&q.task?.target===target.id&&['fire','stoke','addWood'].includes(q.task.type))cancel(b,q);target.heat=0;target.enabled=false;note(b,`${p.name}熄灭中央篝火，余柴保留。`);}
  if(t.type==='barricade'){b.house=clamp(b.house+20);event(b,'repair',p.x,p.y,'小屋加固 +20',{targetId:'house'});}
  if(t.type==='brace'){p.stamina=clamp(p.stamina-18,0,maxStamina(p));p.cooldown=8;b.braceCooldowns??={};b.braceCooldowns[p.id]=8;}
  if(t.type==='throw'){for(const e of b.enemies.filter(e=>e.zone===t.target&&e.hp>0)){e.hp-=bossDamage(b,e,10,'throw');e.stun=2;e.progress=0;e.attack=0;}bossCounter(b,'throw',t.target,bossHooks);const at=ZONES.find(q=>q.id===t.target);event(b,'throw',at.x,at.y,b.boss&&!b.boss.defeated?'投掷命中 · 打断':'投掷 −10 · 打断',{zone:t.target,source:{x:p.x,y:p.y}});}
  if(t.type==='bait'){b.lures.push({zone:t.target,x:target.x,y:target.y,until:b.elapsed+12,affected:[]});event(b,'bait',p.x,p.y,'诱饵生效 · 持续12秒',{zone:t.target});}
  if(t.type==='compact'){z.compacted=true;bossCounter(b,'compact',t.target,bossHooks);for(const e of b.enemies)if(e.zone===t.target&&e.type==='burrower'){e.progress=0;e.hp-=15;e.stun=4;}event(b,'compact',p.x,p.y,'土道压实 · 浅掘变慢',{zone:t.target});}
  if(t.type==='clearWet'){target.wet=0;event(b,'clearWet',target.x,target.y,'湿污已清除',{zone:target.id==='central'?null:target.id,targetId:target.id});}
  if(t.type==='aid'){p.health=Math.max(42,p.health);p.wound='recovering';p.deadline=null;p.extended=false;event(b,'heal',p.x,p.y,'已稳定');}
  completeTask(b,p);continue;
 }
 if(p.nightRole==='sleep'){if(move(p,HOME,40*fatigue.movement,dt,true,b.walkMap)&&distance(p,HOME)<.1)enterHouse(b,p);if(sleepEligible(b,p))p.fear=clamp(p.fear-dt*.035);continue;}
 const standby=inner(ZONES.find(z=>z.id===p.zone)||ZONES[0]),target=patrolTarget(b,p);
 if(target)fight(b,p,target,43*fatigue.movement,dt);
 else move(p,standby,35*fatigue.movement,dt,true,b.walkMap);
}}
export function stepBattle(b,dt=.05){
 if(b.paused||b.finished)return b;requireRule(Number.isFinite(dt)&&dt>0&&dt<=.1,'模拟时间步不合法。');b.elapsed+=dt;
 if(b.challenge&&b.elapsed>=Math.max(1,b.challenge.starts-NIGHT_PACING.warningLead))alarm(b,`挑战预警：${b.challenge.title}，${b.challenge.hint} ${b.challenge.boss?'首领有独立机制，留意阶段提示。':`强壮个体生命×${b.challenge.strength}，伤害不变。`}`,'daily-challenge');
 for(const f of b.fires){f.wood=campfireWood(f.wood);f.wet=Math.max(0,f.wet-dt);if(f.heat>0){f.wood=Math.max(0,f.wood-dt*CAMPFIRE_BURN_RATE);f.heat=f.wood>0?Math.max(0,f.heat-dt*campfireHeatDecay(b.weather)):0;}}
 while(b.schedule.length&&b.elapsed>=b.schedule[0].at){const s=b.schedule.shift();spawn(b,s.type,s.zone,false,!!s.challenge);if(b.paused)return b;}
 for(const lure of b.lures){if(lure.until<=b.elapsed)continue;for(const e of b.enemies)if(e.hp>0&&e.mode!=='retreat'&&e.type!=='rammer'&&!e.boss&&!lure.affected.includes(e.id)&&distance(e,lure)<200){lure.affected.push(e.id);const wasInside=e.mode==='inside';e.zone=lure.zone;e.mode='approach';e.stun=Math.max(1,e.stun);if(e.type==='skitter'){e.huntLuredUntil=lure.until;e.huntPath=wasInside?[]:skitterDetour(artPoint(e),e.zone).map(worldPoint);}}}
 for(const e of b.enemies){if(e.hp<=0)continue;e.stun=Math.max(0,e.stun-dt);if(e.stun>0)continue;const switched=rethinkSkitter(b,e,dt,ZONES,artPoint,worldPoint);if(switched)event(b,'weakpoint',e.x,e.y,`裂隙鼠绕行 · 改袭${ZONES.find(z=>z.id===e.zone).name}`,{zone:e.zone,enemyId:e.id,from:switched.from});const def=ENEMIES[e.type],z=b.zones.find(z=>z.id===e.zone),geometry=ZONES.find(z=>z.id===e.zone),speed=enemySpeed(e);
  if(e.mode==='approach'){if(e.type==='skitter'&&e.huntPath?.length){if(move(e,e.huntPath[0],speed,dt))e.huntPath.shift();continue;}if(move(e,geometry,speed,dt)){e.mode='attack';event(b,'contact',e.x,e.y,'接触防线',{zone:z.id,enemyId:e.id});if(z.traps>0)triggerTrap(b,e,z,2);}continue;}
  if(e.mode==='attack'&&e.boss&&z.spikes){e.hp-=dt*1.25;interaction(b,e,'spikes','spikes','翻刺刮伤 · 1.25/秒',{damageRate:1.25});if(e.hp<=0)continue;}
  const bossTurn=stepBossEnemy(b,e,dt,bossHooks);
  if(e.mode==='attack'&&!bossTurn){
   if(z.spikes){const rate=e.type==='rammer'?.7:1.25;e.hp-=dt*rate;interaction(b,e,'spikes','spikes',`翻刺刮伤 · ${rate}/秒`,{damageRate:rate});if(e.type==='climber')interaction(b,e,'blocked','blocked','翻刺阻止攀爬',{defense:'spikes'},5);}if(z.mesh&&e.type==='burrower')interaction(b,e,'blocked','blocked','埋网挡住浅掘',{defense:'mesh'},5);
   if(e.type==='climber'&&!z.spikes){e.progress+=dt*(z.mesh?.35:1)*(campfireActive(b)?.65:1);if(e.progress+1e-8>=ENEMY_WINDUP.climb){e.mode='inside';event(b,'vault',e.x,e.y,'翻越入院',{zone:z.id,enemyId:e.id});alarm(b,'攀爬者翻进了院子，及时驱赶或退守。','climbed');} }
   if(e.type==='burrower'&&!z.mesh){e.progress+=dt*(z.compacted?.35:1);if(e.progress+1e-8>=ENEMY_WINDUP.dig){e.mode='inside';event(b,'dig',e.x,e.y,'浅掘入院',{zone:z.id,enemyId:e.id});alarm(b,'掘行兽沿松土进入院子，压实土道或转移。','dug');}}
   if(e.type==='caller'&&!e.called){e.progress+=dt;if(e.progress+1e-8>=ENEMY_WINDUP.call){e.called=true;if(b.reinforcements<2){b.reinforcements++;event(b,'call',e.x,e.y,'啼叫召援 +1',{zone:z.id,enemyId:e.id});spawn(b,'walker',e.zone,true);}}}
   if(e.type==='quencher'){e.progress+=dt;if(e.progress+1e-8>=ENEMY_WINDUP.spray){e.progress=0;const f=b.fires.find(f=>f.id==='central');if(f){e.lastAttackAt=b.elapsed;e.attackTarget={kind:'fire',id:f.id,name:'中央篝火'};e.attack=0;const loss=f.shade?9:18;f.heat=Math.max(0,f.heat-loss);f.wet=f.shade?4:8;event(b,'wet',f.x,f.y,`喷污 −${loss}火势 · 湿污${f.wet}秒`,{zone:z.id,enemyId:e.id,targetId:f.id,loss,wet:f.wet,protected:!!f.shade,source:{x:e.x,y:e.y}});}}}
   if(e.lastAttackAt!==b.elapsed)e.attack+=dt;if(e.lastAttackAt!==b.elapsed&&e.attack+1e-8>=def.interval){e.attack=0;if(e.type==='rammer'&&z.traps>0){triggerTrap(b,e,z,3,true);}else hitZone(b,z,def.damage,e);}
   if(z.hp<=0)e.mode='inside';
  }
  if(e.mode==='inside'){
   if(e.challenge&&!e.entered){e.entered=true;b.challenge.entered++;}
   if(e.lastAttackAt===b.elapsed)continue;
   const weakness=heatFactor(b,e);e.typeName=e.bossBrood?'穴灯幼兽':def.name;
   const p=enemyPersonTarget(b,e);
   if(!p){delete e.personTargetId;delete e.attackTarget;intrusionStep(b,e,dt,speed,weakness,()=>rng(b),(...args)=>event(b,...args),text=>note(b,text));continue;}
   e.personTargetId=p.id;e.attackTarget={kind:'person',id:p.id,name:p.name};e.lastAttackAt=b.elapsed;
   const before=p.health,rate=enemyDamageProfile(e).person*weakness;
   p.health=Math.max(0,p.health-dt*rate);p.fear=clamp(p.fear+dt*FEAR_GAIN.contact);
   enemyDamageFeedback(b,e,{kind:'person',id:p.id,name:p.name,x:p.x,y:p.y},before-p.health,(...args)=>event(b,...args),rate);
   if(p.health<=0){die(b,p);continue;}
   if(p.health<=20&&p.wound!=='severe'){cancel(b,p);p.wound='severe';p.extended=false;if(b.challenge)b.challenge.newSevere++;p.deadline=b.day+1;for(const witness of witnessInjury(b,p))event(b,'fear',witness.x,witness.y,`附近同伴重伤 · 恐惧+${FEAR_GAIN.witness}`,{personId:witness.id});alarm(b,`${p.name}重伤，仍会受攻击；健康归零就会死亡，需及时急救或撤回屋内。`,`wound-${p.id}`);}

  }
 }
 stepBossWorld(b,dt,bossHooks);b.warningLead=watchtowerRange(facility(b,'watchtower'),b.weather)+(b.scoutLead||0);peopleStep(b,dt);finishBossStep(b,bossHooks);if(b.challenge)b.challenge.defeated+=b.enemies.filter(e=>e.hp<=0&&e.challenge&&e.mode!=='retreat'&&!e.bossDormant).length;b.enemies=b.enemies.filter(e=>e.hp>0||e.bossDormant);b.lures=b.lures.filter(l=>l.until>b.elapsed);
 if(b.people.find(p=>p.id==='hero')?.dead||b.house<=0||nightProgress(b).cleared){for(const p of b.people)cancel(b,p);b.finished=true;resolveChallenge(b);if(b.challenge)note(b,`挑战「${b.challenge.title}」${b.challenge.status==='cleared'?'完成':'未完成'}：${b.challenge.feedback}`);b.paused=true;b.reason='夜战结束，正在保存整夜结果。';note(b,b.people.find(p=>p.id==='hero')?.dead?'主角死亡，本夜失败。':b.house<=0?'房屋安全防线失守。':'本夜来袭生物已全部击退。天亮了。');}
 refreshNutrition(b);return b;
}

const bossHooks={event,note,alarm,spawn,hitZone,finishBrace:(b,zone)=>{const p=b.people.find(p=>p.task?.type==='brace'&&p.task.target===zone&&distance(p,inner(ZONES.find(z=>z.id===zone)))<16);if(p){p.stamina=Math.max(0,p.stamina-18);p.cooldown=1;b.braceCooldowns??={};b.braceCooldowns[p.id]=8;completeTask(b,p);}},braced:(b,zone)=>b.people.some(p=>!p.dead&&p.wound!=='severe'&&p.task?.type==='brace'&&p.task.target===zone&&distance(p,inner(ZONES.find(z=>z.id===zone)))<16)};
