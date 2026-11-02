// Fatigue has a smooth cost from the first point, with usable lower bounds.
export function fatigueEffects(value=0){
 const ratio=(Number.isFinite(value)?Math.max(0,Math.min(100,value)):0)/100;
 return {movement:1-.3*ratio,work:1-.4*ratio,recovery:1-.5*ratio};
}

export const MORNING_FATIGUE_RECOVERY=10;
export const SLEEP_FATIGUE_RECOVERY=22;
export const DAY_FATIGUE_PER_AP=5;
export const dayActionFatigue=ap=>ap*DAY_FATIGUE_PER_AP;
