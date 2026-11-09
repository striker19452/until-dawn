import {battleCommand} from '../src/battle.js';
import {COMBAT,NIGHT_ACTIONS,BOSS_RULES,DAY_ACTIONS} from '../src/balance.js';
import {ENEMIES,ENEMY_WINDUP,ZONES} from '../src/content.js';
import {isIndoors} from '../src/shelter.js';
import {enemyPersonTarget} from '../src/enemy-target.js';
import {campfireActive,campfireMaintenance} from '../src/campfire.js';
import {nightActionInfo} from './action-help.js';

const zoneName=id=>ZONES.find(z=>z.id===id)?.name||'防区';
const action=(type,target,label)=>({type,target,label});
const remaining=seconds=>`${Math.max(0,seconds).toFixed(1)}秒`;

// Surface opportunities from the actual world state; never predict a guaranteed
// counter. Walking and work still consume time after the player resumes.
export function tacticalOpportunities(b){
 if(!b||b.finished)return [];
 const result=[],enemies=b.enemies.filter(e=>e.hp>0&&e.mode!=='retreat'&&!e.bossDormant);
 for(const p of b.people){
  if(p.dead)continue;
  const attacked=enemies.some(e=>e.mode==='inside'&&e.stun<=0&&enemyPersonTarget(b,e)?.id===p.id);
  if(p.wound==='severe'){
   if(p.task?.type!=='aid')result.push({id:'aid-'+p.id,title:`${p.name}需要急救`,person:p.id,detail:`重伤不会停止受伤；健康归零会死亡。紧急自救需先回到小屋，稳定后健康至少${DAY_ACTIONS.treatment.severeHealth}。`,actions:[action('aid',undefined,'紧急自救')]});
  }else if(!isIndoors(b,p)&&p.task?.type!=='retreat'&&((p.health<70&&attacked)||p.stamina<=COMBAT.brace.minimumStamina||p.fear>70)){
   result.push({id:'relief-'+p.id,title:`${p.name}可以轮换休整`,person:p.id,detail:`健康${Math.ceil(p.health)} · 体力${Math.ceil(p.stamina)} · 恐惧${Math.round(p.fear)}。回屋后避开近身攻击，但原防区暂时少一人；休整${NIGHT_ACTIONS.hold}秒后归队，不回复健康或结算睡眠收益。`,actions:[action('retreat',undefined,'撤回休整')]});
  }
 }
 const boss=b.boss;
 if(boss&&!boss.defeated){
  if(boss.phase==='charge')result.push({id:'boss-charge',zone:boss.zone,title:`${zoneName(boss.zone)} · 首领蓄撞`,detail:`距冲撞${remaining(BOSS_RULES.bastion.charge-boss.clock)}。顶住可破甲；蓄力重击可打断并制造弱点。赶路和作业可能来不及。`,actions:[action('heavy',boss.zone,'重击破甲'),action('brace',boss.zone,'顶住冲撞')]});
  if(boss.phase==='siphon')result.push({id:'boss-siphon',zone:boss.zone,title:'吞烬囊鲸正在吸焰',detail:`距爆囊${remaining(BOSS_RULES.cinder.siphon-boss.clock)}。灭火可切断吸焰并制造弱点，但全场篝火增益也会暂停；重击打断保留火源。`,actions:[action('extinguish','central','灭火断焰'),action('heavy',boss.zone,'重击打断')]});
  for(const mound of boss.mounds||[])if(!mound.sealed)result.push({id:'mound-'+mound.id,zone:mound.zone,title:`${zoneName(mound.zone)} · 地下鼓包`,detail:`距孵化${remaining(mound.left)}。压实不耗物资但作业较慢。封巢阻止幼兽入院并反噬巢母。`,actions:[action('compact',mound.zone,'压实封巢')]});
 }
 const seen=new Set();
 for(const e of enemies){
  if(e.boss||e.bossBrood||!(e.mode==='attack'||e.type==='sporetoad'&&e.mode==='inside')||e.stun>0)continue;
  const z=b.zones.find(z=>z.id===e.zone),key=e.zone+'-'+e.type;if(seen.has(key))continue;seen.add(key);
  let detail='',actions=[];
  if(e.type==='rammer'){detail=`重撞兽还需${remaining(ENEMIES.rammer.interval-e.attack)}发动冲撞。重击会重置目标蓄势；顶住降低围栏伤害，但结束额外耗体力。`;actions=[action('heavy',e.zone,'重击打断'),action('brace',e.zone,'顶住减伤')];}
  if(e.type==='burrower'&&!z.mesh&&!z.compacted){detail=`浅掘进度${Math.min(100,Math.floor(e.progress/ENEMY_WINDUP.dig*100))}%。压实可伤害、眩晕掘行兽并减慢本夜后续浅掘；需要赶路与作业，不能瞬间封堵。`;actions=[action('compact',e.zone,'压实防掘'),action('heavy',e.zone,'重击打断')];}
  if(e.type==='caller'&&!e.called&&b.reinforcements<COMBAT.callLimit){detail=`距离啼叫${remaining(ENEMY_WINDUP.call-e.progress)}。重击能清空目标蓄势，争取击退它的时间，防止额外增援。`;actions=[action('heavy',e.zone,'打断啼叫')];}
  if(e.type==='quencher'){detail=`距离喷污${remaining(ENEMY_WINDUP.spray-e.progress)}。蓄力重击能重置目标蓄势；湿污落下后需有人离开防区清理篝火。`;actions=[action('heavy',e.zone,'打断喷污')];}
  if(e.type==='bladebeast'){detail=`镰足兽正在蓄跳，提前站位或蓄力重击清零；翻刺不能阻止跳跃，埋网可以拖慢。`;actions=[action('heavy',e.zone,'打断蓄跳')];}
  if(e.type==='shellcrab'&&!(e.shellExposedUntil>b.elapsed)){detail='同侧驱赶仅30%伤害。分开站位夹击，或蓄力重击破甲5秒。';actions=[action('heavy',e.zone,'重击破甲')];}
  if(e.type==='sporetoad'){detail='入院后仍会蓄雾；每5秒使145距离内屋外成员体力−18、恐惧+6，不直接扣健康。可重击打断。';actions=[action('heavy',e.zone,'打断孢雾')];}
  if(actions.length)result.push({id:key,zone:e.zone,title:`${zoneName(e.zone)} · ${ENEMIES[e.type].name}`,detail,actions});
 }
 const lureTarget=b.zones.filter(z=>z.hp>0&&(z.traps>0||z.spikes)).sort((a,c)=>c.traps-a.traps||Number(c.spikes)-Number(a.spikes))[0];
 if(lureTarget&&enemies.filter(e=>e.mode==='inside'&&!e.boss&&e.type!=='rammer').length>=2&&!b.lures.some(l=>l.until>b.elapsed)){
  result.push({id:'lure',zone:lureTarget.id,title:`诱导至${zoneName(lureTarget.id)}的防御`,detail:`多只普通生物已入院。可用诱饵把生效范围${COMBAT.bait.range}内的普通生物引回设防方向，争取修补和轮换时间；持续${COMBAT.bait.seconds}秒，重撞兽和首领无效。诱饵要用食物，余粮不足时会影响全队补给。`,actions:[action('bait',lureTarget.id,'诱导分流'),action('heavy',lureTarget.id,'重击控制防区')]});
 }
 const fire=b.fires.find(f=>f.id==='central');
 if(fire&&!campfireActive(b)&&boss?.phase!=='siphon'){
  const type=fire.wet>0?'clearWet':campfireMaintenance(fire,b.resources.materials);
  result.push({id:'fire',title:'全场篝火增益已暂停',detail:'恢复火源可降低生物伤害、改善体力回复，但执行者需要离开当前防区照料篝火。',actions:[action(type,'central','恢复篝火')]});
 }
 for(const z of b.zones){
  if(z.hp>=40)continue;
  const occupied=enemies.some(e=>e.zone===z.id&&e.mode!=='approach');
  if(!occupied)result.push({id:'repair-'+z.id,zone:z.id,title:`${zoneName(z.id)} · 修补窗口`,detail:z.hp<=0?'破口目前没有生物占据，可以趁机封堵；修补要花建材与时间。':'防线耐久偏低，当前没有生物接触防线。趁空档修补可减少之后被迫近战的风险。',actions:[action('repair',z.id,'趁隙修补')]});
 }
 return result;
}

export function tacticalActionState(b,p,option){
 const info=nightActionInfo(b,p,option.type);
 if(p.task?.type===option.type&&(p.task.target===option.target||option.target===undefined))return {...info,allowed:false,reason:'已在执行这项任务'};
 try{battleCommand(structuredClone(b),{type:option.type,person:p.id,target:option.target});return {...info,allowed:true,reason:''};}
 catch(error){return {...info,allowed:false,reason:error.message};}
}
