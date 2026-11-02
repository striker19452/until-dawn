import {applyCampaignAction} from '../src/campaign.js';
import {RESOURCE_NAMES,BUILDINGS} from '../src/content.js';
import {resourceDifference} from '../src/resource-flow.js';

const names={repairBuilding:'维修设施',rebuildBuilding:'原址重建',demolish:'拆除／清理',event:'事件选择',search:'外出搜索',upgradeBuilding:'升级设施',defense:'安装防御',repair:'修补围栏',beds:'扩建床位',rest:'休整',treat:'治疗',firstAid:'急救',dismiss:'成员转移',assign:'安排工作',trade:'物资交换',routeWork:'清理路线',help:'邻里援助',houseRepair:'修补小屋',prepare:'黄昏生产'};
const actionName=a=>a.type==='build'?`建设${BUILDINGS[a.building]?.name||'设施'}`:a.type==='craft'?({fuel:'加工燃料',medicine:'制作护理包',trap:'制作陷阱'}[a.item]||'加工物资'):names[a.type]||'白天操作';
const clock=t=>`${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`;
const splitChanges=changes=>['spend','gain'].map(kind=>({kind,changes:changes.filter(c=>kind==='gain'?c.amount>0:c.amount<0)})).filter(flow=>flow.changes.length);
const feedbackNames={...RESOURCE_NAMES,exposure:'暴露'};

// Trace the same accepted rules locally for receipts. This catches gross costs
// even when a harvest or a returned reservation offsets the inventory change.
export function actionResourceFlows(before,action,after){
 if(['chooseRole','retryDay','backDay'].includes(action.type))return [];
 const flows=[];
 try{
  const predicted=applyCampaignAction(before,action,{onResourceFlow:flow=>flows.push(flow)});
  if(predicted.exposure===after.exposure&&Object.keys(RESOURCE_NAMES).every(key=>predicted.resources[key]===after.resources[key]))return flows;
 }catch{}
 const fallback=splitChanges(resourceDifference(before.resources,after.resources)),amount=(after.exposure??0)-(before.exposure??0);
 if(amount)fallback.push({changes:[{resource:'exposure',amount}],kind:'exposure'});
 return fallback;
}

export function createResourceTracker(emit){
 let nightId=null,lastFlow=0,lastResources=null,resultShown=false;const actions=new Set();
 return {
  beginNight(){nightId=null;lastFlow=0;lastResources=null;resultShown=false;},
  action(before,action,after,requestId){
   if(requestId&&actions.has(requestId))return;
   if(requestId){actions.add(requestId);if(actions.size>200)actions.delete(actions.values().next().value);}
   for(const flow of actionResourceFlows(before,action,after))emit({...flow,reason:`第${after.day}天 · ${flow.reason||actionName(action)}`});
  },
  night(b,result,baseResources){
   if(b.id!==nightId){nightId=b.id;lastFlow=0;lastResources=baseResources;resultShown=false;}
   if(b.resourceFlows){
    for(const flow of b.resourceFlows)if(flow.id>lastFlow){emit({...flow,reason:`${clock(flow.time)} · ${flow.reason}`});lastFlow=flow.id;}
   }else{
    for(const flow of splitChanges(resourceDifference(lastResources,b.resources)))emit({...flow,reason:`${clock(b.elapsed)} · 夜间物资`});
   }
   lastResources={...b.resources};
   if(result&&!resultShown){
    resultShown=true;
    for(const flow of splitChanges(resourceDifference(b.resources,result.resources)))emit({...flow,reason:flow.kind==='gain'?'天亮 · 挑战奖励':'天亮 · 夜间口粮结算'});
   }
  }
 };
}

export function createResourceFeedback(bar){
 const root=document.createElement('div');root.id='resource-feedback';root.className='resource-feedback';
 const receipts=document.createElement('div');receipts.className='resource-receipts';receipts.setAttribute('role','log');receipts.setAttribute('aria-live','polite');receipts.setAttribute('aria-label','物资与暴露变化');root.append(receipts);document.body.append(root);
 const pending=[],queued=[],lanes=new Map(),timers=new Set();let scheduled=false;
 const tracker=createResourceTracker(flow=>pending.push(flow));
 function later(fn,ms){const id=setTimeout(()=>{timers.delete(id);fn();},ms);timers.add(id);}
 function position(){const rect=bar.getBoundingClientRect();receipts.style.left=`${Math.max(8,rect.left)}px`;receipts.style.top=`${rect.bottom+8}px`;receipts.style.width=`${Math.min(rect.width,340)}px`;}
 function show(flow){
  const changes=flow.changes.filter(c=>c.amount!==0&&Object.hasOwn(feedbackNames,c.resource));if(!changes.length)return;
  position();const row=document.createElement('div');row.className=`resource-receipt ${flow.kind}`;row.dataset.kind=flow.kind;
  const label=document.createElement('span');label.className='resource-receipt-reason';label.textContent=flow.reason;row.append(label);
  const values=document.createElement('div');values.className='resource-receipt-values';row.append(values);
  for(const change of changes){
   const value=document.createElement('b'),number=`${change.amount<0?'−':'+'}${Math.abs(change.amount)}`,harmful=change.resource==='exposure'?change.amount>0:change.amount<0;value.textContent=`${feedbackNames[change.resource]} ${number}`;value.className=harmful?'spent':'gained';value.dataset.resource=change.resource;value.dataset.amount=String(change.amount);values.append(value);
   const cell=bar.querySelector(`[data-resource="${change.resource}"]`);if(!cell)continue;
   const rect=cell.getBoundingClientRect(),lane=lanes.get(change.resource)||0;lanes.set(change.resource,lane+1);
   const pop=document.createElement('span');pop.className=`resource-pop ${change.amount<0?'spent':'gained'}`;pop.textContent=number;pop.setAttribute('aria-hidden','true');pop.dataset.resource=change.resource;
   pop.style.left=`${Math.max(20,Math.min(innerWidth-20,rect.left+rect.width/2))}px`;pop.style.top=`${Math.max(3,rect.top-17+(lane%2)*9)}px`;root.append(pop);
   later(()=>{pop.remove();lanes.set(change.resource,Math.max(0,(lanes.get(change.resource)||1)-1));},1600);
  }
  receipts.append(row);while(receipts.children.length>3)receipts.firstElementChild.remove();later(()=>row.remove(),3200);
 }
 // Stagger a harvest batch so every source gets a readable receipt, including
 // costs and income that cancel out in the final stock balance.
 function drain(){if(!queued.length){scheduled=false;return;}scheduled=true;show(queued.shift());later(drain,900);}
 window.addEventListener('resize',position);
 return {...tracker,get pending(){return pending.length>0;},flush(){queued.push(...pending.splice(0));if(!scheduled)drain();}};
}
