import {campfireMaintenance} from '../src/campfire.js';
import {tacticalActionState} from './tactics.js';

// Presentation only: every order still goes through the existing simulation.
export function quickOrders(b,p,zone){
 const fire=b.fires.find(f=>f.id==='central');
 const care=fire?.wet>0?'clearWet':campfireMaintenance(fire,b.resources.materials);
 const make=(type,label,target=zone)=>({type,label,target,...tacticalActionState(b,p,{type,target})});
 const primary=[make('heavy','蓄力重击'),make('guard','驱赶'),make('repair','修补'),make(care,{clearWet:'清理篝火',stoke:'拨火',fire:'重燃',addWood:'添柴'}[care],'central')];
 const threats=b.enemies.filter(e=>e.hp>0&&e.mode!=='retreat'&&e.zone===zone);
 const contextual=[];
 if(p.wound==='severe')contextual.push(make('aid','紧急自救',undefined));
 if(threats.some(e=>e.type==='rammer')||b.boss?.phase==='charge'&&b.boss.zone===zone)contextual.push(make('brace','顶住'));
 if(threats.some(e=>e.type==='burrower')||b.boss?.mounds?.some(m=>m.zone===zone&&!m.sealed))contextual.push(make('compact','压实土道'));
 if(p.task)contextual.push(make('cancel','取消任务',undefined));
 const secondary=[make('retreat','回屋休整',undefined),make('brace','顶住'),make('compact','压实土道'),make('bait','放置诱饵'),make('barricade','加固小屋',undefined),make('extinguish','灭火','central'),make('cancel','取消任务',undefined)].filter(option=>!contextual.some(c=>c.type===option.type));
 return {primary,contextual,secondary};
}
