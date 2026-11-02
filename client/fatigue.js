import {WORK,DAY_ACTIONS,PRODUCTION,COMBAT,RECOVERY} from '../src/balance.js';
import {fatigueEffects,MORNING_FATIGUE_RECOVERY,SLEEP_FATIGUE_RECOVERY,DAY_FATIGUE_PER_AP} from '../src/fatigue.js';

const fmt=value=>Number(value.toFixed(2)).toString();
export function fatiguePanel(person){
 const effects=fatigueEffects(person.fatigue);
 return `<section class="card" data-testid="fatigue-effects"><h3>疲劳影响 · 随数值平滑变化</h3><div class="stat-grid">${[['移动速度',effects.movement],['夜间作业效率',effects.work],['体力恢复',effects.recovery]].map(([label,value])=>`<div class="stat"><span>${label}</span><b>${fmt(value*100)}%</b></div>`).join('')}</div><p class="mini">体力每秒恢复：常态${fmt(COMBAT.fire.normalStamina*effects.recovery)}，有效篝火下${fmt(COMBAT.fire.stamina*effects.recovery)}。作业效率越低，同一动作耗时越长；例如80%效率需1.25倍时间。</p>${person.id==='hero'?`<p class="mini">白天每消耗1行动，疲劳+${DAY_FATIGUE_PER_AP}；主动休整不增加疲劳。</p>`:''}<p class="mini">夜间按工作量×${RECOVERY.workFatigue}增加疲劳，最多+${RECOVERY.maxWorkFatigue}。巡守、支援岗位不恢复疲劳；整夜未被叫醒才有睡眠夜末−${SLEEP_FATIGUE_RECOVERY}；开始执行临时指令后取消当晚睡眠收益，回屋也不恢复。非重伤者清晨−${MORNING_FATIGUE_RECOVERY}；白天同伴休息−${WORK.restFatigue}，主动休整−${DAY_ACTIONS.rest.fatigue}。耐候公共灶另在夜末−${PRODUCTION.stove.steadyFatigue}。</p></section>`;
}
