import {RESOURCE_NAMES} from './content.js';

export function resourceDifference(before,after){
 return Object.keys(RESOURCE_NAMES).flatMap(resource=>{
  const amount=(after?.[resource]??0)-(before?.[resource]??0);
  return Number.isFinite(amount)&&amount!==0?[{resource,amount}]:[];
 });
}

// Presentation receipts belong to the in-memory battle, never the campaign save.
export function recordResourceFlow(b,changes,reason,kind='reserve'){
 const items=Object.entries(changes).filter(([key,n])=>Object.hasOwn(RESOURCE_NAMES,key)&&Number.isFinite(n)&&n!==0).map(([resource,amount])=>({resource,amount}));
 if(!items.length)return;
 b.resourceFlowSeq=(b.resourceFlowSeq||0)+1;
 (b.resourceFlows||=[]).push({id:b.resourceFlowSeq,time:b.elapsed,changes:items,reason,kind});
 b.resourceFlows=b.resourceFlows.slice(-80);
}
