import {openTab} from './support/ui.js';
import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {initialCampaign,applyCampaignAction as act,settleNight} from '../src/campaign.js';
import {createBattle} from '../src/battle.js';
import {orderDuration} from '../src/night-orders.js';

async function fixture(page){
 let state=act(initialCampaign(53),{type:'chooseRole',role:'repairman'}),revision=1;
 state=act(state,{type:'recruit',person:'lin'});state.people[0].fatigue=50;state.people[1].fatigue=25;
 await page.route('**/api/campaign',route=>route.fulfill({json:{state,runId:'fatigue-ui',revision}}));
 await page.route('**/api/campaign/action',route=>{state=act(state,route.request().postDataJSON().action);return route.fulfill({json:{state,runId:'fatigue-ui',revision:++revision}});});
 await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');
 return ()=>state;
}

for(const width of [320,390,1280])test(`fatigue ${width}: current penalties, rest benefit and day/night recovery rules stay readable`,async({page})=>{
 await page.setViewportSize({width,height:width===320?568:844});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));const state=await fixture(page);
 await openTab(page,'members');const panel=page.getByTestId('fatigue-effects');
 await expect(panel).toContainText('移动速度85%');await expect(panel).toContainText('夜间作业效率80%');await expect(panel).toContainText('体力恢复75%');
 await expect(panel).toContainText('常态1.2，有效篝火下1.5');
 await expect(panel).toContainText('巡守、支援岗位不恢复疲劳；整夜未被叫醒才有睡眠夜末−22');
 await expect(panel).toContainText('开始执行临时指令后取消当晚睡眠收益，回屋也不恢复');
 await expect(panel).toContainText('非重伤者清晨−10');
 await panel.scrollIntoViewIfNeeded();await page.screenshot({path:`.local/validation/fatigue/day-${width}.png`,fullPage:true});
 await page.locator('[data-group=member][data-value=work]').click();
 await expect(page.getByTestId('night-work-guide')).toContainText('巡守重点防区');
 await page.locator('[data-action=close-overlay]').click();await openTab(page,'manage');
 await page.locator('[data-action=rest][data-person=hero]').click();await expect.poll(()=>state().people[0].fatigue).toBe(22);
 await page.locator('[data-action=close-overlay]').click();await openTab(page,'members');
 await page.locator('[data-group=member][data-value=status]').click();
 await expect(panel).toContainText('移动速度93.4%');await expect(panel).toContainText('夜间作业效率91.2%');await expect(panel).toContainText('体力恢复89%');
 await page.locator('[data-action=close-overlay]').click();await page.locator('[data-action=prepare]').click();await page.locator('[data-action=start-night]').click();
 await expect(page.locator('#phase')).toHaveText('实时守夜');await openTab(page,'members');
 await expect(panel).toContainText('移动速度93.4%');await page.locator('[data-action=member-view][data-person=lin]').click();
 await expect(panel).toContainText('移动速度99.1%');await expect(panel).toContainText('夜间作业效率98.8%');
 const layout=await page.locator('#sheet-body').evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth,page:document.documentElement.scrollWidth,width:innerWidth}));
 expect(layout.scroll).toBeLessThanOrEqual(layout.client);expect(layout.page).toBeLessThanOrEqual(layout.width);
 await panel.scrollIntoViewIfNeeded();await page.screenshot({path:`.local/validation/fatigue/night-${width}.png`,fullPage:true});expect(errors).toEqual([]);
});

test('the real local worker uses the fatigued work duration shown by its countdown without contacting the server',async({page})=>{
 await fixture(page);await page.locator('[data-action=prepare]').click();await page.locator('[data-action=start-night]').click();
 await expect(page.locator('[data-action=pause]')).toHaveText('继续');
 const requests=[];page.on('request',request=>{if(request.url().includes('/api/'))requests.push(request.url());});
 await page.locator('[data-command=repair]').click();await page.locator('[data-action=pause]').click();
 await expect.poll(()=>page.locator('#world').evaluate(el=>el.getNightSnapshot()?.people[0].task?.stage)).toBe('work');
 await page.locator('[data-action=pause]').click();await expect(page.locator('[data-action=pause]')).toHaveText('继续');
 const battle=await page.locator('#world').evaluate(el=>el.getNightSnapshot()),p=battle.people[0];
 expect(orderDuration(p,'repair')).toBe(5);
 await expect(page.getByTestId('active-order')).toContainText(`剩余${Math.ceil(5-p.task.progress)}秒`);
 await page.locator('[data-action=pause]').click();
 await expect.poll(()=>page.locator('#world').evaluate(el=>el.getNightSnapshot()?.people[0].task),{timeout:10000}).toBeNull();
 const finished=await page.locator('#world').evaluate(el=>el.getNightSnapshot());
 expect(finished.zones[0].hp).toBe(79);expect(finished.elapsed).toBeGreaterThanOrEqual(5);
 expect(requests).toEqual([]);
});

test('actual saved support duty adds work fatigue, and the next morning removes exactly ten once',async({page})=>{
 let snap=await page.request.get('/api/campaign').then(r=>r.json());
 async function action(action){const response=await page.request.post('/api/campaign/action',{data:{runId:snap.runId,revision:snap.revision,requestId:randomUUID(),action}});expect(response.ok()).toBe(true);return snap=await response.json();}
 await action({type:'chooseRole',role:'repairman'});await action({type:'recruit',person:'lin'});
 await action({type:'assign',person:'lin',job:'forage'});await action({type:'nightRole',person:'lin',role:'support'});await action({type:'prepare'});
 expect(snap.state.people[1].fatigue).toBe(10);
 const b=createBattle(snap.state,`local-${snap.runId}-${snap.revision}`);b.challenge=null;b.work.lin=100;
 const result=settleNight(snap.state,b),payload={runId:snap.runId,revision:snap.revision,nightId:b.id,orderModel:'temporary-v1',result};
 const response=await page.request.post('/api/campaign/night-result',{data:payload});expect(response.ok()).toBe(true);snap=await response.json();
 expect(snap.state.people[1].fatigue).toBe(32);
 await action({type:'nextDay'});expect(snap.state.people[1].fatigue).toBe(22);
 const stored=await page.request.get('/api/campaign').then(r=>r.json());expect(stored.revision).toBe(snap.revision);expect(stored.state.people[1].fatigue).toBe(22);
 await page.goto('/');await openTab(page,'members');await page.locator('[data-action=member-view][data-person=lin]').click();
 await expect(page.getByTestId('fatigue-effects')).toContainText('移动速度93.4%');
});
