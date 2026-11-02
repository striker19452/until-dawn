import {test,expect} from '@playwright/test';
import {initialCampaign,applyCampaignAction,settleNight} from '../src/campaign.js';
import {createBattle} from '../src/battle.js';

const day=()=>applyCampaignAction(initialCampaign(53),{type:'chooseRole',role:'repairman'});
async function fixture(page,initial){
 let state=initial,revision=1;
 await page.route('**/api/campaign',route=>route.fulfill({json:{state,runId:'exposure-fixture',revision}}));
 await page.route('**/api/campaign/action',route=>{state=applyCampaignAction(state,route.request().postDataJSON().action);return route.fulfill({json:{state,runId:'exposure-fixture',revision:++revision}});});
 await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');return ()=>state;
}
async function observeExposure(page){await page.evaluate(()=>{window.__exposureSeen=[];new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.matches?.('.resource-receipt[data-kind=exposure]'))window.__exposureSeen.push(node.textContent);}).observe(document.querySelector('.resource-receipts'),{childList:true});});}

for(const width of [320,390,1280])test(`exposure ${width}: current value, deep-search increase, help and real night stay readable`,async({page})=>{
 await page.setViewportSize({width,height:width===320?568:844});if(width===1280)await page.emulateMedia({reducedMotion:'reduce'});page.on('dialog',dialog=>dialog.accept());
 await page.goto('/');await expect(page.locator('#exposure-status')).toBeHidden();await page.getByRole('button',{name:/修理工/}).click();await expect(page.locator('#world')).toHaveAttribute('data-ready','true');
 await expect(page.locator('#exposure-value')).toHaveText('0');await expect(page.locator('#exposure-impact')).toHaveText('额外来袭 +0只');
 await page.locator('[data-action=tab][data-tab=explore]').click();await page.locator('[data-action=deep][data-site=alley]').click();
 await expect(page.locator('#exposure-value')).toHaveText('1');await expect(page.locator('#exposure-impact')).toHaveText('额外来袭 +1只');
 const increased=page.locator('.resource-receipt[data-kind=exposure]').filter({hasText:'深搜居民小巷'});await expect(increased).toContainText('暴露 +1');await expect(increased.locator('b')).toHaveCSS('color','rgb(255, 187, 152)');
 const layout=await page.evaluate(()=>{const stock=document.querySelector('#resources').getBoundingClientRect(),exposure=document.querySelector('#exposure-status').getBoundingClientRect(),receipts=document.querySelector('.resource-receipts').getBoundingClientRect();return {stockBottom:stock.bottom,top:exposure.top,left:exposure.left,right:exposure.right,bottom:exposure.bottom,receiptTop:receipts.top,width:innerWidth,scroll:document.documentElement.scrollWidth};});
 expect(layout.top).toBeGreaterThanOrEqual(layout.stockBottom);expect(layout.left).toBeGreaterThanOrEqual(0);expect(layout.right).toBeLessThanOrEqual(layout.width);expect(layout.receiptTop).toBeGreaterThanOrEqual(layout.bottom+7);expect(layout.scroll).toBeLessThanOrEqual(layout.width);
 await page.locator('[data-action=close-overlay]').click();await page.locator('#exposure-status').click();const guide=page.getByTestId('exposure-guide');await expect(guide).toContainText('暴露 1 / 6');await expect(guide).toContainText('暴露3至6的来袭增量相同');await expect(guide).toContainText('同伴侦察巡查');await expect(guide).toContainText('清晨自然消退');await page.screenshot({path:`.local/validation/exposure/day-${width}.png`,fullPage:true});
 await page.locator('[data-action=close-overlay]').click();await page.locator('[data-action=prepare]').click();await expect(page.locator('#phase')).toHaveText('黄昏准备');await expect(page.locator('#exposure-value')).toHaveText('1');await page.locator('[data-action=start-night]').click();await expect(page.locator('#phase')).toHaveText('实时守夜');
 const zero=createBattle(applyCampaignAction(day(),{type:'prepare'}),'zero',{autoPause:false}),night=await page.locator('#world').evaluate(el=>el.getNightSnapshot());expect(night.exposure).toBe(1);expect(night.schedule).toHaveLength(zero.schedule.length+1);await expect(page.locator('#exposure-value')).toHaveText('1');
 await page.locator('#exposure-status').click();await expect(page.getByTestId('exposure-guide')).toContainText('当前暴露会让夜间额外来袭 1 只生物');await page.locator('[data-action=close-overlay]').click();await page.screenshot({path:`.local/validation/exposure/night-${width}.png`,fullPage:true});
});

