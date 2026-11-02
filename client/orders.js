import {NIGHT_ROLES,ZONES} from '../src/content.js';
import {NIGHT_ACTIONS} from '../src/balance.js';
import {orderDuration} from '../src/night-orders.js';
import {isIndoors,sleepInterrupted} from '../src/shelter.js';
import {fearStatus} from '../src/fear.js';
import {earlyWarningTarget} from '../src/cooperation.js';

const zoneName=id=>ZONES.find(z=>z.id===id)?.name||'防区';
const taskNames={move:'移动定位',guard:'驱赶',repair:'修补',fire:'重燃',stoke:'拨火',addWood:'添柴',extinguish:'灭火',brace:'顶住',throw:'投掷打断',bait:'放置诱饵',compact:'压实土道',clearWet:'清理湿污',retreat:'回屋休整',aid:'紧急自救',barricade:'加固小屋'};

export function assignmentText(p){return p.nightRole==='sleep'?'睡眠 · 小屋':`${NIGHT_ROLES[p.nightRole]} · ${zoneName(p.zone)}`;}
export function resumeText(p){return p.nightRole==='sleep'?'回小屋睡眠':p.nightRole==='support'?`恢复自动支援 · 重点${zoneName(p.zone)}`:`返回${zoneName(p.zone)}巡守`;}

function baseOrderStatus(p,b){
 if(p.dead)return {role:'已死亡',current:'无法行动',after:'无法再救治或执行任务',activity:'已死亡'};
 const role=assignmentText(p),interrupted=p.nightRole==='sleep'&&sleepInterrupted(b,p),resume=interrupted?'回小屋休息 · 本夜无睡眠收益':resumeText(p),t=p.task;
 if(b.finished)return {role,current:'本夜已结束',after:'下次入夜继续此分工',activity:'已结束'};
 if(p.wound==='severe'&&t?.type!=='aid')return {role,current:'重伤退守，暂不能执行岗位',after:`急救稳定后，${resume}`,activity:'重伤退守'};
 if(!t)return {role,current:p.nightRole==='sleep'?(interrupted?`${isIndoors(b,p)?'屋内休息':'正在回屋休息'} · 睡眠已中断`:isIndoors(b,p)?'屋内睡眠':'正在回屋睡眠'):p.nightRole==='support'?'按分工自动支援 / 待命':`按分工巡守${zoneName(p.zone)}`,after:resume,activity:p.nightRole==='sleep'?(interrupted?'睡眠已中断':isIndoors(b,p)?'屋内睡眠':'回屋途中'):p.nightRole==='support'?'自动支援':'巡守'};
 const source=t.assist?'自动支援':t.automatic?'自动':'临时',name=taskNames[t.type]||'任务';
 const target=['retreat','aid','barricade'].includes(t.type)?'小屋':t.type==='move'?'目的地':['fire','stoke','addWood','extinguish','clearWet'].includes(t.type)?'中央篝火':zoneName(t.target);
 let activity=b.paused?'待出发':t.assist?'前往支援':'赶路中',current=`${source}${name} · ${b.paused?'待执行，继续后前往':'赶往'}${target}`;
 if(t.stage!=='work'&&(t.type==='move'||t.type==='retreat'))current+=`，到达后${t.type==='move'?'警戒':'休整'}${NIGHT_ACTIONS.hold}秒`;
 if(t.stage==='work'){
  if(t.type==='guard'){const remaining=b.enemies.filter(e=>t.threatIds?.includes(e.id)&&e.hp>0&&e.mode!=='retreat'&&(!t.assist||e.zone===t.target)).length;activity=t.automatic?'自动支援驱赶':'临时驱赶';current=`${activity}${target} · 本次剩余${remaining}只`;}else{
   const remaining=Math.max(0,Math.ceil(orderDuration(p,t.type,b.aidKit)-(t.progress||0)));activity=t.type==='move'?'临时警戒':t.type==='retreat'?'临时休整':`${source}${name}`;
   current=`${activity} · ${target} · 剩余${remaining}秒`;
  }
  if(b.paused)current+='（已暂停）';
 }
 return {role,current,after:resume,activity};
}

export function orderStatus(p,b){
 const result=baseOrderStatus(p,b),fear=fearStatus(p,b);
 if(!fear.retreat&&earlyWarningTarget(b,p)){result.current+=' · 预警提前就位';result.activity='预警就位';}
 if(!b.finished&&fear.retreat){result.current=`${fear.label} · ${fear.detail}`;result.activity=fear.label;}
 return {...result,fear:`恐惧${Math.round(p.fear)} · ${b.finished?'已结算':fear.label}${!b.finished?` · 出手${Number(fear.attackInterval.toFixed(2))}秒`:''}`};
}
