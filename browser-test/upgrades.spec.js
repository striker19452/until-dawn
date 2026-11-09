import { test,expect } from '@playwright/test';
import {UPGRADE_TEXT,facilityOutput} from '../src/rules.js';
import { weather } from '../src/content.js';
import {installStorage,readSave} from './support/storage.js';

async function facility(page,type){await page.locator('[data-action="drawer"][data-panel="build"]').click();if(await page.locator('#facility-view').isVisible())await page.locator('#facility-view').selectOption(type);else await page.locator(`[data-action="facility"][data-building="${type}"]`).click();}

for(const type of ['garden','water','watchtower'])for(const branch of ['yield','steady'])test(`${type}/${branch}: published tradeoff, actual cost, saved branch and dusk effect`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 if(type==='water'&&branch==='steady')await page.setViewportSize({width:320,height:568});
 await installStorage(page);
 await page.goto('/');await page.getByRole('button',{name:/修理工/}).click();await expect(page.locator('#phase')).toHaveText('白天经营');
 await facility(page,type);await page.locator(`[data-action="build"][data-building="${type}"]`).click();await expect(page.locator('[data-action="upgrade"]')).toHaveCount(2);
 if(type==='watchtower')await expect(page.getByTestId('building-health')).toContainText('50/50');
 const text=[UPGRADE_TEXT[type].yield,UPGRADE_TEXT[type].steady];
 for(const line of text)await expect(page.locator('#sheet-body')).toContainText(line);
 const before=await readSave(page);await page.locator(`[data-action="upgrade"][data-branch="${branch}"]`).click();await expect(page.locator('.card h3')).toContainText(`2级 · ${branch==='yield'?'高产':'耐候'}`);
 const after=await readSave(page);expect(after.state.ap).toBe(before.state.ap-2);expect(after.state.resources.materials).toBe(before.state.resources.materials-4);expect(after.state.resources.parts).toBe(before.state.resources.parts-1);
 await page.reload();await expect(page.locator('#phase')).toHaveText('白天经营');await facility(page,type);await expect(page.locator('.card')).toContainText(text[branch==='yield'?0:1]);await expect(page.locator('[data-action="upgrade"]')).toHaveCount(0);
 const size=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));expect(size.scroll).toBeLessThanOrEqual(size.width);await page.screenshot({path:`test-results/upgrade-${type}-${branch}.png`,fullPage:true});
 await page.locator('[data-action="close-overlay"]').click();await page.locator('[data-action="prepare"]').click();await expect(page.locator('#phase')).toHaveText('黄昏准备');
 const prepared=await readSave(page),w=weather(after.state.day,after.state.seed);expect(prepared.state.buildings[0].branch).toBe(branch);
 if(type==='garden'){expect(prepared.state.resources.food).toBe(after.state.resources.food);expect(prepared.state.buildings[0].age).toBe(1);}
 if(type==='water'){const amount=facilityOutput(prepared.state.buildings[0],w);expect(prepared.state.resources.water-after.state.resources.water).toBe(amount);}
 if(type==='watchtower'){await page.locator('[data-action="start-night"]').click();const expected=branch==='steady'?(w==='fog'?45:35):(w==='fog'?31.5:45);await expect.poll(()=>page.locator('#world').evaluate(el=>el.getNightSnapshot?.()?.warningLead)).toBeCloseTo(expected,8);}
 expect(errors).toEqual([]);
});
