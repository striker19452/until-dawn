export const CENTRAL_FIRE={id:'central',x:240,y:390};
export const CAMPFIRE_FOOTPRINT={x:27,y:14};
export const CAMPFIRE_MAX_WOOD=1;
export const CAMPFIRE_LOW_WOOD=.25;
export const CAMPFIRE_BURN_RATE=.006;
export const campfireWood=value=>Number.isFinite(value)?Math.max(0,Math.min(CAMPFIRE_MAX_WOOD,value)):0;
export const campfireHeatDecay=weather=>weather==='rain'?.65:.36;
export const campfireNeedsWood=fire=>campfireWood(fire?.wood)<CAMPFIRE_LOW_WOOD;
export const campfireMaintenance=(fire,materials=Infinity)=>campfireNeedsWood(fire)&&materials>=1||!(fire?.wood>0)?'addWood':fire.heat>0?'stoke':'fire';
export const tendedHeat=heat=>Math.max(60,Math.min(100,heat+40));

// The single central hearth affects the whole encounter, regardless of distance.
export function campfireActive(battle){return !!battle?.fires?.some(f=>f.id==='central'&&f.heat>15&&f.wet<=0);}

// Old saves may still contain perimeter brazier flags; only this hearth is lit.
export function yardFires(campaign,battle=null){
 if(battle)return battle.fires.filter(f=>f.id==='central');
 // Daytime shows a cold hearth; centralFire only controls lighting at nightfall.
 return [{...CENTRAL_FIRE,heat:0,wet:0,shade:true}];
}
