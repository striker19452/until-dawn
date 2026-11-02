import {ZONES} from './content.js';
import {isIndoors} from './shelter.js';
import {enemyPersonTarget} from './enemy-target.js';

// Positive fear gains; calming rates and starting fear are independent.
export const FEAR_GAIN={contact:1,isolation:.8,isolationMax:1.6,breach:.24,witness:16,nightBreach:16};
export const FEAR_ASSIST_LIMIT=70;
export const FEAR_RETREAT_LIMIT=90;
export const FEAR_RETREAT_SECONDS=4;
export const FEAR_RETREAT_COOLDOWN=20;
export const FEAR_CALM_RATE=1;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const active=e=>e.hp>0&&e.mode!=='retreat';
export function fearEffects(value=0){
 const fear=Number.isFinite(value)?Math.max(0,Math.min(100,value)):0;
 return {attackInterval:1.8+.009*fear,autoAssist:fear<=FEAR_ASSIST_LIMIT};
}

export function fearSituation(b,p){
 if(!b||p.dead||isIndoors(b,p))return {allies:0,threats:0,isolation:0,breach:0,calm:0,underAttack:false};
 const allies=b.people.filter(q=>q.id!==p.id&&!q.dead&&q.wound!=='severe'&&q.health>=30&&!isIndoors(b,q)&&distance(p,q)<=90).length;
 const enemies=b.enemies.filter(e=>active(e)&&e.mode!=='approach');
 const threats=enemies.filter(e=>distance(p,e)<=100).length;
 const breach=b.zones.some(z=>z.hp===0&&distance(p,ZONES.find(q=>q.id===z.id))<=100)?FEAR_GAIN.breach:0;
 return {allies,threats,isolation:allies?0:Math.min(FEAR_GAIN.isolationMax,Math.max(0,threats-1)*FEAR_GAIN.isolation),breach,calm:allies?.08:0,
  underAttack:enemies.some(e=>enemyPersonTarget(b,e)?.id===p.id)};
}

export function fearRetreat(b,p){return b?.fearRetreats?.[p.id]||null;}
export function mayFearRetreat(b,p,situation=fearSituation(b,p)){
 return !p.dead&&p.wound!=='severe'&&p.nightRole!=='sleep'&&p.fear>FEAR_RETREAT_LIMIT
  &&(!p.task||p.task.automatic)&&!isIndoors(b,p)&&situation.underAttack
  &&!fearRetreat(b,p)&&(b.fearCooldowns?.[p.id]||0)<=b.elapsed;
}
export function endFearRetreat(b,p){
 if(!fearRetreat(b,p))return false;
 delete b.fearRetreats[p.id];b.fearCooldowns??={};b.fearCooldowns[p.id]=b.elapsed+FEAR_RETREAT_COOLDOWN;return true;
}
export function witnessInjury(b,injured){
 const witnesses=b.people.filter(p=>p.id!==injured.id&&!p.dead&&!isIndoors(b,p)&&distance(p,injured)<=120);
 for(const p of witnesses)p.fear=Math.min(100,p.fear+FEAR_GAIN.witness);
 return witnesses;
}

export function fearStatus(p,b){
 const effects=fearEffects(p.fear),retreat=fearRetreat(b,p),manual=p.task&&!p.task.automatic;
 if(b?.finished)return {...effects,label:'本夜已结束',detail:'情绪已随本夜结果结算；下一夜继续原分工。',cooldown:0,retreat:null,manual:false};
 const cooldown=Math.max(0,Math.ceil((b?.fearCooldowns?.[p.id]||0)-(b?.elapsed||0)));
 const label=retreat?(retreat.stage==='calm'?'屋内镇定':'恐惧退却'):manual?'手动任务优先':!effects.autoAssist?'恐惧偏高 · 保守防守':p.fear>30?'出手犹豫':'保持镇定';
 const detail=retreat?`恐惧超过90并遭到近身攻击；${retreat.stage==='calm'?`镇定剩余${Math.max(0,Math.ceil(FEAR_RETREAT_SECONDS-retreat.progress))}秒`:'正在前往小屋，抵达后镇定4秒'}，随后恢复原岗位。`
  :manual?'恐惧不会中断或拒绝这条指令；作业不因恐惧减速。'
  :!effects.autoAssist?'恐惧超过70，暂停远距离自动协防；仍守本区、照料篝火并接受手动指令。'
  :'按原分工行动；恐惧越高，普通攻击出手间隔越长。';
 return {...effects,label,detail,cooldown,retreat,manual:!!manual};
}
