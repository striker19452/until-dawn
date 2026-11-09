export const BUILDING_MAX_HP=10;
export const WATCHTOWER_MAX_HP=50;
export const BUILDING_REPAIR={ap:1,materials:2};
export const BUILDING_PLOTS=6;
export const buildingPlot=(b,index)=>Number.isInteger(b?.plot)&&b.plot>=0&&b.plot<BUILDING_PLOTS?b.plot:index;
export function freeBuildingPlot(state){const used=new Set(state.buildings.map(buildingPlot));return Array.from({length:BUILDING_PLOTS},(_,i)=>i).find(i=>!used.has(i));}
export const buildingMaxHealth=type=>type==='watchtower'?WATCHTOWER_MAX_HP:BUILDING_MAX_HP;
export function buildingHealth(b){
 const max=buildingMaxHealth(b?.type);
 if(b?.hp==null)return max;
 // Preserve the remaining fraction on the old ten-point scale, including ruins.
 if(b.type==='watchtower'&&b.maxHp===undefined&&Number.isFinite(b.hp)&&b.hp<=BUILDING_MAX_HP)return b.hp*max/BUILDING_MAX_HP;
 return b.hp;
}
export const buildingOperational=b=>!!b&&buildingHealth(b)>0;
export const upgradedWatchtower=b=>b?.type==='watchtower'&&b.level>=2&&buildingOperational(b);
export function normalizeBuildingHealth(state){
 const used=new Set((state.buildings||[]).filter(b=>Number.isInteger(b.plot)&&b.plot>=0&&b.plot<BUILDING_PLOTS).map(b=>b.plot));
 for(const b of state.buildings||[]){
  b.hp=buildingHealth(b);
  if(b.type==='watchtower')b.maxHp=WATCHTOWER_MAX_HP;
  if(!Number.isInteger(b.plot)||b.plot<0||b.plot>=BUILDING_PLOTS){b.plot=Array.from({length:BUILDING_PLOTS},(_,i)=>i).find(i=>!used.has(i));used.add(b.plot);}
 }
 if(state.preparationBase)normalizeBuildingHealth(state.preparationBase);
 return state;
}
