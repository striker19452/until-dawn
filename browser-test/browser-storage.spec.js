import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {initialCampaign,applyCampaignAction,settleNight} from '../src/campaign.js';
import {createBattle,stepBattle} from '../src/battle.js';
import {localNightId} from '../src/local-night.js';
import {installStorage,browserSave,readSave} from './support/storage.js';

const request=(base,action)=>({runId:base.runId,revision:base.revision,requestId:randomUUID(),action});
async function act(page,base,action){const result=await browserSave(page,'action',request(base,action));expect(result.ok,result.error).toBe(true);return result.value;}
async function harness(page){await installStorage(page);await page.route('**/__storage-test',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Storage test</title>'}));await page.goto('/__storage-test');}
async function instantWorker(page){
 await page.exposeFunction('__finishBrowserNight',base=>{const battle=createBattle(base.state,localNightId(base),{autoPause:false});battle.paused=false;while(!battle.finished)stepBattle(battle);return {type:'state',battle,result:settleNight(base.state,battle),steps:2400};});
 await page.addInitScript(()=>{const RealWorker=window.Worker;window.Worker=class extends EventTarget{
  constructor(url,options){super();if(!String(url).includes('night-worker'))return new RealWorker(url,options);queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:{type:'ready'}})));}
  postMessage(message){if(message.type==='init')window.__finishBrowserNight(message.base).then(data=>this.dispatchEvent(new MessageEvent('message',{data})));}
  terminate(){}
 };});
}
async function boot(page){await installStorage(page);await page.goto('/');await page.getByRole('button',{name:/夜班保安/}).click();await expect(page.locator('#phase')).toHaveText('白天经营');}

test('day actions save offline, survive cookie removal and reload, and stay isolated by browser',async({page,context,browser})=>{
 const calls=[];page.on('request',r=>{if(r.url().includes('/api/'))calls.push(r.url());});
 await boot(page);const before=await readSave(page);expect(calls).toHaveLength(1);expect(calls[0]).toContain('/api/campaign/export');
 await context.setOffline(true);await page.locator('[data-action=prepare]').click();await expect(page.locator('#phase')).toHaveText('黄昏准备');await expect(page.locator('#save')).toHaveText('进度已保存到本机浏览器');
 const ready=await readSave(page);expect(ready.revision).toBe(before.revision+1);expect(calls).toHaveLength(1);
 await context.setOffline(false);await context.clearCookies();await page.route('**/api/**',route=>route.abort());await page.reload();await expect(page.locator('#phase')).toHaveText('黄昏准备');expect(await readSave(page)).toEqual(ready);expect(calls).toHaveLength(1);
 const separate=await browser.newContext();const other=await separate.newPage();await installStorage(other);await other.goto(page.url());await expect(other.locator('#phase')).toHaveText('选择角色');expect((await readSave(other)).runId).not.toBe(ready.runId);await separate.close();
});

test('a completed worker night saves offline, permits next morning and restores after reload',async({page,context})=>{
 await instantWorker(page);await boot(page);const dawn=await readSave(page);await page.locator('[data-action=prepare]').click();await expect(page.locator('#phase')).toHaveText('黄昏准备');await expect(page.locator('#phase')).toHaveText('黄昏准备');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await expect.poll(()=>page.locator('.yard-art').nth(1).evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);const base=await readSave(page);
 const writes=[];page.on('request',r=>{if(r.url().includes('/api/'))writes.push(r.url());});await context.setOffline(true);await page.locator('[data-action=start-night]').click();await expect(page.locator('#phase')).toHaveText('天亮战报');const saved=await readSave(page);expect(saved.revision).toBe(base.revision+1);expect(saved.state.report.saved).toBe(true);expect(writes).toEqual([]);
 await page.locator('[data-action=close-overlay]').click();page.once('dialog',dialog=>dialog.accept());await page.locator('[data-action=retry]').click();await expect(page.locator('#phase')).toHaveText('白天经营');expect((await readSave(page)).state.resources).toEqual(dawn.state.resources);
 await page.locator('[data-action=prepare]').click();await page.locator('[data-action=start-night]').click();await expect(page.locator('#phase')).toHaveText('天亮战报');await page.locator('[data-action=close-overlay]').click();await page.locator('[data-action=next]').click();await expect(page.locator('#day')).toHaveText('02 / 28');await context.setOffline(false);await page.reload();await expect(page.locator('#day')).toHaveText('02 / 28');
});

