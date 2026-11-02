import {applyCampaignAction,initialCampaign,normalizeCampaign,RuleError} from '../src/campaign.js';
import {validateClientResult} from '../src/client-result.js';
import {DEFENSES} from '../src/content.js';
import {CAMPFIRE_MAX_WOOD} from '../src/campfire.js';

export const CAMPAIGN_DB='dawn-browser-saves';
const STORES=['campaign','requests','nights'];
export class BrowserSaveError extends Error {
 constructor(message,status=409,snapshot=null){super(message);this.name='BrowserSaveError';this.status=status;this.snapshot=snapshot;}
}
function storageError(error){
 if(error instanceof BrowserSaveError||error instanceof RuleError)return error;
 const message=error?.name==='QuotaExceededError'?'浏览器存储空间不足，请腾出空间后重试。':'无法读写浏览器存档，请检查是否允许本站存储数据，然后重试。';
 return new BrowserSaveError(message,503);
}
function checkState(state){
 if(state?.version!==2||!Array.isArray(state.people)||!Array.isArray(state.zones)||!Array.isArray(state.buildings)||!Array.isArray(state.logs)||!state.resources||!state.flags)throw new BrowserSaveError('本地存档损坏或版本不兼容，已保留原数据。',422);
 return normalizeCampaign(structuredClone(state));
}
function snapshot(record){
 if(!record)return null;
 if(record.version!==1||typeof record.runId!=='string'||!Number.isSafeInteger(record.revision)||record.revision<0)throw new BrowserSaveError('本地存档版本不兼容，已保留原数据。',422);
 return {runId:record.runId,revision:record.revision,updatedAt:record.updatedAt,state:checkState(record.state)};
}
// Stable JSON avoids treating a retried action with reordered keys as new input.
const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,v[k]])):v);

