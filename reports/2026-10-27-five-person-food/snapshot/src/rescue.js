export const RESCUE_RULES={
 routeDay:15,routeCap:2,work:{ap:1,cost:{materials:3}},
 help:{day:18,ap:1,cost:{food:3},gain:{materials:4,medicine:1},cooldown:3,exposure:1},
 aidCap:2,signalFear:12
};
const points=(value,cap)=>Math.min(cap,Math.max(0,Math.floor(Number(value)||0)));
export function rescueBenefits(s){
 const route=points(s.flags?.routeWork,RESCUE_RULES.routeCap),aid=points(s.flags?.helped,RESCUE_RULES.aidCap);
 const routeZones=s.flags?.route==='river'?['backLeft','backRight']:['gate'];
 return {route,aid,finalReduction:route+aid,nightReduction:s.day===28?route+aid:0,
  trapZones:Array.from({length:route},(_,i)=>routeZones[i%routeZones.length]),
  closePickup:route===RESCUE_RULES.routeCap&&!!s.flags?.registeredDay&&!!s.flags?.routeDelivered,
  nextHelpDay:s.flags?.helpDay?s.flags.helpDay+RESCUE_RULES.help.cooldown:RESCUE_RULES.help.day};
}