test('legacy server state and original dawn migrate once; browser actions never modify the server copy',async({page,context})=>{
 let legacy=await page.request.get('/api/campaign').then(r=>r.json());const action=async value=>{const response=await page.request.post('/api/campaign/action',{data:request(legacy,value)});expect(response.ok()).toBe(true);legacy=await response.json();};
 await action({type:'chooseRole',role:'repairman'});const dawn=structuredClone(legacy.state);await action({type:'search',site:'shed'});const before=await page.request.get('/api/campaign').then(r=>r.json());
 await instantWorker(page);await installStorage(page);await page.goto('/');await expect(page.locator('#phase')).toHaveText('白天经营');expect((await readSave(page)).state).toEqual(before.state);
 await page.locator('[data-action=prepare]').click();await expect(page.locator('#phase')).toHaveText('黄昏准备');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await expect.poll(()=>page.locator('.yard-art').nth(1).evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);await context.setOffline(true);await page.locator('[data-action=start-night]').click();await expect(page.locator('#phase')).toHaveText('天亮战报');await page.locator('[data-action=close-overlay]').click();page.once('dialog',dialog=>dialog.accept());await page.locator('[data-action=retry]').click();await expect(page.locator('#phase')).toHaveText('白天经营');const restored=await readSave(page);expect(restored.state.resources).toEqual(dawn.resources);expect(restored.state.searched).toEqual([]);
 await context.setOffline(false);expect(await page.request.get('/api/campaign').then(r=>r.json())).toEqual(before);await page.reload();await expect(page.locator('#phase')).toHaveText('白天经营');expect(await readSave(page)).toEqual(restored);
});

test('failed day commit retains the request, and retry charges resources only once',async({page})=>{
 await page.addInitScript(()=>{const put=IDBObjectStore.prototype.put;let fail=true;IDBObjectStore.prototype.put=function(...args){if(this.name==='requests'&&fail){fail=false;throw new DOMException('Full','QuotaExceededError');}return put.apply(this,args);};});
 await installStorage(page);await page.goto('/');await expect(page.getByRole('button',{name:/夜班保安/})).toBeVisible();const base=await readSave(page);await page.getByRole('button',{name:/夜班保安/}).click();await expect(page.locator('#error')).toContainText('浏览器存储空间不足');expect(await readSave(page)).toEqual(base);await expect(page.locator('#save')).toHaveText('本地保存待重试');await page.locator('[data-action=retry-action]').click();await expect(page.locator('#phase')).toHaveText('白天经营');expect((await readSave(page)).revision).toBe(base.revision+1);
});

test('failed night commit leaves the result in memory for manual retry while offline',async({page,context})=>{
 await page.addInitScript(()=>{const put=IDBObjectStore.prototype.put;let fail=true;IDBObjectStore.prototype.put=function(...args){if(this.name==='nights'&&fail){fail=false;throw new DOMException('Full','QuotaExceededError');}return put.apply(this,args);};});
 await instantWorker(page);await boot(page);await page.locator('[data-action=prepare]').click();await expect(page.locator('#phase')).toHaveText('黄昏准备');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await expect.poll(()=>page.locator('.yard-art').nth(1).evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);const base=await readSave(page);await context.setOffline(true);await page.locator('[data-action=start-night]').click();await expect(page.locator('#error')).toContainText('浏览器存储空间不足');expect(await readSave(page)).toEqual(base);expect(await page.locator('#world').evaluate(el=>el.getNightDiagnostics().pendingSave)).toBe(true);
 await page.locator('[data-action=dismiss-error]').click();await page.locator('[data-action=retry-save]').click();await expect(page.locator('#phase')).toHaveText('天亮战报');expect((await readSave(page)).revision).toBe(base.revision+1);await expect(page.locator('#error')).toBeHidden();
});

test('browser transactions serialize conflicting tabs, replay requests and preserve the dawn checkpoint',async({page})=>{
 await harness(page);let base=(await browserSave(page,'ensure')).value;base=await act(page,base,{type:'chooseRole',role:'repairman'});const dawn=structuredClone(base.state),input=request(base,{type:'search',site:'shed'});
 const results=await Promise.all([browserSave(page,'action',input),browserSave(page,'action',request(base,{type:'search',site:'alley'}))]);expect(results.filter(r=>r.ok)).toHaveLength(1);expect(results.find(r=>!r.ok).status).toBe(409);
 const saved=await readSave(page);const replay=await browserSave(page,'action',input);expect(replay.ok).toBe(true);expect(replay.value.replayed).toBe(true);expect(replay.value.revision).toBe(saved.revision);const changed=await browserSave(page,'action',{...input,action:{type:'prepare'}});expect(changed.status).toBe(409);
 base=await act(page,saved,{type:'prepare'});const battle=createBattle(base.state,localNightId(base)),night={runId:base.runId,revision:base.revision,nightId:battle.id,orderModel:'temporary-v1',result:settleNight(base.state,battle)};const ended=await browserSave(page,'finishNight',night);expect(ended.ok,ended.error).toBe(true);expect((await browserSave(page,'finishNight',night)).value.revision).toBe(ended.value.revision);
 const retry=await act(page,ended.value,{type:'retryDay'});expect(retry.state.resources).toEqual(dawn.resources);expect(retry.state.searched).toEqual([]);const restarted=await act(page,retry,{type:'restart',confirm:true});expect(restarted.state.phase).toBe('prologue');expect(restarted.revision).toBe(retry.revision+1);expect((await browserSave(page,'finishNight',night)).value.state.phase).toBe('prologue');
});

