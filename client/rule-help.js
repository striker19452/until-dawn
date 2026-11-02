import {PRODUCTION,DAY_ACTIONS,WORK,RATIONS,COMBAT,NIGHT_ACTIONS,workshopOutput,workshopCost,repairHealth} from '../src/balance.js';
import {facility,farmingYield} from '../src/rules.js';
import {SLEEP_FATIGUE_RECOVERY} from '../src/fatigue.js';
import {CAMPFIRE_HEAT,CAMPFIRE_MAX_WOOD,CAMPFIRE_LOW_WOOD,CAMPFIRE_BURN_RATE,CAMPFIRE_DECAY} from '../src/campfire.js';
import {number,percent,resourceText} from '../src/descriptions.js';
export function workDescriptions(s,p){
 const workshop=facility(s,'workshop'),z=s.zones.find(z=>z.id===p.zone)||s.zones[0];
 return {
 rest:`健康+${WORK.restHealth}、疲劳−${WORK.restFatigue}、恐惧−${WORK.restFear}；回血需食水充足。`,
 farm:facility(s,'garden')?`食物+${farmingYield(p.skills.survival)}；疲劳+${WORK.fatigue}。`:'需要可用菜畦，当前会改为休息。',
 water:`净水+${WORK.water}；疲劳+${WORK.fatigue}。`,forage:`燃料+${WORK.forage}；疲劳+${WORK.fatigue}。`,
 craft:`在重点防区布置${Math.max(0,Math.min(workshopOutput(workshop),COMBAT.trap.max-z.traps))}只陷阱；耗${p.reserved?.materials??workshopCost(workshop?.branch)}建材，疲劳+${WORK.fatigue}。`,
 repair:`重点防区耐久+${number(Math.min(z.max-z.hp,repairHealth(p.skills.engineering)))}；耗${WORK.repairCost}建材，疲劳+${WORK.fatigue}。`,
 care:`全员非重伤者健康+${WORK.careHealth}，全员恐惧−${WORK.careFear}；疲劳+${WORK.fatigue}。回血需食水充足。`,
 scout:`每人暴露−${WORK.scoutExposure}；今晚预警距离+${WORK.scoutRange}，多人侦察不叠加；疲劳+${WORK.fatigue}。`,
 cook:facility(s,'stove')&&p.id==='meng'&&p.wound!=='severe'?`今晚每人少耗${RATIONS.cookSavingPerPerson}食物，全队最低仍需${RATIONS.minimumFood}；疲劳+${WORK.fatigue}。`:'需要可用公共灶，且孟姐不能重伤。',
 escort:`随行搜索，多带物资并降低深搜风险；疲劳+${WORK.fatigue}。`
 };
}
export const nightRoleDescriptions=()=>({guard:'巡守重点防区、驱赶生物，空闲时协防。',support:'免费拨火，按预算修栏、添柴，优先照料本区。',sleep:`屋内睡眠，夜末疲劳−${SLEEP_FATIGUE_RECOVERY}；执行临时指令会失去当晚睡眠收益。`});
export function campfireMaintenanceDescription(){return `余柴上限${CAMPFIRE_MAX_WOOD}，低于${CAMPFIRE_LOW_WOOD}时花${resourceText(NIGHT_ACTIONS.costs.addWood)}补满，跨天保留。燃烧每秒耗${CAMPFIRE_BURN_RATE}；有余柴可免费拨火。雨天火势衰减更快。入夜启用且空柴堆时自动补柴。火势>${CAMPFIRE_HEAT.active}且无湿污时，全场生物减伤、减慢攀爬，全员回体力和减恐惧，无距离限制。`;}
export function campfireEffectsDescription(){return `中央篝火全场生效：普通生物伤害−${percent(1-COMBAT.fire.damageFactor)}%（重撞兽−${percent(1-COMBAT.fire.rammerFactor)}%）、攀爬速度×${COMBAT.fire.climbFactor}；全员体力每秒恢复${COMBAT.fire.stamina}、恐惧−${COMBAT.fire.fear}。需火势>${CAMPFIRE_HEAT.active}且无湿污。`;}
export function campfireDetails(fire,weather,active){
 const reasons=[];if(!fire||fire.heat<=0)reasons.push('未点燃，请点火');else if(fire.heat<=CAMPFIRE_HEAT.active)reasons.push('火势不足，请拨火或添柴');if(fire?.wet>0)reasons.push(`湿污还剩${Math.ceil(fire.wet)}秒，清理或等待消退`);
 return `<div class="notice ${active?'':'danger'}" data-testid="campfire-current">${active?'当前生效：以下效果覆盖全场。':`增益暂停：${reasons.join('；')}。`}</div><p class="copy">火势 ${number(fire?.heat||0)} · 余柴 ${number(fire?.wood||0)} / ${CAMPFIRE_MAX_WOOD}</p><h3>生效时的具体收益</h3><dl class="exposure-sources"><div><dt>生物伤害</dt><dd>除重撞兽外，所有生物造成的伤害−${percent(1-COMBAT.fire.damageFactor)}%；重撞兽−${percent(1-COMBAT.fire.rammerFactor)}%。</dd></div><div><dt>攀爬速度</dt><dd>攀爬者速度×${COMBAT.fire.climbFactor}（降低${percent(1-COMBAT.fire.climbFactor)}%），可与埋网减速叠加。</dd></div><div><dt>全员体力</dt><dd>每秒恢复${COMBAT.fire.stamina}点（无增益时为${COMBAT.fire.normalStamina}点）；实际恢复受个人疲劳影响，上限为个人最大体力。</dd></div><div><dt>全员恐惧</dt><dd>每秒降低${COMBAT.fire.fear}点。</dd></div></dl><h3>生效条件</h3><p class="copy">火势必须大于${CAMPFIRE_HEAT.active}，且没有湿污。火势≤${CAMPFIRE_HEAT.active}、熄灭或被喷污时，以上增益暂停；恢复条件后自动生效。火势更高不会继续提高增益数值。</p><h3>柴料与维护</h3><p class="copy">${campfireMaintenanceDescription()}<br>有火星和余柴时可免费拨火，基础${NIGHT_ACTIONS.times.stoke}秒；熄灭后有余柴可免费重燃，基础${NIGHT_ACTIONS.times.fire}秒。拨火、重燃或添柴均让火势+${CAMPFIRE_HEAT.add}，至少${CAMPFIRE_HEAT.minimum}、最高${CAMPFIRE_HEAT.maximum}；不会清除湿污。</p><h3>雨天影响</h3><p class="copy" data-testid="campfire-weather">${weather==='rain'?'当前下雨，火势衰减更快。':'当前没有下雨。'}火势每秒衰减：平时${CAMPFIRE_DECAY.normal}、雨天${CAMPFIRE_DECAY.rain}；余柴消耗不变。雨水不会产生喷污湿污。</p><p class="mini">查看时夜战暂停；关闭面板后，点击「继续」推进。</p>`;
}
