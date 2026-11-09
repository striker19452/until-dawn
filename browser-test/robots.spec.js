import {test,expect} from '@playwright/test';
import {initialCampaign,applyCampaignAction as act} from '../src/campaign.js';
import {installStorage,seedSave,readSave} from './support/storage.js';
const initial=()=>{const s=act(initialCampaign(53),{type:'chooseRole',role:'repairman'});s.resources={food:100,water:100,materials:100,fuel:100,medicine:100,parts:100};s.beds=5;s.ap=20;s.buildings=[{id:'workshop',type:'workshop',level:1,branch:'normal',hp:10,plot:0,age:0,enabled:true}];return s;};
async function openPlanner(page){if(await page.locator('#overlay').isVisible())await page.locator('[data-action="close-overlay"]').click();await page.locator('.mobile-menu').click();await page.locator('[data-action="drawer"][data-panel="robots"]').click();}
for(const viewport of [{width:390,height:844},{width:1280,height:900}])test(`robots manufacture, ordered planning, reload and night visuals ${viewport.width}`,async({page})=>{
 page.setDefaultTimeout(8000);await page.setViewportSize(viewport);const errors=[];page.on('pageerror',e=>errors.push(e.message));await installStorage(page);const state=initial();await seedSave(page,{runId:'robot-browser',revision:0,state});await page.goto('/');await expect(page.locator('#save')).toContainText('本机');
 await page.locator('.mobile-menu').click();await page.locator('#sheet-body [data-panel="build"][data-action="drawer"]').click();await page.getByRole('button',{name:'工作棚',exact:true}).click();await expect(page.locator('[data-action="upgrade"][data-branch="yield"]')).toBeVisible();await page.locator('[data-action="upgrade"][data-branch="yield"]').click();
 await page.getByRole('button',{name:'制造机器人／设置巡逻规划'}).click();await expect(page.locator('[data-testid="robots-panel"]')).toBeVisible();
 for(const robot of ['repair','defense','dispatch']){await page.locator(`[data-action="robot-build"][data-robot="${robot}"]`).click();await expect.poll(async()=> (await readSave(page)).state.robots.length).toBe(['repair','defense','dispatch'].indexOf(robot)+1);}
 const threshold=page.getByLabel('围栏／机体维修阈值');await expect(threshold.locator('option:checked')).toHaveText('低于75耐久');await expect(threshold).toHaveAccessibleDescription(/有建材可用就转去修。到达后作业2秒才恢复耐久/);
 await page.locator('#robot-add-zone').selectOption('left');await page.locator('[data-action="robot-route-add"]').click();await page.locator('[data-robot-field="materials"]').selectOption('2');await page.locator('[data-robot-field="parts"]').selectOption('1');await page.locator('[data-action="robot-route-up"][data-index="1"]').click();await page.locator('[data-action="robot-plan-save"]').click();
 await expect.poll(async()=>(await readSave(page)).state.robots[0].plan.route).toEqual(['left','gate']);await expect(page.locator('.robot-plan')).toContainText('已保存');
 await page.screenshot({path:`.local/robots-plan-${viewport.width}.png`});await page.reload();await expect.poll(()=>page.locator('canvas').evaluate(el=>el.getYardDiagnostics?.()?.tokens.filter(t=>t.id.startsWith('r-')).length)).toBe(3);
 await openPlanner(page);await expect(page.locator('.robot-route')).toContainText('1. 左栏');await expect(page.locator('[data-robot-field="materials"]')).toHaveValue('2');await expect(page.locator('[data-robot-field="parts"]')).toHaveValue('1');await expect(page.locator('.robot-plan')).toContainText('修机体耗1零件');
 const overflow=await page.locator('.robots-panel').evaluate(el=>el.scrollWidth>el.clientWidth+1);expect(overflow).toBe(false);
 await page.locator('[data-action="close-overlay"]').click();await page.locator('[data-action="prepare"]').click();await expect(page.locator('#phase')).toHaveText('黄昏准备');const prepared=await readSave(page);expect(prepared.state.resources.fuel).toBe(97);
 await openPlanner(page);await page.locator('#robot-add-zone').selectOption('right');await page.locator('[data-action="robot-route-add"]').click();await page.locator('[data-action="robot-plan-save"]').click();
 await expect.poll(async()=>(await readSave(page)).state.robots[0].plan.route).toEqual(['left','gate','right']);
 await page.locator('#robot-select').selectOption('robot-3');await page.locator('#robot-add-zone').selectOption('left');await page.locator('[data-action="robot-route-add"]').click();await page.locator('[data-robot-field="wait"]').selectOption('0');await page.locator('[data-action="robot-plan-save"]').click();
 await expect.poll(async()=>(await readSave(page)).state.robots[2].plan).toMatchObject({route:['gate','left'],wait:0});await page.locator('[data-action="close-overlay"]').click();
 await page.locator('[data-action="start-night"]').click();await expect.poll(()=>page.locator('#world').evaluate(el=>el.getNightSnapshot?.()?.robots.length)).toBe(3);
 await expect.poll(()=>page.locator('canvas').evaluate(el=>el.getYardDiagnostics?.()?.tokens.filter(t=>t.id.startsWith('r-')).length)).toBe(3);
 await page.screenshot({path:`.local/robots-yard-${viewport.width}.png`});
 await openPlanner(page);await expect(page.getByTestId('robot-night-lock')).toContainText('夜间模式与巡逻规划已锁定');
 for(const id of ['robot-1','robot-2','robot-3']){
  await page.locator('#robot-select').selectOption(id);await expect(page.locator('.robot-plan')).toHaveAttribute('disabled','');await expect(page.locator('[data-action="robot-plan-save"]')).toBeDisabled();await expect(page.locator('#robot-add-zone')).toBeDisabled();await expect(page.locator('[data-robot-field="wait"]')).toBeDisabled();
  if(id==='robot-2'){await expect(page.locator('.robot-plan')).toContainText('每1秒攻击一次，基础伤害15、眩晕1秒');await expect(page.locator('.robot-plan')).toContainText('基础伤害30、眩晕2秒');}
  if(id==='robot-1')await expect(page.locator('[data-robot-field="parts"]')).toBeDisabled();
 }
 await expect.poll(()=>page.locator('#world').evaluate(el=>el.getNightSnapshot?.()?.robots[0].plan.route)).toEqual(['left','gate','right']);await page.screenshot({path:`.local/robots-night-lock-${viewport.width}.png`});await page.locator('[data-action="close-overlay"]').click();
 const start=await page.locator('#world').evaluate(el=>el.getNightSnapshot().robots[2]);await page.locator('[data-action="pause"]:visible').first().click();
 await expect.poll(()=>page.locator('#world').evaluate((el,start)=>{const r=el.getNightSnapshot().robots[2];return Math.hypot(r.x-start.x,r.y-start.y);},start)).toBeGreaterThan(20);
 await page.locator('[data-action="pause"]:visible').first().click();await expect.poll(()=>page.locator('#world').evaluate(el=>el.getNightSnapshot().paused)).toBe(true);
 const runningPlans=await page.locator('#world').evaluate(el=>el.getNightSnapshot().robots.map(r=>r.plan));expect(runningPlans[0].route).toEqual(['left','gate','right']);expect(runningPlans[2].route).toEqual(['gate','left']);expect(runningPlans[2].wait).toBe(0);
 expect(errors).toEqual([]);
});
