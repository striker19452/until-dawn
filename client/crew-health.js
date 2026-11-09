import {COMBAT} from '../src/balance.js';
import {formatDurability} from '../src/format.js';
import {maxStamina} from '../src/rules.js';
import {isIndoors} from '../src/shelter.js';

// Health is independent of stamina: a rested survivor can still need treatment.
export function healthStatus(p,b=null){
 const health=Math.max(0,Math.min(100,p.health));
 if(p.dead||health===0)return {health:0,value:'0',tone:'dead',label:'已死亡'};
 const tone=p.wound==='severe'||health<=COMBAT.severeHealth?'critical':health<70?'wounded':'stable';
 const label=p.wound==='severe'?'重伤':isIndoors(b,p)?'屋内':p.wound==='recovering'?'恢复中':health<100?'受伤':p.stamina<=COMBAT.brace.minimumStamina?'体力低':p.fear>70?'恐惧高':p.fatigue>=70?'疲劳高':'健康';
 return {health,value:String(formatDurability(health)),tone,label};
}

export function crewHealthMarkup(people,b,selected,{escape}){
 return people.map(p=>{
  const status=healthStatus(p,b),stamina=Math.max(0,Math.min(100,p.stamina/maxStamina(p)*100));
  return `<button class="crew-person" data-action="crew-health" data-person="${escape(p.id)}" data-condition="${status.tone}" aria-pressed="${p.id===selected}" aria-label="${escape(p.name)}，健康${status.value}/100，${status.label}，体力${Math.ceil(p.stamina)}/${maxStamina(p)}，点击查看与处理"><span class="crew-person-heading"><b>${escape(p.name)}</b><strong>${Math.ceil(status.health)}</strong></span><span class="crew-health-track" aria-hidden="true"><i style="width:${status.health}%"></i></span><span class="crew-person-detail"><span>${status.label}</span><span class="crew-stamina-track" aria-hidden="true" title="体力"><i style="width:${stamina}%"></i></span></span></button>`;
 }).join('');
}
