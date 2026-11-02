import {BOSS_SPECIES,bossForDay,BOSS_FORM_HEALTH,BOSS_BURST_DAMAGE} from './boss-content.js';
import {ZONES} from './content.js';

export function createBossState(s){const def=bossForDay(s.day);if(!def)return null;return {
 id:def.id,zone:s.day===28&&s.flags.route==='river'?'backLeft':def.zone,entityIds:[],phase:'waiting',clock:0,
 defeated:false,mounds:[],moundSeq:0,nextMound:0,summons:0,sealed:0,split:false,revives:0,downUntil:null
};}
const body=b=>b.enemies.find(e=>e.id===b.boss?.entityIds[0]);
function emit(b,h,type,e,text,extra={}){h.event(b,type,e.x,e.y,text,{zone:e.zone,enemyId:e.id,bossId:b.boss.id,...extra});}
function expose(b,e,h,seconds,reason){const bs=b.boss;bs.phase='exposed';bs.clock=seconds;bs.exposedAt=b.elapsed;bs.exposedFor=seconds;e.stun=Math.max(e.stun,1.5);emit(b,h,'boss-break',e,`${reason} · 露出弱点${seconds}秒`);h.note(b,`${BOSS_SPECIES[bs.id].name}：${reason}，露出弱点${seconds}秒。`);}
export function registerBoss(b,e){const bs=b.boss;if(!bs||e.type!==bs.id)return;e.boss=true;e.bossForm??=0;bs.entityIds.push(e.id);if(bs.phase==='waiting')bs.phase='approach';}
export function bossDamage(b,e,raw,source){
 if(!e.boss||b.boss?.id!==e.type)return raw;
 const phase=b.boss.phase;
 if(phase==='exposed')return raw*1.5;
 if(source==='strike'||source==='throw'){
  if(e.type==='bastion'&&phase==='charge')return raw*.35;
  if(e.type==='cinderwhale'&&phase==='siphon')return raw*.5;
 }
 return raw;
}
function seal(b,m,h){const bs=b.boss,e=body(b);if(!e||e.hp<=0)return;m.sealed=true;bs.sealed++;e.hp-=16;e.stun=Math.max(e.stun,2);
 const z=ZONES.find(z=>z.id===m.zone);h.event(b,'boss-break',z.x,z.y,'封巢成功 · 巢母 −16',{zone:m.zone,bossId:bs.id,enemyId:e.id,damage:16});h.note(b,`${z.name}鼓包被封住，穴灯巢母受到16反噬伤害。`);
}
export function bossCounter(b,type,zone,h){const bs=b.boss;if(!bs||bs.defeated)return;
 if(type==='throw'||type==='compact')for(const m of bs.mounds)if(!m.sealed&&m.zone===zone)seal(b,m,h);
 const e=body(b);if(!e||e.hp<=0||e.zone!==zone)return;
 if(bs.id==='bastion'&&(type==='trap'||type==='throw')&&bs.phase!=='exposed')expose(b,e,h,8,type==='trap'?'陷阱绊倒':'投掷打断');
 if(bs.id==='cinderwhale'&&type==='throw'&&bs.phase==='siphon')expose(b,e,h,10,'吸焰被打断');
}
export function stepBossEnemy(b,e,dt,h){
 const bs=b.boss;if(!e.boss||!bs||bs.id!==e.type)return false;
 if(!['attack','inside'].includes(e.mode))return false;
 if(e.mode==='inside'){if(bs.phase!=='exposed')bs.phase='inside';return false;}
 const def=BOSS_SPECIES[e.type],z=b.zones.find(z=>z.id===e.zone);
 if(e.type==='bastion'){
  if(bs.phase==='exposed')return true;
  if(bs.phase!=='charge'){bs.phase='charge';bs.clock=0;emit(b,h,'boss-warn',e,'棘冠蓄撞 · 5秒后冲击');h.alarm(b,'棘冠背兽开始蓄撞：正门顶住或投掷可破甲。','boss-bastion');}
  bs.clock+=dt;
  if(bs.clock+1e-8>=5){emit(b,h,'boss-impact',e,'棘冠冲撞',{target:ZONES.find(z=>z.id===e.zone)});if(h.braced(b,e.zone)){h.finishBrace(b,e.zone);expose(b,e,h,8,'顶住成功');}else{h.hitZone(b,z,def.damage,e);expose(b,e,h,7,'撞后失衡');}}
 }else if(e.type==='broodmother'){
  bs.phase='nesting';e.attack+=dt;if(e.attack>=def.interval){e.attack=0;h.hitZone(b,z,def.damage,e);}
  if(bs.mounds.length===0&&bs.summons<2&&b.elapsed>=bs.nextMound){const zone=bs.moundSeq++%2?'backRight':'backLeft',p=ZONES.find(z=>z.id===zone);bs.mounds.push({id:bs.moundSeq,zone,left:8,sealed:false});bs.nextMound=b.elapsed+16;
   h.event(b,'boss-mound',p.x,p.y,'地下鼓包 · 8秒孵化',{zone,bossId:bs.id});h.note(b,`${p.name}出现发光鼓包，8秒内压实或投掷封巢；埋网会自动封住。`);h.alarm(b,'穴灯巢母正在孵化：留意后栏鼓包倒计时。','boss-broodmother');}
 }else if(e.type==='cinderwhale'){
  const fire=b.fires.find(f=>f.id==='central'),lit=fire&&fire.heat>0&&fire.enabled!==false;
  if(bs.phase==='exposed')return true;
  if(!lit){if(bs.phase==='siphon')expose(b,e,h,10,'火源切断');else{bs.phase='drained';e.attack+=dt;if(e.attack>=def.interval){e.attack=0;h.hitZone(b,z,def.damage,e);}}return true;}
  if(bs.phase!=='siphon'){bs.phase='siphon';bs.clock=0;emit(b,h,'boss-siphon',e,'吸焰 · 8秒后爆囊',{targetId:'central',target:{x:fire.x,y:fire.y}});h.alarm(b,'吞烬囊鲸开始吸焰：主动灭火或投掷可令其虚弱。','boss-cinderwhale');}
  bs.clock+=dt;
  if(bs.clock+1e-8>=8){h.hitZone(b,z,BOSS_BURST_DAMAGE,e);emit(b,h,'boss-burst',e,'爆囊 · 冲击防线',{targetId:z.id,target:ZONES.find(q=>q.id===z.id)});expose(b,e,h,8,'爆囊后脱膜');}
  else{e.lastAttackAt=b.elapsed;e.attackTarget={kind:'fire',id:fire.id,name:'中央篝火'};fire.heat=Math.max(0,fire.heat-dt*2);if(fire.heat===0)expose(b,e,h,10,'火源耗尽');}
 }else if(e.type==='twinvein'){
  bs.phase=bs.split?'twins':'linked';e.attack+=dt;if(e.attack>=def.interval){e.attack=0;h.hitZone(b,z,def.damage,e);}
 }
 if(z.hp<=0)e.mode='inside';return true;
}
export function stepBossWorld(b,dt,h){const bs=b.boss;if(!bs||bs.defeated)return;const e=body(b);if(!e||e.hp<=0)return;
 if(bs.phase==='exposed'){bs.clock=Math.max(0,bs.clock-dt);if(bs.clock===0)bs.phase='rest';}
 for(const m of bs.mounds){if(m.sealed)continue;const zone=b.zones.find(z=>z.id===m.zone);if(zone.mesh||zone.compacted){seal(b,m,h);continue;}m.left=Math.max(0,m.left-dt);
  if(m.left===0){m.sealed=true;bs.summons++;const hatch=h.spawn(b,'broodmother',m.zone,false,false,{bossBrood:true});Object.assign(hatch,{hp:BOSS_FORM_HEALTH.brood,max:BOSS_FORM_HEALTH.brood,mode:'inside',x:ZONES.find(z=>z.id===m.zone).x,y:ZONES.find(z=>z.id===m.zone).y,bossBrood:true});h.note(b,`${ZONES.find(z=>z.id===m.zone).name}鼓包孵化，一只穴灯幼兽从地下入院（最多两只）。`);emit(b,h,'boss-hatch',hatch,'幼兽入院 · 优先驱赶');}
 }bs.mounds=bs.mounds.filter(m=>!m.sealed);
}
export function finishBossStep(b,h){const bs=b.boss;if(!bs||bs.defeated)return;
 const entities=b.enemies.filter(e=>bs.entityIds.includes(e.id));if(!entities.length)return;
 const e=entities[0];
 if(bs.id==='twinvein'&&!bs.split&&e.hp<=BOSS_SPECIES.twinvein.hp/2){
  bs.split=true;bs.phase='twins';bs.clock=0;Object.assign(e,{hp:BOSS_FORM_HEALTH.twin,max:BOSS_FORM_HEALTH.twin,bossForm:1,stun:1});
  const other=e.zone==='backLeft'?'backRight':'right',p=ZONES.find(z=>z.id===other),child=h.spawn(b,'twinvein',other,false,false);Object.assign(child,{hp:BOSS_FORM_HEALTH.twin,max:BOSS_FORM_HEALTH.twin,bossForm:2,mode:'attack',x:p.x,y:p.y,stun:1});
  emit(b,h,'boss-split',e,`双脉分裂 · 两体各${BOSS_FORM_HEALTH.twin}生命`);h.note(b,'并生双脉分裂为紫脉与青脉；先削弱两体，再在12秒内连续击倒。');h.alarm(b,'并生双脉分裂！两体需在12秒内连续倒下，错过会复苏，最多两次。','boss-twinvein');return;
 }
 if(bs.id==='twinvein'&&bs.split){
  for(const twin of entities)if(twin.hp<=0&&!twin.bossDormant){twin.bossDormant=true;twin.bossDownMode=twin.mode;twin.mode='dormant';emit(b,h,'boss-down',twin,`${twin.bossForm===1?'紫脉':'青脉'}倒地 · ${bs.revives<2?'同灭窗口12秒':'复苏已耗尽'}`);if(bs.revives<2)bs.downUntil??=b.elapsed+12;}
  if(entities.some(q=>q.hp>0)){
   if(bs.downUntil!==null&&b.elapsed>=bs.downUntil&&bs.revives<2){for(const twin of entities)if(twin.bossDormant){Object.assign(twin,{hp:BOSS_FORM_HEALTH.revive,bossDormant:false,mode:twin.bossDownMode==='inside'?'inside':'attack',attack:0,stun:1});emit(b,h,'boss-revive',twin,`共生回流 · 复苏${BOSS_FORM_HEALTH.revive}生命`);}bs.revives++;bs.downUntil=null;h.note(b,`共生回流使倒地者复苏${BOSS_FORM_HEALTH.revive}生命，剩余${2-bs.revives}次。`);}return;
  }
 }else if(entities.some(q=>q.hp>0))return;
 bs.defeated=true;bs.phase='defeated';bs.mounds=[];bs.downUntil=null;if(b.challenge)b.challenge.bossDefeated=true;
 for(const q of entities)q.bossDormant=false;emit(b,h,'boss-defeat',e,`${BOSS_SPECIES[bs.id].name}已击退`);h.note(b,`首领「${BOSS_SPECIES[bs.id].name}」已击退；清除剩余来敌即可结束本夜。`);
}
export function bossStatus(b){const bs=b?.boss;if(!bs)return null;const def=BOSS_SPECIES[bs.id],entities=b.enemies.filter(e=>bs.entityIds.includes(e.id));const labels={inside:'入院攻击',waiting:'尚未出现',approach:'正在接近',charge:'棘冠蓄撞',exposed:'弱点暴露',nesting:'孵化巢穴',siphon:'吸焰蓄能',drained:'无火可吞',rest:'准备吸焰',linked:'双脉共生',twins:'分裂双体',defeated:'已击退'};
 return {id:bs.id,name:def.name,phase:bs.phase,label:labels[bs.phase]||'首领战',hp:bs.phase==='waiting'?def.hp:entities.reduce((n,e)=>n+Math.max(0,e.hp),0),max:bs.split?BOSS_FORM_HEALTH.twin*2:def.hp,
  progress:bs.phase==='charge'?bs.clock/5:bs.phase==='siphon'?bs.clock/8:0,left:bs.phase==='exposed'?bs.clock:null,
  downLeft:bs.downUntil===null?null:Math.max(0,bs.downUntil-b.elapsed),revivesLeft:2-bs.revives,defeated:bs.defeated,hint:def.counter,mounds:bs.mounds.map(m=>({...m}))};
}