export function createBrowserCampaignStore({indexedDB,name=CAMPAIGN_DB}={}){
 let opening=null;
 function open(){
  if(opening)return opening;
  opening=new Promise((resolve,reject)=>{
   const factory=indexedDB===undefined?globalThis.indexedDB:indexedDB;
   if(!factory){reject(new BrowserSaveError('当前浏览器无法使用本地存档，请允许本站存储数据或更换浏览器。',503));return;}
   const request=factory.open(name,1);let blocked=false;
   request.onupgradeneeded=()=>{for(const store of STORES)if(!request.result.objectStoreNames.contains(store))request.result.createObjectStore(store);};
   request.onerror=()=>reject(storageError(request.error));
   request.onblocked=()=>{blocked=true;reject(new BrowserSaveError('请关闭其他旧版游戏页面，再重新读取本地存档。',503));};
   request.onsuccess=()=>{const db=request.result;if(blocked){db.close();return;}db.onversionchange=()=>{db.close();opening=null;};resolve(db);};
  }).catch(error=>{opening=null;throw error;});
  return opening;
 }
 async function transaction(mode,work){
  try{
   const db=await open();
   return await new Promise((resolve,reject)=>{
    const tx=db.transaction(STORES,mode);let value,failure;
    // Resolve only after commit, never when an individual put succeeds.
    tx.oncomplete=()=>resolve(value);
    tx.onabort=()=>reject(failure||tx.error||new Error('存档事务已取消。'));
    const request=tx.objectStore('campaign').get('current');
    request.onsuccess=()=>{try{work(tx,request.result,result=>{value=result;},error=>{failure=error;tx.abort();});}catch(error){failure=error;tx.abort();}};
   });
  }catch(error){throw storageError(error);}
 }
 function current(record){const value=snapshot(record);if(!value)throw new BrowserSaveError('本地存档尚未建立，请重新读取。',404);return value;}
 function persist(tx,record,done){tx.objectStore('campaign').put(record,'current');done(snapshot(record));}
 function validate(input){if(!input||typeof input.runId!=='string'||!Number.isSafeInteger(input.revision)||input.revision<0||typeof input.requestId!=='string'||!/^[a-zA-Z0-9_-]{16,100}$/.test(input.requestId)||!input.action||typeof input.action!=='object'||Array.isArray(input.action))throw new BrowserSaveError('操作请求不完整。',400);}
 return {
  read:()=>transaction('readonly',(_tx,record,done)=>done(snapshot(record))),
  // A concurrent tab may have initialized while the legacy export was loading.
  // Never replace an existing browser save during automatic migration.
  ensure:legacy=>transaction('readwrite',(tx,record,done)=>{
   if(record){done(current(record));return;}
   const state=legacy?checkState(legacy.state):initialCampaign(crypto.getRandomValues(new Uint32Array(1))[0]);
   const dawn=legacy?checkState(legacy.dawn):structuredClone(state);
   const next={version:1,runId:legacy?.runId||`browser-${crypto.randomUUID()}`,revision:legacy?.revision??0,updatedAt:legacy?.updatedAt||new Date().toISOString(),state,dawn};
   persist(tx,next,done);
  }),
  action:input=>{
   validate(input);const payload=canonical(input.action);
   return transaction('readwrite',(tx,record,done,fail)=>{
    const prev=current(record);
    if(input.runId!==prev.runId)throw new BrowserSaveError('存档已切换。',409,prev);
    const key=`${prev.runId}:${input.requestId}`,request=tx.objectStore('requests').get(key);
    request.onsuccess=()=>{try{
     if(request.result!==undefined){if(request.result!==payload)throw new BrowserSaveError('请求编号已用于其他指令。',409,prev);done({...prev,replayed:true});return;}
     if(input.revision!==prev.revision)throw new BrowserSaveError('其他页面已经修改进度，请查看最新存档后重试。',409,prev);
     const action=input.action;
     if(action.type==='defense'&&Object.hasOwn(DEFENSES,action.feature)){const def=DEFENSES[action.feature];if(action.price?.ap!==def.ap||action.price?.materials!==def.cost.materials)throw new RuleError('防御设施造价已调整，请刷新页面确认新费用后再安装。');}
     let state;
     if(action.type==='retryDay'){
      if(!['report','failed','rescued'].includes(prev.state.phase))throw new RuleError('夜战结束后才能重试当天。');
      state=checkState(record.dawn);state.phase=state.role?'day':'prologue';state.logs.push('重新安排这一天，已还原清晨全部状态。');
     }else state=applyCampaignAction(prev.state,action);
     normalizeCampaign(state);
     const next={...record,state,revision:prev.revision+1,updatedAt:new Date().toISOString()};
     if(['nextDay','chooseRole','restart'].includes(action.type))next.dawn=structuredClone(state);
     tx.objectStore('requests').put(payload,key);persist(tx,next,done);
    }catch(error){fail(error);}};
   });
  },
  finishNight:input=>transaction('readwrite',(tx,record,done,fail)=>{
   const prev=current(record);
   if(!input||input.runId!==prev.runId||!Number.isSafeInteger(input.revision)||input.revision<0||input.nightId!==`local-${prev.runId}-${input.revision}`)throw new BrowserSaveError('本地夜战编号无效。',400);
   const key=`${prev.runId}:${input.nightId}`,request=tx.objectStore('nights').get(key);
   request.onsuccess=()=>{try{
    if(request.result!==undefined){done({...prev,replayed:true});return;}
    if(input.revision!==prev.revision||prev.state.phase!=='ready')throw new BrowserSaveError('入夜准备已在其他页面改变，已保留当前存档，请勿覆盖。',409,prev);
    const result=structuredClone(input.result);
    if(input.orderModel===undefined&&Array.isArray(result?.people))for(const p of result.people){const assigned=prev.state.people.find(q=>q.id===p.id);if(assigned){p.nightRole=assigned.nightRole;p.zone=assigned.zone;}}
    const legacyWood=record.state.flags?.campfireWood;
    const base=Number.isFinite(legacyWood)&&legacyWood>CAMPFIRE_MAX_WOOD?{...prev.state,flags:{...prev.state.flags,campfireWood:legacyWood}}:prev.state;
    const state=normalizeCampaign(validateClientResult(base,result));
    const next={...record,state,revision:prev.revision+1,updatedAt:new Date().toISOString()};
    tx.objectStore('nights').put(next.revision,key);persist(tx,next,done);
   }catch(error){fail(error);}};
  }),
  async close(){if(opening)(await opening).close();opening=null;}
 };
}
