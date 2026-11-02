import { yardFires,CAMPFIRE_FOOTPRINT } from './campfire.js';
import {buildingPlot} from './building-health.js';

// The painted ground is 480 × 600. Navigation uses this space so perspective
// cannot turn wall edges into oversized rectangles.
const Y_ANCHORS=[[25,0],[170,126],[310,258],[390,336],[475,468],[625,600]];
export function artPoint(p){
 let i=0;while(i<Y_ANCHORS.length-2&&p.y>Y_ANCHORS[i+1][0])i++;
 const [a,c]=Y_ANCHORS[i],[next,end]=Y_ANCHORS[i+1],f=(p.y-a)/(next-a);
 const spread=.75+Math.max(0,Math.min(1,(p.y-170)/140))*.41;
 return {x:240+(p.x-240)*spread,y:c+f*(end-c)};
}
export function worldPoint(p){
 let i=0;while(i<Y_ANCHORS.length-2&&p.y>Y_ANCHORS[i+1][1])i++;
 const [a,c]=Y_ANCHORS[i],[next,end]=Y_ANCHORS[i+1],y=a+(p.y-c)/(end-c)*(next-a);
 const spread=.75+Math.max(0,Math.min(1,(y-170)/140))*.41;
 return {x:240+(p.x-240)/spread,y};
}
export const PLOTS=[{x:108,y:345},{x:108,y:420},{x:365,y:260},{x:370,y:345},{x:145,y:450},{x:330,y:445}];
export const HOUSE_ANCHOR={x:240,y:282,size:225};
const polygon=points=>points.map(([x,y])=>({x,y}));
// Keep standing positions inside the front wall. The painted gate recess is
// outside the courtyard's safe foot line and must not become a destination.
export const COURTYARD=polygon([[69,146],[145,128],[185,140],[288,140],[335,130],[411,146],[422,244],[449,342],[452,443],[29,443],[32,342],[55,244]]);
// Ground footprint, including bench, pots and doorstep. The roof can occlude
// a person without blocking the ground behind it.
// The front wings and doorstep need standing clearance beyond the house's
// y=282 depth line, so a person at the front cannot be treated as behind it.
export const HOUSE_FOOTPRINT=polygon([[144,178],[332,178],[333,288],[282,288],[270,294],[218,294],[206,288],[145,288]]);
export const DEFAULT_WALK_MAP={boundary:COURTYARD,obstacles:[HOUSE_FOOTPRINT]};
// Foot traces relative to each registered sprite's ground anchor at its
// rendered size (114; watchtower 128). Tall roofs and canopies are excluded.
const BUILDING_FOOTPRINTS={
 garden:[[-30,-23],[-4,-42],[31,-22],[31,-12],[5,1],[-30,-12]],
 water:[[-25,-14],[-10,-25],[20,-23],[27,-8],[17,1],[-18,0]],
 workshop:[[-28,-22],[18,-30],[29,-9],[15,1],[-18,-3]],
 generator:[[-29,-12],[-3,-25],[28,-15],[29,-3],[8,1],[-22,-4]],
 infirmary:[[-30,-18],[15,-26],[31,-6],[18,1],[-29,-4]],
 watchtower:[[-24,-21],[16,-26],[29,-5],[6,2],[-28,-2]],
 stove:[[-28,-18],[4,-28],[29,-17],[29,-5],[9,1],[-28,-7]],
 exchange:[[-27,-13],[10,-22],[28,-14],[28,-1],[5,1],[-27,-5]],
};

export function createWalkMap(campaign,battle=null){
 const obstacles=[HOUSE_FOOTPRINT];
 for(const [i,building] of (campaign?.buildings||[]).entries()){
  const plot=buildingPlot(building,i);if(!PLOTS[plot]||!BUILDING_FOOTPRINTS[building.type])continue;
  const p=artPoint(PLOTS[plot]);
  obstacles.push(polygon(BUILDING_FOOTPRINTS[building.type]).map(q=>({x:p.x+q.x,y:p.y+q.y})));
 }
 // An extinguished hearth still occupies the same patch of ground.
 const fires=yardFires(campaign,battle);
 for(const fire of fires){const p=artPoint(fire),rx=CAMPFIRE_FOOTPRINT.x,ry=CAMPFIRE_FOOTPRINT.y;
  obstacles.push(Array.from({length:8},(_,i)=>({x:p.x+Math.cos(i*Math.PI/4)*rx,y:p.y+Math.sin(i*Math.PI/4)*ry})));
 }
 return {boundary:COURTYARD,obstacles};
}
