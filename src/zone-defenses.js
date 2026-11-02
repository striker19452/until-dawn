export const ATTACHED_DEFENSES=['spikes','mesh','bell','brazier','shade'];
const names={spikes:'翻刺',mesh:'埋网',bell:'铃绳',brazier:'火盆',shade:'遮雨棚'};

export function destroyZoneDefenses(zone){
 const lost=ATTACHED_DEFENSES.filter(key=>zone[key]).map(key=>names[key]);
 if(zone.traps>0)lost.push(`陷阱×${zone.traps}`);
 for(const key of ATTACHED_DEFENSES)zone[key]=false;
 zone.traps=0;
 return lost;
}
