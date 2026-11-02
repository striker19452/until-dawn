// Future arrivals and dormant split bodies still belong to this night's fight.
export function nightProgress(b){
 const active=b.enemies.filter(e=>e.hp>0||e.bossDormant).length,pending=b.schedule.length;
 return {active,pending,remaining:active+pending,cleared:active===0&&pending===0&&(!b.boss||b.boss.defeated)};
}
