import {openTab} from './support/ui.js';
import {test,expect} from '@playwright/test';
import {initialCampaign,applyCampaignAction} from '../src/campaign.js';
import {facilityOutput,UPGRADE_TEXT} from '../src/rules.js';
import {weather} from '../src/content.js';
for(const width of [320,390,1280])test(`garden yield and saved harvest stay visible at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:844});
 let state=applyCampaignAction(initialCampaign(53),{type:'chooseRole',role:'repairman'}),revision=1;
 state.buildings=[{id:'garden',type:'garden',level:1,age:1,hp:10}];
 const amount=facilityOutput(state.buildings[0],weather(state.day,state.seed)),before=state.resources.food;
 await page.route('**/api/campaign',route=>route.fulfill({json:{state,runId:'garden-display',revision}}));
 await page.route('**/api/campaign/action',route=>{state=applyCampaignAction(state,route.request().postDataJSON().action);return route.fulfill({json:{state,runId:'garden-display',revision:++revision}});});
 await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');
 await page.locator('[data-action=drawer][data-panel=build]').first().click();
 await expect(page.locator('#sheet-body')).toContainText('一级每次3食物，雨天4、晴热2');await expect(page.locator('#sheet-body')).toContainText('高产：'+UPGRADE_TEXT.garden.yield);await expect(page.locator('#sheet-body')).toContainText('耐候：'+UPGRADE_TEXT.garden.steady);
 await expect(page.getByTestId('garden-status')).toContainText(`食物 +${amount}`);await expect(page.getByTestId('garden-status')).toContainText('准备入夜');
 await page.locator('[data-action=close-overlay]').click();await page.locator('[data-action=prepare]').click();
 const harvest=page.locator('#notice [data-testid=garden-harvest]');await expect(harvest).toContainText(`食物 +${amount}`);
 await expect(page.locator('#resources [data-resource=food] b')).toHaveText(String(before+amount));
 await page.waitForTimeout(3600);await expect(harvest).toBeVisible();
 await page.reload();await expect(harvest).toContainText(`食物 +${amount}`);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`.local/validation/garden-display/harvest-${width}.png`,fullPage:true});
 if(width<960){await page.locator('.mobile-menu').click();await page.locator('#sheet-body [data-panel=ready]').click();}else await openTab(page,'ready');await expect(page.locator('#sheet-body [data-testid=garden-harvest]')).toContainText('已收获入库');
 await page.locator('[data-action=back-day]').click();await expect(harvest).toHaveCount(0);await expect(page.locator('#resources [data-resource=food] b')).toHaveText(String(before));
});

test('immature garden explains the empty harvest; report preserves actual receipts after damage',async({page})=>{
 let state=applyCampaignAction(initialCampaign(53),{type:'chooseRole',role:'repairman'}),revision=1;
 state.buildings=[{id:'garden',type:'garden',level:1,age:0,hp:10}];
 await page.route('**/api/campaign',route=>route.fulfill({json:{state,runId:'garden-history',revision}}));
 await page.route('**/api/campaign/action',route=>{state=applyCampaignAction(state,route.request().postDataJSON().action);return route.fulfill({json:{state,runId:'garden-history',revision:++revision}});});
 await page.goto('/');await page.locator('[data-action=drawer][data-panel=build]').first().click();
 await expect(page.getByTestId('garden-status')).toContainText('今日准备入夜只生长，不收获');
 state=applyCampaignAction(state,{type:'prepare'});revision++;await page.reload();
 await expect(page.locator('#notice [data-testid=garden-harvest]')).toHaveCount(0);
 // A second dusk harvests; damage later that night must not erase this receipt.
 state=applyCampaignAction(state,{type:'backDay'});state.buildings[0].age=1;state=applyCampaignAction(state,{type:'prepare'});
 const {createBattle}=await import('../src/battle.js');const {settleNight}=await import('../src/campaign.js');
 const battle=createBattle(state,'garden-history',{autoPause:false});battle.finished=true;battle.buildings[0].hp=0;
 state=settleNight(state,battle);revision++;await page.reload();
 await expect(page.locator('#sheet-body [data-testid=garden-harvest]')).toContainText('已收获入库');
 await page.locator('[data-action=close-overlay]').click();await page.locator('[data-action=next]').click();
 await expect(page.locator('[data-testid=garden-harvest]:visible')).toHaveCount(0);await expect(page.locator('.shell')).toHaveAttribute('data-phase','day');
});
