import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { applyCampaignAction, migrateLegacy, normalizeCampaign, RuleError } from './campaign.js';
import { StoreError } from './store.js';
import { validateClientResult } from './client-result.js';
import {DEFENSES} from './content.js';
import {CAMPFIRE_MAX_WOOD} from './campfire.js';
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function openCampaignStore(filename){
 const db=new DatabaseSync(filename);db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS campaigns (id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE REFERENCES users(id), version INTEGER NOT NULL DEFAULT 2, revision INTEGER NOT NULL, state_json TEXT NOT NULL, dawn_json TEXT NOT NULL, updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS campaign_requests (campaign_id TEXT NOT NULL REFERENCES campaigns(id), request_id TEXT NOT NULL, payload_hash TEXT NOT NULL, PRIMARY KEY(campaign_id,request_id));
 CREATE TABLE IF NOT EXISTS night_results (campaign_id TEXT NOT NULL REFERENCES campaigns(id), night_id TEXT NOT NULL, base_revision INTEGER NOT NULL, result_revision INTEGER NOT NULL, PRIMARY KEY(campaign_id,night_id));`);
 let closed=false;const get=db.prepare('SELECT * FROM campaigns WHERE user_id=?');
 function tx(fn){db.exec('BEGIN IMMEDIATE');try{const value=fn();db.exec('COMMIT');return value;}catch(e){db.exec('ROLLBACK');throw e;}}
 function snapshot(userId){const row=get.get(userId);if(!row)throw new StoreError('请先打开游戏。',404);if(row.version!==2)throw new StoreError('存档版本不兼容。',503);return {runId:row.id,revision:row.revision,updatedAt:row.updated_at,state:normalizeCampaign(JSON.parse(row.state_json))};}
 function ensure(userId,legacy){
  if(get.get(userId))return snapshot(userId);return tx(()=>{if(get.get(userId))return snapshot(userId);const seed=parseInt(createHash('sha256').update(userId).digest('hex').slice(0,7),16);const s=migrateLegacy(legacy?.state,seed),now=new Date().toISOString(),json=JSON.stringify(s);let dawn=s;if(s.role&&s.day===1&&legacy?.runId){const checkpoint=db.prepare('SELECT state_json FROM checkpoints WHERE run_id=?').get(legacy.runId);if(checkpoint)dawn=migrateLegacy(JSON.parse(checkpoint.state_json),seed,{preserveUnstarted:true});}db.prepare('INSERT INTO campaigns (id,user_id,revision,state_json,dawn_json,updated_at) VALUES (?,?,?,?,?,?)').run(`camp-${userId}`,userId,0,json,JSON.stringify(dawn),now);return snapshot(userId);});
 }
 function validate(input){if(!input||typeof input.runId!=='string'||!Number.isSafeInteger(input.revision)||input.revision<0||typeof input.requestId!=='string'||!/^[a-zA-Z0-9_-]{16,100}$/.test(input.requestId)||!input.action||typeof input.action!=='object'||Array.isArray(input.action))throw new StoreError('操作请求不完整。',400);}
 function action(userId,input){validate(input);return tx(()=>{
  const prev=snapshot(userId);if(prev.runId!==input.runId)throw new StoreError('存档已切换。',409,prev);const hash=digest(input.action),replay=db.prepare('SELECT payload_hash FROM campaign_requests WHERE campaign_id=? AND request_id=?').get(prev.runId,input.requestId);
  if(replay){if(replay.payload_hash!==hash)throw new StoreError('请求编号已用于其他指令。',409,prev);return {...prev,replayed:true};}
  if(prev.revision!==input.revision)throw new StoreError('其他页面已经修改进度，请重试。',409,prev);
  if(input.action.type==='defense'&&Object.hasOwn(DEFENSES,input.action.feature)){
   const def=DEFENSES[input.action.feature],price=input.action.price;
   if(price?.ap!==def.ap||price?.materials!==def.cost.materials)throw new RuleError('防御设施造价已调整，请刷新页面确认新费用后再安装。');
  }
  let state;
  if(input.action.type==='retryDay'){
   if(!['report','failed','rescued'].includes(prev.state.phase))throw new RuleError('夜战结束后才能重试当天。');state=JSON.parse(get.get(userId).dawn_json);state.phase=state.role?'day':'prologue';state.logs.push('重新安排这一天，已还原清晨全部状态。');
  }else state=applyCampaignAction(prev.state,input.action);
  normalizeCampaign(state);
  const now=new Date().toISOString(),revision=prev.revision+1;const newDawn=['nextDay','chooseRole','restart'].includes(input.action.type);
  if(newDawn)db.prepare('UPDATE campaigns SET state_json=?,dawn_json=?,revision=?,updated_at=? WHERE user_id=?').run(JSON.stringify(state),JSON.stringify(state),revision,now,userId);
  else db.prepare('UPDATE campaigns SET state_json=?,revision=?,updated_at=? WHERE user_id=?').run(JSON.stringify(state),revision,now,userId);
  db.prepare('INSERT INTO campaign_requests VALUES (?,?,?)').run(prev.runId,input.requestId,hash);return snapshot(userId);
 });}
 function finishClient(userId,input){return tx(()=>{
  const prev=snapshot(userId);
  if(!input||input.runId!==prev.runId||!Number.isSafeInteger(input.revision)||input.revision<0||input.nightId!==`local-${prev.runId}-${input.revision}`)throw new StoreError('本地夜战编号无效。',400);
  const done=db.prepare('SELECT result_revision FROM night_results WHERE campaign_id=? AND night_id=?').get(prev.runId,input.nightId);
  if(done)return {...prev,replayed:true};
  if(prev.revision!==input.revision||prev.state.phase!=='ready')throw new StoreError('入夜准备已在其他页面改变，已保留当前存档，请勿覆盖。',409,prev);
  const result=structuredClone(input.result);
  // An already-open older page may finish with its former command model.
  // Keep its night outcome, but never let those commands change assignments.
  if(input.orderModel===undefined&&Array.isArray(result?.people))for(const p of result.people){const assigned=prev.state.people.find(q=>q.id===p.id);if(assigned){p.nightRole=assigned.nightRole;p.zone=assigned.zone;}}
  // An old running page may have started with more than today's storage cap.
  // Validate against its saved starting stock, then normalize the carried wood.
  const legacyWood=JSON.parse(get.get(userId).state_json).flags?.campfireWood;
  const validationBase=Number.isFinite(legacyWood)&&legacyWood>CAMPFIRE_MAX_WOOD?{...prev.state,flags:{...prev.state.flags,campfireWood:legacyWood}}:prev.state;
  const state=normalizeCampaign(validateClientResult(validationBase,result));
  const revision=prev.revision+1,now=new Date().toISOString();
  db.prepare('UPDATE campaigns SET state_json=?,revision=?,updated_at=? WHERE user_id=?').run(JSON.stringify(state),revision,now,userId);
  db.prepare('INSERT INTO night_results VALUES (?,?,?,?)').run(prev.runId,input.nightId,prev.revision,revision);
  return snapshot(userId);
 });}
 return {ensure,snapshot,action,finishClient,close(){if(!closed){closed=true;db.close();}}};
}
