import {COMBAT} from '../src/balance.js';
import {FEAR_CONTEXT,FEAR_ASSIST_LIMIT,FEAR_RETREAT_LIMIT,FEAR_RETREAT_SECONDS,FEAR_RETREAT_COOLDOWN,FEAR_CALM_RATE,FEAR_GAIN,fearStatus,fearSituation} from '../src/fear.js';
import {campfireActive} from '../src/campfire.js';
const fmt=n=>Number(n.toFixed(2)).toString();

export function fearPanel(p,b=null){
 const status=fearStatus(p,b),contextActive=b&&!b.finished&&!status.retreat&&(p.wound!=='severe'||p.task);
 const situation=fearSituation(contextActive?b:null,p),sources=[];
 if(situation.isolation)sources.push(`独自面对${situation.threats}只近敌：每秒+${fmt(situation.isolation)}`);
 if(situation.breach)sources.push(`附近存在破口：每秒+${fmt(situation.breach)}`);
 if(situation.calm)sources.push(`健康同伴在附近：每秒−${FEAR_CONTEXT.calm}`);
 if(b&&!b.finished&&campfireActive(b))sources.push(`有效篝火：每秒−${COMBAT.fire.fear}`);
 if(status.retreat?.stage==='calm')sources.push(`屋内镇定：每秒−${FEAR_CALM_RATE}`);
 return `<section class="card" data-testid="fear-effects"><h3>恐惧 · ${Math.round(p.fear)} / 100</h3><p class="copy" data-testid="fear-state">${status.label} · 普通攻击间隔${fmt(status.attackInterval)}秒</p><p class="mini">${status.detail}</p>${sources.length?`<p class="mini" data-testid="fear-sources">当前情境：${sources.join('；')}。</p>`:''}${status.cooldown?`<p class="mini">退却冷却剩余${status.cooldown}秒，期间不会再次自动退却。</p>`:''}<p class="mini">每次攻击伤害不变；恐惧不再延长修补、拨火等作业时间，手动指令不会因恐惧拒绝或中断。超过${FEAR_ASSIST_LIMIT}停止远距离自动协防；超过${FEAR_RETREAT_LIMIT}且被近身攻击时自动暂退小屋，镇定${FEAR_RETREAT_SECONDS}秒后恢复原岗位，冷却${FEAR_RETREAT_COOLDOWN}秒；手动指令可以立即接管。</p><p class="mini">近身受袭时，每只每秒+${FEAR_GAIN.contact}；独自面对多只近敌，每多1只每秒+${FEAR_GAIN.isolation}，最高+${FEAR_GAIN.isolationMax}；附近破口每秒+${FEAR_GAIN.breach}；目睹${FEAR_CONTEXT.witnessRange}距离内同伴新重伤+${FEAR_GAIN.witness}。夜末出现过破口时+${FEAR_GAIN.nightBreach}。${FEAR_CONTEXT.allyRange}距离内有健康同伴可每秒−${FEAR_CONTEXT.calm}，有效篝火另减${COMBAT.fire.fear}；范围均为游戏内距离。</p></section>`;
}