test('invalid results and rule failures roll back without changing the current save',async({page})=>{
 await harness(page);let base=(await browserSave(page,'ensure')).value;expect((await browserSave(page,'action',request(base,{type:'build',building:'garden'}))).ok).toBe(false);expect(await readSave(page)).toEqual(base);base=await act(page,base,{type:'chooseRole',role:'medic'});base=await act(page,base,{type:'prepare'});
 const battle=createBattle(base.state,localNightId(base)),result=settleNight(base.state,battle);result.resources.materials=999;expect((await browserSave(page,'finishNight',{...base,nightId:battle.id,result})).ok).toBe(false);expect(await readSave(page)).toEqual(base);
 const imported=await browserSave(page,'ensure',{runId:'other',revision:99,state:initialCampaign(4),dawn:initialCampaign(4)});expect(imported.value).toEqual(base);
});

test('unknown local save versions are preserved and never replaced by a new game',async({page})=>{
 await harness(page);await browserSave(page,'ensure');await page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('dawn-browser-saves',1);r.onsuccess=()=>{const db=r.result,tx=db.transaction('campaign','readwrite');tx.objectStore('campaign').put({version:999,marker:'preserve'},'current');tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>reject(tx.error);};}));
 expect((await browserSave(page,'read')).error).toContain('版本不兼容');expect((await browserSave(page,'ensure')).ok).toBe(false);await page.reload();expect((await browserSave(page,'read')).error).toContain('版本不兼容');
});

test('another tab cannot edit during a worker night and stale preparation cannot start',async({page,context})=>{
 await boot(page);await page.locator('[data-action=prepare]').click();await expect(page.locator('#world')).toHaveAttribute('data-ready','true');const other=await context.newPage();await installStorage(other);await other.goto('/');await expect(other.locator('#world')).toHaveAttribute('data-ready','true');
 await page.locator('[data-action=start-night]').click();await expect(page.locator('#phase')).toHaveText('实时守夜');await other.locator('[data-action=start-night]').click();await expect(other.locator('#error')).toContainText('另一个页面');
 const base=await readSave(other);await act(other,base,{type:'backDay'});await page.close();await other.locator('[data-action=start-night]').click();await expect(other.locator('#error')).toContainText('其他页面已经修改进度');await expect(other.locator('#phase')).toHaveText('白天经营');await other.close();
});

test('unavailable legacy migration offers a safe retry without silently creating a replacement save',async({page})=>{
 await installStorage(page);await page.route('**/api/campaign/export',route=>route.abort());await page.goto('/');await expect(page.locator('#error')).toContainText('无法检查旧服务器存档');expect(await readSave(page)).toBeNull();await page.unroute('**/api/campaign/export');await page.locator('[data-action=reload-save]').click();await expect(page.locator('#phase')).toHaveText('选择角色');expect(await readSave(page)).not.toBeNull();
});

test('blocked browser storage reports failure and keeps the game UI usable',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>Object.defineProperty(window,'indexedDB',{get(){throw new DOMException('Blocked','SecurityError');}}));
 await page.goto('/');await expect(page.locator('#save')).toHaveText('本地存档读取失败');await expect(page.locator('#error')).toContainText('无法读写浏览器存档');await expect(page.locator('[data-action=reload-save]')).toBeVisible();expect(errors).toEqual([]);
});

test('an outdated server cannot silently replace a legacy save, while creating a new local save is explicit',async({page})=>{
 await installStorage(page);await page.route('**/api/campaign/export',route=>route.fulfill({status:404,json:{error:'没有这个接口。'}}));await page.goto('/');await expect(page.locator('#error')).toContainText('无法检查旧服务器存档');expect(await readSave(page)).toBeNull();await page.locator('[data-action=new-local]').click();await expect(page.locator('#phase')).toHaveText('选择角色');expect(await readSave(page)).not.toBeNull();
});

test('a real running worker never writes intermediate progress and reload returns to preparation',async({page,context})=>{
 await boot(page);await page.locator('[data-action=prepare]').click();await expect(page.locator('#phase')).toHaveText('黄昏准备');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await page.locator('[data-action=start-night]').click();await expect(page.locator('#phase')).toHaveText('实时守夜');const base=await readSave(page);
 await context.setOffline(true);await page.locator('[data-action=pause]').click();await expect.poll(()=>page.locator('#world').evaluate(el=>el.getNightSnapshot()?.elapsed||0)).toBeGreaterThan(1);await page.locator('[data-action=pause]').click();expect(await readSave(page)).toEqual(base);await context.setOffline(false);await page.reload();await expect(page.locator('#phase')).toHaveText('黄昏准备');expect(await readSave(page)).toEqual(base);expect(await page.locator('#world').evaluate(el=>el.getNightSnapshot())).toBeNull();
});
