// Shared by the simulation and its task preview, so the displayed countdown
// has the same end condition as the temporary order.
import {fatigueEffects} from './fatigue.js';
export const TEMPORARY_HOLD_SECONDS=8;

export function orderDuration(person,type,aidKit=false){
 // Holding a position/brace is a fixed interval, not slower productive work.
 if(['move','retreat','brace'].includes(type))return TEMPORARY_HOLD_SECONDS;
 const seconds={repair:5-Math.min(1.5,person.skills.engineering*.5),barricade:4,fire:4,stoke:2,addWood:4,extinguish:4,brace:8,throw:2,bait:3,compact:5,clearWet:4,aid:aidKit?4:6}[type]||4;
 return seconds/fatigueEffects(person.fatigue).work;
}
