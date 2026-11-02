import {selectZone} from './support/ui.js';
import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {initialCampaign,applyCampaignAction} from '../src/campaign.js';

for(const width of [320,390])test(`defense costs ${width}: show actions and new prices, pay once and keep traps consumable`,async({page})=>{
 await page.setViewportSize({width,height:width===320?568:844});const errors=[],posts=[];page.on('pageerror',e=>errors.push(e.message));
 let state=applyCampaignAction(initialCampaign(53),{type:'chooseRole',role:'repairman'}),revision=1;
 state=applyCampaignAction(state,{type:'build',building:'garden'});state.resources.materials=100;state.ap=10;
 const snap=()=>({state,runId:'defense-prices',revision});
 await page.route('**/api/campaign',route=>route.fulfill({json:snap()}));
 await page.route('**/api/campaign/action',async route=>{const request=route.request().postDataJSON();posts.push(request.action);state=applyCampaignAction(state,request.action);revision++;await route.fulfill({json:snap()});});
 await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await selectZone(page,'gate');
 await expect(page.locator('[data-action=craft][data-item=trap]')).toHaveText('制作陷阱 · 1行动 2建材');
 await expect(page.locator('#sheet-body')).toContainText('永久设施');await expect(page.locator('#sheet-body')).not.toContainText('绊索');
 for(const [feature,name,cost]of [['spikes','翻刺',10],['mesh','埋网',10],['bell','铃绳',8]]){
  const button=page.locator(`[data-action=defense][data-feature=${feature}]`),materials=state.resources.materials,ap=state.ap;
  await expect(button).toHaveText(`${name} · 1行动 ${cost}建材`);if(feature==='spikes')await page.screenshot({path:`.local/validation/defense-costs/prices-${width}.png`,fullPage:true});await button.click();await expect(button).toHaveText(`✓ ${name} · 已安装`);await expect(button).toBeDisabled();
  expect(state.resources.materials).toBe(materials-cost);expect(state.ap).toBe(ap-1);expect(posts.at(-1).price).toEqual({ap:1,materials:cost});
 }
 const ap=state.ap;await page.locator('[data-action=craft][data-item=trap]').click();await expect.poll(()=>state.zones[0].traps).toBe(1);expect(state.resources.materials).toBe(70);expect(state.ap).toBe(ap-1);
 expect(await page.locator('#sheet-body').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 await page.screenshot({path:`.local/validation/defense-costs/installed-${width}.png`,fullPage:true});
 await page.reload();await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await selectZone(page,'gate');await expect(page.locator('[data-action=defense][data-feature=spikes]')).toBeDisabled();expect(state.resources.materials).toBe(70);
 await page.locator('[data-action=close-overlay]').click();await page.locator('[data-action=drawer][data-panel=build]').click();if(width===320)await page.locator('#facility-view').selectOption('garden');else await page.locator('[data-action=facility][data-building=garden]').click();
 await expect(page.locator('[data-action=demolish]')).toContainText('1行动，回收2建材');
 page.once('dialog',d=>d.accept());await page.locator('[data-action=demolish]').click();await expect(page.locator('[data-action=demolish]')).toHaveCount(0);expect(state.resources.materials).toBe(72);expect(state.ap).toBe(ap-2);expect(errors).toEqual([]);
});

test('real API rejects stale price without a charge, accepts new quotes and replays the paid request once',async({page})=>{
 let snap=await page.request.get('/api/campaign').then(r=>r.json());
 const send=action=>({runId:snap.runId,revision:snap.revision,requestId:randomUUID(),action});
 let r=await page.request.post('/api/campaign/action',{data:send({type:'chooseRole',role:'repairman'})});expect(r.status()).toBe(200);snap=await r.json();const start=structuredClone(snap);
 for(const price of [undefined,{ap:1,materials:3}]){
  r=await page.request.post('/api/campaign/action',{data:send({type:'defense',zone:'gate',feature:'spikes',price})});expect(r.status()).toBe(422);expect((await r.json()).error).toContain('刷新页面确认新费用');
  expect(await page.request.get('/api/campaign').then(r=>r.json())).toEqual({...start,nightRuntime:'client'});
 }
 const request=send({type:'defense',zone:'gate',feature:'spikes',price:{ap:1,materials:10}});r=await page.request.post('/api/campaign/action',{data:request});expect(r.status()).toBe(200);snap=await r.json();expect(snap.state.resources.materials).toBe(start.state.resources.materials-10);expect(snap.state.ap).toBe(start.state.ap-1);
 r=await page.request.post('/api/campaign/action',{data:request});expect(r.status()).toBe(200);const replay=await r.json();expect(replay.replayed).toBe(true);expect(replay.state).toEqual(snap.state);expect(replay.revision).toBe(snap.revision);
 const installed=structuredClone(snap);r=await page.request.post('/api/campaign/action',{data:send({type:'defense',zone:'gate',feature:'mesh',price:{ap:1,materials:10}})});expect(r.status()).toBe(422);expect((await r.json()).error).toContain('物资不足');expect(await page.request.get('/api/campaign').then(r=>r.json())).toEqual({...installed,nightRuntime:'client'});
 await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await selectZone(page,'gate');await expect(page.locator('[data-action=defense][data-feature=spikes]')).toBeDisabled();await expect(page.locator('[data-action=defense][data-feature=bell]')).toHaveText('铃绳 · 1行动 8建材');
});
