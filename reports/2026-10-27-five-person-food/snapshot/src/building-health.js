export const BUILDING_MAX_HP=10;
export const BUILDING_REPAIR={ap:1,materials:2};
export const BUILDING_PLOTS=6;
export const buildingPlot=(b,index)=>Number.isInteger(b?.plot)&&b.plot>=0&&b.plot<BUILDING_PLOTS?b.plot:index;
export function freeBuildingPlot(state){const used=new Set(state.buildings.map(buildingPlot));return Array.from({length:BUILDING_PLOTS},(_,i)=>i).find(i=>!used.has(i));}
// Missing durability belongs to an older save; zero always means a ruin.
export const buildingHealth=b=>b?.hp??BUILDING_MAX_HP;
export const buildingOperational=b=>!!b&&buildingHealth(b)>0;
export function normalizeBuildingHealth(state){
 const used=new Set((state.buildings||[]).filter(b=>Number.isInteger(b.plot)&&b.plot>=0&&b.plot<BUILDING_PLOTS).map(b=>b.plot));
 for(const b of state.buildings||[]){b.hp=buildingHealth(b);if(!Number.isInteger(b.plot)||b.plot<0||b.plot>=BUILDING_PLOTS){b.plot=Array.from({length:BUILDING_PLOTS},(_,i)=>i).find(i=>!used.has(i));used.add(b.plot);}}
 if(state.preparationBase)normalizeBuildingHealth(state.preparationBase);
 return state;
}
