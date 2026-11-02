import {BOSS_TWIN_FORMS} from './boss-content.js';
import {FEAR_GAIN} from './fear.js';
import {ENEMIES,ENEMY_WINDUP} from './content.js';
import {ENEMY_MELEE_RANGE} from './rules.js';
import {enemyDamageProfile} from './enemy-damage.js';
import {COMBAT,NIGHT_ACTIONS} from './balance.js';
import {CAMPFIRE_HEAT,CAMPFIRE_MAX_WOOD,CAMPFIRE_LOW_WOOD} from './campfire.js';
import {percent,number} from './descriptions.js';
function notes(id){
 const e=ENEMIES[id],t=COMBAT.trap;
 const data={
 skitter:{behavior:`小型灵活生物，第${ENEMIES.skitter.day}天起出现。生命仅${ENEMIES.skitter.hp}，移动速度${ENEMIES.skitter.speed}距离／秒；每${ENEMIES.skitter.interval}秒啃咬一次围栏。优先寻找破口，再比较围栏耐久、防御设施、剩余陷阱与附近守卫；接近期间沿院外绕行，寻找更薄弱的防区，接触防线后专注攻击该处。完整围栏仍需啃破才能入院。`,counter:`补齐低耐久防线、分散巡守，可把它引向准备好的防区。陷阱基础伤害${t.damage}，翻刺持续造成伤害。及时驱赶、投掷和诱饵也能应对。`},
 walker:{behavior:'持续抓挠围栏；没有额外特殊能力。',counter:`巡守驱赶，薄弱处及时修补。陷阱触发时造成${t.damage}伤害并眩晕${t.stun}秒；有效中央篝火在全场削弱攻击。`},
 climber:{behavior:`灵活型，接近防线和入院后的移动迅速；无翻刺时积累翻越进度，基础${ENEMY_WINDUP.climb}秒即可越过完整围栏入院；攻击和眩晕会延缓进度。`,counter:`翻刺直接阻止翻越；埋网使攀爬速度降到${percent(COMBAT.meshClimbFactor)}%，有效中央篝火使全场攀爬速度再乘${percent(COMBAT.fire.climbFactor)}%。自动攻击削减${COMBAT.strike.progress}进度，投掷可清零进度。`},
 rammer:{behavior:`靠近后每${e.interval}秒撞击一次围栏，一次损坏${e.damage}耐久。生命较高，诱饵对它无效。`,counter:`有剩余陷阱时可取消一次撞击，并造成${t.damage}伤害、眩晕${t.rammerStun}秒；人物就位顶住使围栏伤害×${COMBAT.brace.fenceFactor}。投掷清零攻击计时，能推迟撞击。`},
 caller:{behavior:`蓄叫进度达到${ENEMY_WINDUP.call}秒时召来1只灰行者。每只最多召援一次，全夜最多额外召来${COMBAT.callLimit}只。`,counter:`优先处理正在蓄叫的个体；自动攻击削减${COMBAT.strike.progress}进度，投掷对本区全体造成${COMBAT.throw.damage}伤害、眩晕${COMBAT.throw.stun}秒，并清零蓄叫进度。`},
 burrower:{behavior:`灵活型，从两个后栏方向快速接近；没有埋网时，基础${ENEMY_WINDUP.dig}秒浅掘后可绕过完整围栏入院。`,counter:`埋网直接阻止浅掘。压实土道基础耗时${NIGHT_ACTIONS.times.compact}秒，本夜该区浅掘速度降到${percent(COMBAT.compact.factor)}%；同时使现有掘行兽各受${COMBAT.compact.damage}伤害、眩晕${COMBAT.compact.stun}秒，并清零浅掘进度。`},
 quencher:{behavior:`接触防线后，每${ENEMY_WINDUP.spray}秒向中央篝火喷污，无距离限制；湿污期间全场篝火增益暂停。`,counter:`普通喷污每次损失${COMBAT.spray.loss}火势、湿污${COMBAT.spray.wet}秒；有防护时为${COMBAT.spray.protectedLoss}火势、${COMBAT.spray.protectedWet}秒。清理湿污基础需${NIGHT_ACTIONS.times.clearWet}秒。余柴上限${CAMPFIRE_MAX_WOOD}；有火星和余柴时拨火${NIGHT_ACTIONS.times.stoke}秒免费，低于${CAMPFIRE_LOW_WOOD}时添柴${NIGHT_ACTIONS.times.addWood}秒并补满。拨火、重燃和添柴让火势+${CAMPFIRE_HEAT.add}、至少${CAMPFIRE_HEAT.minimum}、最高${CAMPFIRE_HEAT.maximum}；喷污不扣柴料。可投掷打断蓄势或提前驱赶。`}
 };
 return data[id]||{};
}
// Only actual encounters unlock entries, never future schedules or previews.
export function bestiaryEntries(state,battle=null){
 const known=new Set([...(state.flags?.seenTypes||[]),...(battle?.seen||[])]);
 return Object.entries(ENEMIES).map(([id,enemy])=>{
  if(!known.has(id))return {id,known:false};
  const factor=id==='rammer'?COMBAT.fire.rammerFactor:COMBAT.fire.damageFactor,profile=enemyDamageProfile({type:id}),houseDamage=COMBAT.houseDamage*(enemy.boss?COMBAT.bossHouseFactor:1);
  const form=id==='broodmother'?{type:id,bossBrood:true}:id==='twinvein'?{type:id,bossForm:1}:null;
  const formProfile=form&&enemyDamageProfile(form);
  return {id,known:true,...enemy,...notes(id),fireReduction:Number(percent(1-factor)),houseDamage,personDamage:profile.person,personFear:FEAR_GAIN.contact,personRange:ENEMY_MELEE_RANGE,fireHouseDamage:Number(number(houseDamage*factor)),firePersonDamage:Number(number(profile.person*factor)),formDamage:formProfile?`${id==='broodmother'?'穴灯幼兽':BOSS_TWIN_FORMS.map(f=>f.name).join('、')}：各每秒损失${formProfile.person}健康；有效篝火下降为${number(formProfile.person*factor)}。`:''};
 });
}
