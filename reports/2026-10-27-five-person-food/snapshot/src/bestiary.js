import {FEAR_GAIN} from './fear.js';
import { ENEMIES } from './content.js';
import {ENEMY_MELEE_RANGE} from './rules.js';
import {enemyDamageProfile} from './enemy-damage.js';

const NOTES={
 skitter:{behavior:'小型灵活生物，第5天起出现。生命仅12，移动速度66距离／秒；每秒啃咬一次围栏。优先寻找破口，再比较围栏耐久、翻刺、埋网、铃绳、剩余陷阱与附近守卫；接近期间每1.25秒重新观察，明显更薄弱时沿院外绕行换目标，不穿墙。接触防线后专注攻击该处，完整围栏仍需啃破才能入院。',counter:'补齐低耐久防线、分散巡守，可把它引向准备好的防区。陷阱基础伤害18，能直接击退普通裂隙鼠；翻刺持续造成伤害。它血量很低，及时驱赶或投掷都有效。诱饵能暂时吸引它，持续期间不会自行改去别处。'},
 walker:{behavior:'持续抓挠围栏；没有额外特殊能力。',counter:'巡守驱赶，薄弱处及时修补。陷阱触发时造成18伤害并眩晕2秒；有效中央篝火在全场削弱攻击。'},
 climber:{behavior:'灵活型，接近防线和入院后的移动迅速；无翻刺时积累翻越进度，基础6秒即可越过完整围栏入院；攻击和眩晕会延缓进度。',counter:'翻刺直接阻止翻越；埋网使攀爬速度降到35%，有效中央篝火使全场攀爬速度再乘65%。自动攻击削减3进度，投掷可清零进度。'},
 rammer:{behavior:'靠近后每4秒撞击一次围栏，一次损坏15耐久。生命较高，诱饵对它无效。',counter:'有剩余陷阱时可取消一次撞击，并造成18伤害、眩晕3秒；人物就位顶住使围栏伤害×0.45。投掷清零攻击计时，能推迟撞击。'},
 caller:{behavior:'蓄叫进度达到3.5秒时召来1只灰行者。每只最多召援一次，全夜最多额外召来2只。',counter:'优先处理正在蓄叫的个体；自动攻击削减3进度，投掷对本区全体造成10伤害、眩晕2秒，并清零蓄叫进度。'},
 burrower:{behavior:'灵活型，从两个后栏方向快速接近；没有埋网时，基础7秒浅掘后可绕过完整围栏入院。',counter:'埋网直接阻止浅掘。压实土道耗时5秒，本夜该区浅掘速度降到35%；同时使现有掘行兽各受15伤害、眩晕4秒，并清零浅掘进度。'},
 quencher:{behavior:'接触防线后，每4秒向中央篝火喷污，无距离限制；湿污期间全场篝火增益暂停。',counter:'中央火塘的防护使每次喷污损失9火势、湿污4秒；清理湿污需4秒。余柴上限1；有火星和余柴时拨火2秒免费，低于0.25时添柴4秒耗1建材并补满到1。拨火、重燃和添柴都让火势+40、至少60、最高100；熄灭后有余柴时重燃免费。喷污不扣柴料。可投掷打断蓄势，或提前驱赶喷污者。'}
};

// Only actual encounters unlock entries. The day, intel and future schedule do not.
export function bestiaryEntries(state,battle=null){
 const known=new Set([...(state.flags?.seenTypes||[]),...(battle?.seen||[])]);
 return Object.entries(ENEMIES).map(([id,enemy])=>{
  if(!known.has(id))return {id,known:false};
  const factor=id==='rammer'?.85:.7,profile=enemyDamageProfile({type:id});
  return {id,known:true,...enemy,...NOTES[id],fireReduction:id==='rammer'?15:30,
   houseDamage:enemy.boss?3.6:1.8,personDamage:profile.person,personFear:FEAR_GAIN.contact,personRange:ENEMY_MELEE_RANGE,fireHouseDamage:Number(((enemy.boss?3.6:1.8)*factor).toFixed(2)),firePersonDamage:Number((profile.person*factor).toFixed(2)),
   formDamage:id==='broodmother'?'穴灯幼兽：每秒损失1.2健康；有效篝火下降为0.84。':id==='twinvein'?'紫脉、青脉：各每秒损失2.4健康；有效篝火下降为1.68。复苏后数值相同。':''};
 });
}
