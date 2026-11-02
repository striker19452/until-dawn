import { test,expect } from '@playwright/test';
import { createBattle,stepBattle } from '../src/battle.js';
import { settleNight } from '../src/campaign.js';
import { localNightId } from '../src/local-night.js';

// Run the real deterministic night immediately so this tests saving, not timers.
async function finishImmediately(page){
 await page.exposeFunction('__finishTestNight',base=>{
  const battle=createBattle(base.state,localNightId(base),{autoPause:false});battle.paused=false;
  while(!battle.finished)stepBattle(battle);
  return {type:'state',battle,result:settleNight(base.state,battle),steps:2400};
 });
 await page.addInitScript(()=>{const RealWorker=window.Worker;window.Worker=class extends EventTarget{
  constructor(url,options){super();if(!String(url).includes('night-worker'))return new RealWorker(url,options);queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:{type:'ready'}})));}
  postMessage(message){if(message.type==='init')window.__finishTestNight(message.base).then(data=>this.dispatchEvent(new MessageEvent('message',{data})));}
  terminate(){}
 };});
 await page.goto('/');await page.getByRole('button',{name:/夜班保安/}).click();
 await expect(page.locator('#world')).toHaveAttribute('data-ready','true');
 await page.locator('[data-action=prepare]').click();await expect(page.locator('#phase')).toHaveText('黄昏准备');
 return page.request.get('/api/campaign').then(r=>r.json());
}

test('manual save retry after a rejected campfire flag resubmits the retained night exactly once',async({page})=>{
 const base=await finishImmediately(page),payloads=[];
 await page.route('**/api/campaign/night-result',async route=>{
  payloads.push(route.request().postDataJSON());
  if(payloads.length===1)await route.fulfill({status:422,json:{error:'结果含有未知剧情字段。'}});
  else await route.continue();
 });
 await page.locator('[data-action=start-night]').click();
 await expect(page.locator('#error')).toContainText('结果含有未知剧情字段');
 expect((await page.request.get('/api/campaign').then(r=>r.json())).revision).toBe(base.revision);
 const before=await page.locator('#world').evaluate(el=>el.getNightSnapshot());
 await page.locator('[data-action=dismiss-error]').click();
 await page.locator('[data-action=retry-save]').click();
 await expect(page.locator('#phase')).toHaveText('天亮战报');
 expect(payloads).toHaveLength(2);expect(payloads[1]).toEqual(payloads[0]);
 expect(payloads[1].result.flags.campfireWood).toBeGreaterThan(0);
 const saved=await page.request.get('/api/campaign').then(r=>r.json());
 expect(saved.revision).toBe(base.revision+1);expect(saved.state).toEqual(payloads[0].result);
 expect(saved.state.report.day).toBe(before.day);await expect(page.locator('#error')).toBeHidden();
 const duplicate=await page.request.post('/api/campaign/night-result',{data:payloads[1]});
 expect(duplicate.status()).toBe(200);expect((await duplicate.json()).revision).toBe(saved.revision);
});

test('manual retry of a real revision conflict still cannot overwrite the current save',async({page})=>{
 const base=await finishImmediately(page);let attempts=0;
 const changed=await page.request.post('/api/campaign/action',{data:{runId:base.runId,revision:base.revision,requestId:crypto.randomUUID(),action:{type:'backDay'}}});
 expect(changed.status()).toBe(200);const current=await changed.json();
 page.on('request',r=>{if(r.url().endsWith('/api/campaign/night-result'))attempts++;});
 await page.locator('[data-action=start-night]').click();
 await expect(page.locator('#error')).toContainText('入夜准备已在其他页面改变');
 await page.locator('[data-action=dismiss-error]').click();
 await page.locator('[data-action=retry-save]').click();
 await expect.poll(()=>attempts).toBe(2);
 await expect(page.locator('#error')).toContainText('入夜准备已在其他页面改变');
 expect(await page.request.get('/api/campaign').then(r=>r.json())).toEqual({...current,nightRuntime:'client'});
 expect(await page.locator('#world').evaluate(el=>el.getNightDiagnostics().pendingSave)).toBe(true);
});
