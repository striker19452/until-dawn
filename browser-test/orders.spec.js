import {openTab,selectZone} from './support/ui.js';
import {test,expect} from '@playwright/test';
import {initialCampaign,applyCampaignAction} from '../src/campaign.js';
import {randomUUID} from 'node:crypto';

const snapshot=page=>page.locator('#world').evaluate(el=>el.getNightSnapshot());
const active=page=>page.getByTestId('active-order');
async function boot(page){
 let state=applyCampaignAction(initialCampaign(53),{type:'chooseRole',role:'repairman'});
 state=applyCampaignAction(state,{type:'recruit',person:'lin'});
 state=applyCampaignAction(state,{type:'nightRole',person:'hero',role:'guard',zone:'left'});
 state=applyCampaignAction(state,{type:'nightRole',person:'lin',role:'support',zone:'right'});
 state.zones[2].hp=40;state=applyCampaignAction(state,{type:'prepare'});
 await page.route('**/api/campaign',route=>route.fulfill({json:{state,runId:randomUUID(),revision:1}}));
 await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await page.locator('[data-action=start-night]').click();await expect(page.locator('[data-action=pause]')).toHaveText('继续');
 await page.locator('#battle-person').selectOption('lin');await selectZone(page,'right');
}

for(const viewport of [{width:320,height:568},{width:390,height:844},{width:1280,height:900}])test(`temporary orders ${viewport.width}: assignment, live task and return behavior stay visible through completion`,async({page})=>{
 await page.setViewportSize(viewport);const errors=[],posts=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='POST')posts.push(r.url());});await boot(page);
 await expect(active(page).locator('[data-order=role]')).toHaveText('支援修补添火 · 右栏');
 await page.locator('[data-command=repair]').click();
 await expect(active(page).locator('[data-order=current]')).toContainText('临时修补');await expect(active(page).locator('[data-order=current]')).toContainText('待执行');
 await expect(active(page).locator('[data-order=after]')).toHaveText('恢复自动支援 · 重点右栏');
 const queued=(await snapshot(page)).people.find(p=>p.id==='lin');expect(queued.nightRole).toBe('support');expect(queued.zone).toBe('right');
 for(const selector of ['#panel','#zones','#nav','[data-action=pause]']){const box=await page.locator(selector).boundingBox();if(!box){expect(viewport.width).toBeLessThan(960);continue;}expect(box.y).toBeGreaterThanOrEqual(0);expect(box.y+box.height).toBeLessThanOrEqual(viewport.height+1);}
 if(viewport.width<960){await expect(active(page)).toBeHidden();await page.locator('[data-action=more-night]').click();await expect(page.getByTestId('person-order').locator('[data-order=current]')).toContainText('临时修补');await page.locator('[data-action=close-overlay]').click();}
 else for(const field of ['role','current','after'])expect(await active(page).locator(`[data-order=${field}]`).evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 await page.screenshot({path:`test-results/orders-queued-${viewport.width}.png`});
 await page.locator('[data-action=pause]').click();await expect(active(page).locator('[data-order=current]')).toContainText('剩余');
 await expect.poll(async()=>{const task=(await snapshot(page)).people.find(p=>p.id==='lin').task;return !task||task.automatic===true;},{timeout:10000}).toBe(true);
 await page.locator('[data-action=pause]').click();await expect(active(page).locator('[data-order=current]')).toContainText(/按分工自动支援|自动(支援)?修补|自动添火/);
 const done=(await snapshot(page)).people.find(p=>p.id==='lin');expect(done.nightRole).toBe('support');expect(done.zone).toBe('right');
 await openTab(page,'members');await page.locator('[data-action=member-view][data-person=lin]').click();
 await expect(page.getByTestId('person-order').locator('[data-order=role]')).toHaveText('支援修补添火 · 右栏');await expect(page.getByTestId('person-order').locator('[data-order=after]')).toContainText('恢复自动支援');
 await page.screenshot({path:`test-results/orders-member-${viewport.width}.png`});expect(posts).toEqual([]);expect(errors).toEqual([]);
});

test('cancelling a paused manual job returns its reservation and clearly resumes the configured support role',async({page})=>{
 await boot(page);const materials=(await snapshot(page)).resources.materials;
 await page.locator('[data-command=repair]').click();await expect.poll(async()=>(await snapshot(page)).resources.materials).toBe(materials-1);
 await page.locator('[data-action=more-night]').click();await expect(page.getByTestId('person-order').locator('[data-order=current]')).toContainText('临时修补');
 await page.locator('[data-command=cancel]').click();await expect.poll(async()=>(await snapshot(page)).resources.materials).toBe(materials);
 await expect(page.getByTestId('person-order').locator('[data-order=current]')).toContainText('按分工自动支援');
 await expect(page.getByTestId('person-order').locator('[data-order=after]')).toContainText('重点右栏');
 expect((await snapshot(page)).people.find(p=>p.id==='lin').nightRole).toBe('support');
});