test('generator noise and scouting each show their actual change when final exposure is unchanged; reversing dusk emits no false change',async({page})=>{
 let state=applyCampaignAction(day(),{type:'recruit',person:'lin'});state.buildings=[{id:'generator',type:'generator',level:1,enabled:true}];state=applyCampaignAction(state,{type:'assign',person:'lin',job:'scout'});
 await fixture(page,state);await observeExposure(page);await page.locator('[data-action=prepare]').click();
 const increased=page.locator('.resource-receipt[data-kind=exposure]').filter({hasText:'发电噪声'}),decreased=page.locator('.resource-receipt[data-kind=exposure]').filter({hasText:'林禾 · 侦察巡查'});
 await expect(increased).toContainText('暴露 +1');await expect(increased.locator('b')).toHaveCSS('color','rgb(255, 187, 152)');await expect(decreased).toContainText('暴露 −1');await expect(decreased.locator('b')).toHaveCSS('color','rgb(200, 230, 181)');await expect(page.locator('#exposure-value')).toHaveText('0');await expect.poll(()=>page.evaluate(()=>window.__exposureSeen.length)).toBe(2);
 await page.screenshot({path:'.local/validation/exposure/noise-and-scout.png',fullPage:true});await page.locator('[data-action=drawer][data-panel=ready]').click();await page.locator('[data-action=back-day]').click();await expect(page.locator('#phase')).toHaveText('白天经营');expect(await page.evaluate(()=>window.__exposureSeen.length)).toBe(2);
});

test('morning decay uses the new day, the upper limit reports only actual changes, and reload does not replay exposure',async({page})=>{
 const base=applyCampaignAction({...day(),exposure:6},{type:'prepare'}),battle=createBattle(base,'report',{autoPause:false}),getState=await fixture(page,settleNight(base,battle));page.on('dialog',dialog=>dialog.accept());await observeExposure(page);
 await expect(page.locator('#exposure-value')).toHaveText('6');await expect(page.locator('#exposure-impact')).toHaveText('额外来袭 +3只');await page.locator('[data-action=close-overlay]').click();await page.locator('[data-action=next]').click();
 const morning=page.locator('.resource-receipt[data-kind=exposure]').filter({hasText:'第2天 · 清晨自然消退'});await expect(morning).toContainText('暴露 −1');await expect(morning.locator('b')).toHaveCSS('color','rgb(200, 230, 181)');await expect(page.locator('#exposure-value')).toHaveText('5');
 await page.locator('[data-action=tab][data-tab=explore]').click();await page.locator('[data-action=deep][data-site=alley]').click();await expect(page.locator('#exposure-value')).toHaveText('6');await expect.poll(()=>page.evaluate(()=>window.__exposureSeen.length)).toBe(2);
 await page.locator('#site-view').selectOption('clinic');await page.locator('[data-action=deep][data-site=clinic]').click();await expect(page.locator('.resource-receipt[data-kind=gain]').filter({hasText:'搜索街角诊所'})).toContainText('药品 +6');expect(getState().exposure).toBe(6);expect(await page.evaluate(()=>window.__exposureSeen.length)).toBe(2);
 await page.reload();await expect(page.locator('#exposure-value')).toHaveText('6');await expect(page.locator('#exposure-impact')).toHaveText('额外来袭 +3只');await expect(page.locator('.resource-receipt')).toHaveCount(0);
});
