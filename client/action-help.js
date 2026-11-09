import {COMBAT,NIGHT_ACTIONS,DAY_ACTIONS,STORY_RULES,nightRepairHealth,nightActionCost} from '../src/balance.js';
import {CAMPFIRE_HEAT,CAMPFIRE_MAX_WOOD,CAMPFIRE_LOW_WOOD} from '../src/campfire.js';
import {dayActionFatigue} from '../src/fatigue.js';
import {resourceText} from '../src/descriptions.js';
export {resourceText} from '../src/descriptions.js';
import {applyCampaignAction} from '../src/campaign.js';
import {RESCUE_RULES,rescueBenefits} from '../src/rescue.js';
import {orderDuration} from '../src/night-orders.js';
import {STRIKE_RANGE} from '../src/rules.js';

export const costText=(ap,cost={})=>[ap?`${ap}行动`:'不耗行动',resourceText(cost)].filter(Boolean).join(' · ');
export function actionAvailability(s,action){try{applyCampaignAction(s,action);return {allowed:true,reason:''};}catch(e){return {allowed:false,reason:e.message};}}
export function storyEffect(s,c){
 const aid=rescueBenefits(s).aid,meal=s.people.some(p=>!p.dead&&p.id==='meng');
 if(c.effect==='meal')return `全员恐惧−${meal?STORY_RULES.meal.mengFear:STORY_RULES.meal.fear}、疲劳−${meal?STORY_RULES.meal.mengFatigue:STORY_RULES.meal.fatigue}；主角行动疲劳另+${dayActionFatigue(c.ap)}。`;
 if(c.effect==='delegate')return '次日自动转报登记并收到广播确认。需要可用互助留言处，不代送所选接应路线。';
 if(c.effect==='kit')return `永久将全员夜间紧急自救的基础耗时从${NIGHT_ACTIONS.times.aid}秒降至${NIGHT_ACTIONS.aidKitTime}秒；药耗不变。`;
 if(c.effect==='signal')return `全员恐惧−${RESCUE_RULES.signalFear}，暴露+${STORY_RULES.signal.exposure}；援助进度${aid}/${RESCUE_RULES.aidCap} → ${Math.min(RESCUE_RULES.aidCap,aid+1)}/${RESCUE_RULES.aidCap}，${aid<RESCUE_RULES.aidCap?'第28夜再少来1只普通生物':'援助减敌已达上限'}。`;
 if(c.effect==='letter')return '获得结局纪念物「留给后来者的纸条」，不增加物资或战力。';
 return c.gain?`立即获得${resourceText(c.gain)}。`:'';
}
export function nightActionInfo(b,p,type){
 const seconds=Number(orderDuration(p,type,b.aidKit).toFixed(2)),time=`${seconds}秒`;
 const data={
  repair:{name:'修补围栏',cost:resourceText(NIGHT_ACTIONS.costs[type]||{}),effect:`目标区耐久+${nightRepairHealth(p.skills.engineering)}，最高100；被占据的破口须先驱赶。`},
  guard:{name:'驱赶',cost:`每次攻击${COMBAT.strike.stamina}体力`,effect:`追击下令时本区已有生物，留出间隔攻击，打退后恢复分工；普攻距离${STRIKE_RANGE}，只造成短暂眩晕，不削减蓄力进度。`,time:'赶路后攻击'},
  brace:{name:'顶住',cost:`至少${COMBAT.brace.minimumStamina}体力`,effect:`目标区围栏伤害−${Number(((1-COMBAT.brace.fenceFactor)*100).toFixed(2))}%；每秒耗${COMBAT.workStamina}体力，结束另耗${COMBAT.brace.finishStamina}，冷却${COMBAT.brace.cooldown}秒。`},
  heavy:{name:'蓄力重击',cost:`${COMBAT.heavy.stamina}体力 · 无物资`,effect:`靠近单个目标后蓄力，造成${COMBAT.heavy.damage}伤害、眩晕${COMBAT.heavy.stun}秒并清空蓄力；冷却${COMBAT.heavy.cooldown}秒，可破甲与打断首领。需赶路、体力充足且目标在攻击距离内。`},
  throw:{name:'投掷打断',cost:resourceText(NIGHT_ACTIONS.costs[type]||{}),effect:`本区全体受基础${COMBAT.throw.damage}伤害、眩晕${COMBAT.throw.stun}秒；清空蓄势与攻击计时，可触发首领破招，伤害受护甲／弱点影响。`},
  bait:{name:'放置诱饵',cost:resourceText(NIGHT_ACTIONS.costs.bait),effect:`生效${COMBAT.bait.seconds}秒，吸引${COMBAT.bait.range}距离内普通生物；重撞兽和首领无效。`},
  compact:{name:'压实土道',cost:'无物资',effect:`本夜该区浅掘速度×${COMBAT.compact.factor}；现有掘行兽各受${COMBAT.compact.damage}伤害、眩晕${COMBAT.compact.stun}秒并清空进度，可封巢。`},
  aid:{name:'紧急自救',cost:resourceText(nightActionCost(p,'aid')),effect:`执行者健康至少${DAY_ACTIONS.treatment.severeHealth}，解除重伤期限；自救不恢复同伴。`},
  barricade:{name:'加固小屋',cost:resourceText(NIGHT_ACTIONS.costs[type]||{}),effect:`房屋耐久+${NIGHT_ACTIONS.houseHealth}，最高100。`},
  retreat:{name:'退守小屋',cost:'无物资',effect:`抵达后休整${NIGHT_ACTIONS.hold}秒，恐惧每秒−${COMBAT.sleepFear}，随后恢复分工；不按睡眠恢复疲劳。`},
  cancel:{name:'取消临时任务',cost:'免费',effect:'立即返还未用预留物资，恢复原岗位。',time:'立即'},
  stoke:{name:'拨火',cost:'免费',effect:`火势+${CAMPFIRE_HEAT.add}，至少${CAMPFIRE_HEAT.minimum}、最高${CAMPFIRE_HEAT.maximum}；需有火星与余柴，不清除湿污。`},
  addWood:{name:'添柴',cost:resourceText(NIGHT_ACTIONS.costs[type]||{}),effect:`余柴补满到${CAMPFIRE_MAX_WOOD}，火势+${CAMPFIRE_HEAT.add}、至少${CAMPFIRE_HEAT.minimum}、最高${CAMPFIRE_HEAT.maximum}；仅余柴低于${CAMPFIRE_LOW_WOOD}时可用。`},
  fire:{name:'重燃',cost:'免费',effect:`火势至少恢复至${CAMPFIRE_HEAT.minimum}；需已熄灭且有余柴，不清除湿污。`},
  extinguish:{name:'灭火',cost:'无物资',effect:'火势归零并停耗柴，保留余柴；可切断吞烬囊鲸吸焰。'},
  clearWet:{name:'清理湿污',cost:'无物资',effect:`解除中央篝火湿污，火势大于${CAMPFIRE_HEAT.active}时恢复全场增益。`}
 };
 return {...data[type],time:data[type]?.time||time};
}
