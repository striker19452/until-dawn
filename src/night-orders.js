import {NIGHT_ACTIONS,COMBAT} from './balance.js';
// Shared by the simulation and its task preview, so the displayed countdown
// has the same end condition as the temporary order.
import {fatigueEffects} from './fatigue.js';
export const TEMPORARY_HOLD_SECONDS=NIGHT_ACTIONS.hold;

export function orderDuration(person,type,aidKit=false){
 // Holding a position/brace is a fixed interval, not slower productive work.
 if(['move','retreat','brace'].includes(type))return NIGHT_ACTIONS.hold;
 const seconds=type==='repair'?COMBAT.repair.seconds-Math.min(COMBAT.repair.maxSkillSpeed,person.skills.engineering*COMBAT.repair.skillSpeed):type==='aid'&&aidKit?NIGHT_ACTIONS.aidKitTime:NIGHT_ACTIONS.times[type]??4;
 return seconds/fatigueEffects(person.fatigue).work;
}
