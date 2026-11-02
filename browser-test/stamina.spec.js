import {openTab} from './support/ui.js';
import {test,expect} from '@playwright/test';
import {initialCampaign,applyCampaignAction,makePerson,settleNight} from '../src/campaign.js';
import {COMPANIONS} from '../src/content.js';
import {createBattle} from '../src/battle.js';

const capacities={hero:110,lin:105,zhou:85,chen:115,xu:95,yuan:130,meng:100};
for(const width of [320,390])for(const ids of [['lin','zhou','chen','xu'],['yuan','meng']])test(`personal stamina ${width}/${ids[0]}: day, night and selected-person status use each capacity`,async({page})=>{
 await page.setViewportSize({width,height:width===320?568:844});let state=applyCampaignAction(initialCampaign(53),{type:'chooseRole',role:'repairman'}),revision=1;state.day=13;state.beds=5;
 state.people.push(...ids.map(id=>{const c=COMPANIONS.find(c=>c.id===id);return makePerson(c.id,c.name,c.role,c.skill);}));
 await page.route('**/api/campaign',route=>route.fulfill({json:{state,runId:'stamina-ui',revision}}));await page.route('**/api/campaign/action',route=>{state=applyCampaignAction(state,route.request().postDataJSON().action);return route.fulfill({json:{state,runId:'stamina-ui',revision:++revision}});});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await openTab(page,'members');
 const stamina=page.locator('.stat').filter({has:page.locator('span',{hasText:/^体力$/})});
 for(const id of ['hero',...ids]){await page.locator(`[data-action=member-view][data-person=${id}]`).click();await expect(stamina.locator('b')).toHaveText(`${capacities[id]} / ${capacities[id]}`);await expect(page.getByTestId('stamina-note')).toContainText(`体力上限 ${capacities[id]}`);await expect(page.locator('.stat').filter({has:page.locator('span',{hasText:/^健康$/})}).locator('b')).toHaveText('100 / 100');}
 await page.screenshot({path:`.local/validation/stamina/day-${width}-${ids[0]}.png`,fullPage:true});await page.locator('[data-action=close-overlay]').click();await page.locator('[data-action=prepare]').click();await page.locator('[data-action=start-night]').click();await expect(page.locator('#phase')).toHaveText('实时守夜');
 for(const id of ids){await page.locator('#battle-person').selectOption(id);await expect(page.locator('#battle-live')).toContainText(`体力 ${capacities[id]}/${capacities[id]}`);}
 await openTab(page,'members');for(const id of ids){await page.locator(`[data-action=member-view][data-person=${id}]`).click();await expect(stamina.locator('b')).toHaveText(`${capacities[id]}/${capacities[id]}`);}
 const layout=await page.getByTestId('stamina-note').evaluate(el=>({width:innerWidth,scroll:document.documentElement.scrollWidth,noteRight:el.getBoundingClientRect().right,bodyScroll:document.querySelector('#sheet-body').scrollWidth,bodyWidth:document.querySelector('#sheet-body').clientWidth}));expect(layout.scroll).toBeLessThanOrEqual(layout.width);expect(layout.noteRight).toBeLessThanOrEqual(layout.width);expect(layout.bodyScroll).toBeLessThanOrEqual(layout.bodyWidth);
 await page.screenshot({path:`.local/validation/stamina/night-${width}-${ids[0]}.png`,fullPage:true});expect(errors).toEqual([]);
});

test('real saves accept capacities above 100 and an already-open old night normalizes 100 to each person’s full capacity',async({page})=>{
 let snapshot=await page.request.get('/api/campaign').then(response=>response.json());
 const action=async value=>{const response=await page.request.post('/api/campaign/action',{data:{runId:snapshot.runId,revision:snapshot.revision,requestId:crypto.randomUUID(),action:value}});expect(response.status()).toBe(200);snapshot=await response.json();};
 const finish=async legacy=>{const battle=createBattle(snapshot.state,`local-${snapshot.runId}-${snapshot.revision}`),result=settleNight(snapshot.state,battle);if(legacy)result.people.forEach(p=>p.stamina=100);const response=await page.request.post('/api/campaign/night-result',{data:{runId:snapshot.runId,revision:snapshot.revision,nightId:battle.id,orderModel:'temporary-v1',result}});expect(response.status()).toBe(200);snapshot=await response.json();};
 await action({type:'chooseRole',role:'watchman'});await action({type:'beds'});await action({type:'recruit',person:'lin'});await action({type:'prepare'});await finish(false);expect(snapshot.state.people.map(p=>p.stamina)).toEqual([120,105]);
 await action({type:'nextDay'});await action({type:'prepare'});await finish(false);await action({type:'nextDay'});await action({type:'search',site:'alley'});await action({type:'recruit',person:'zhou'});await action({type:'prepare'});await finish(true);expect(snapshot.state.people.map(p=>p.stamina)).toEqual([120,105,85]);
 await page.goto('/');await expect(page.locator('#phase')).toHaveText('天亮战报');await page.locator('[data-action=close-overlay]').click();await openTab(page,'members');await page.locator('[data-action=member-view][data-person=zhou]').click();await expect(page.locator('.stat').filter({has:page.locator('span',{hasText:/^体力$/})}).locator('b')).toHaveText('85 / 85');await expect(page.locator('#error')).toBeHidden();
});
