import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {initialCampaign,applyCampaignAction as act} from '../src/campaign.js';
import {openTab} from './support/ui.js';
async function action(page,snap,action){const response=await page.request.post('/api/campaign/action',{data:{runId:snap.runId,revision:snap.revision,requestId:randomUUID(),action}});expect(response.ok()).toBe(true);return response.json();}
for(const width of [320,390,1280])test(`daily supplies and restart are clear and usable at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:width===320?568:844});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let snap=await page.request.get('/api/campaign').then(r=>r.json());snap=await action(page,snap,{type:'chooseRole',role:'repairman'});snap=await action(page,snap,{type:'recruit',person:'lin'});snap=await action(page,snap,{type:'search',site:'shed'});expect(snap.state.people[0].fatigue).toBe(10);
 await page.goto('/');await expect(page.locator('#phase')).toHaveText('白天经营');
 const requests=[];page.on('request',r=>{if(r.method()==='POST')requests.push(r.url());});
 await page.getByRole('button',{name:'食物：查看每日消耗'}).click();await expect(page.getByTestId('daily-consumption')).toContainText('食物每日消耗 5');
 await expect(page.getByTestId('daily-consumption')).toContainText('2人基础消耗');await page.locator('[data-action=close-overlay]').click();
 await page.getByRole('button',{name:'净水：查看每日消耗'}).click();await expect(page.getByTestId('daily-consumption')).toContainText('净水每日消耗');
 const layout=await page.locator('#sheet-body').evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth,page:document.documentElement.scrollWidth,width:innerWidth}));expect(layout.scroll).toBeLessThanOrEqual(layout.client);expect(layout.page).toBeLessThanOrEqual(layout.width);
 await page.screenshot({path:`.local/day-actions/rations-${width}.png`,fullPage:true});await page.locator('[data-action=close-overlay]').click();
 await openTab(page,'explore');await expect(page.getByTestId('search-quick')).toContainText('疲劳+10');await expect(page.getByTestId('search-deep')).toContainText('疲劳+15');await page.locator('[data-action=close-overlay]').click();
 await page.getByRole('button',{name:'打开游戏菜单'}).click();page.once('dialog',d=>d.dismiss());await page.locator('[data-action=restart]').click();expect(requests).toEqual([]);
 page.once('dialog',d=>d.accept());await page.locator('[data-action=restart]').click();await expect(page.locator('#phase')).toHaveText('选择角色');expect(requests).toHaveLength(1);
 const fresh=await page.request.get('/api/campaign').then(r=>r.json());expect(fresh.state.phase).toBe('prologue');expect(fresh.revision).toBe(snap.revision+1);expect(fresh.state.searched).toEqual([]);await page.reload();await expect(page.locator('#phase')).toHaveText('选择角色');expect(errors).toEqual([]);
});
test('live nightly supplies use current facilities and cooking; failed restart retains the night and retries the same request',async({page})=>{
 let state=act(initialCampaign(314),{type:'chooseRole',role:'repairman'}),revision=0;
 state.day=13;state.ap=40;state.resources.materials=100;state=act(state,{type:'beds'});state=act(state,{type:'beds'});
 for(const person of ['lin','zhou','chen','meng'])state=act(state,{type:'recruit',person});state=act(state,{type:'build',building:'stove'});state=act(state,{type:'upgradeBuilding',id:state.buildings[0].id,branch:'yield'});state=act(state,{type:'assign',person:'meng',job:'cook'});state=act(state,{type:'prepare'});
 await page.route('**/api/campaign',route=>route.fulfill({json:{state,runId:'restart-night-ui',revision}}));
 const resets=[];await page.route('**/api/campaign/action',route=>{const data=route.request().postDataJSON();resets.push(data);if(resets.length===1)return route.abort('failed');state=act(state,data.action);return route.fulfill({json:{state,runId:'restart-night-ui',revision:++revision}});});
 const saves=[];page.on('request',r=>{if(r.url().endsWith('/night-result'))saves.push(r.url());});await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await page.locator('[data-action=start-night]').click();await expect(page.locator('#phase')).toHaveText('实时守夜');
 await page.getByRole('button',{name:'食物：查看每日消耗'}).click();await expect(page.getByTestId('daily-consumption')).toContainText('食物每日消耗 9');await expect(page.getByTestId('daily-consumption')).toContainText('−2食物');await expect(page.getByTestId('daily-consumption')).toContainText('−1食物');await page.locator('[data-action=close-overlay]').click();
 const id=await page.locator('#world').evaluate(el=>el.getNightSnapshot().id);await page.getByRole('button',{name:'打开游戏菜单'}).click();page.once('dialog',d=>d.accept());await page.locator('[data-action=restart]').click();await expect(page.locator('#error')).toContainText('操作结果未确认');expect(await page.locator('#world').evaluate(el=>el.getNightSnapshot().id)).toBe(id);
 await page.locator('[data-action=restart]').click();await expect(page.locator('#phase')).toHaveText('选择角色');expect(resets).toHaveLength(2);expect(resets[1]).toEqual(resets[0]);expect(await page.locator('#world').evaluate(el=>el.getNightSnapshot())).toBeNull();await expect.poll(()=>page.locator('#world').evaluate(el=>el.getNightDiagnostics().pendingSave)).toBe(false);expect(saves).toEqual([]);
});
test('restarting a real worker night saves the new game without late night settlement',async({page})=>{
 let snap=await page.request.get('/api/campaign').then(r=>r.json());snap=await action(page,snap,{type:'chooseRole',role:'medic'});snap=await action(page,snap,{type:'prepare'});await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await page.locator('[data-action=start-night]').click();await expect(page.locator('#phase')).toHaveText('实时守夜');
 await page.getByRole('button',{name:'打开游戏菜单'}).click();page.once('dialog',d=>d.accept());await page.locator('[data-action=restart]').click();await expect(page.locator('#phase')).toHaveText('选择角色');const stored=await page.request.get('/api/campaign').then(r=>r.json());expect(stored.state.phase).toBe('prologue');expect(stored.revision).toBe(snap.revision+1);expect(await page.locator('#world').evaluate(el=>el.getNightSnapshot())).toBeNull();
});
