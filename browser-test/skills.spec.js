import {openTab} from './support/ui.js';
import { test, expect } from '@playwright/test';

for(const width of [320,390])test(`skill lookup ${width}: current benefits and ranks are readable by day and night without spending`,async({page})=>{
 await page.setViewportSize({width,height:width===320?568:844});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:/修理工/}).click();
 await expect(page.locator('#phase')).toHaveText('白天经营');
 await expect(page.locator('#world')).toHaveAttribute('data-ready','true');
 await openTab(page,'members');
 await page.getByRole('button',{name:'技能说明 · 查看各级收益'}).click();
 const guide=page.getByTestId('skill-guide');
 await expect(guide).toContainText('每项技能最高3级');
 await page.locator('[data-group=skill][data-value=engineering]').click();
 await expect(page.getByTestId('skill-current')).toContainText('白天修栏恢复45耐久');
 await expect(page.getByTestId('skill-next')).toContainText('达到3级');
 await expect(guide.locator('dt')).toHaveCount(4);
 await expect(guide).toContainText('夜间恢复29耐久，作业4秒');
 await page.locator('[data-group=skill][data-value=survival]').click();
 await expect(guide).toContainText('0／1／2／3级照料种植分别增加2／2／3／3食物');await expect(guide.locator('dd')).toHaveText(['同伴照料种植：额外2食物／日','同伴照料种植：额外2食物／日','同伴照料种植：额外3食物／日','同伴照料种植：额外3食物／日']);
 await page.locator('[data-group=skill][data-value=exploration]').click();
 await expect(guide).toContainText('主角搜索基础收获不随探索技能增加');
 await page.locator('[data-group=skill][data-value=medical]').click();
 await expect(guide).toContainText('主角主动治疗和夜间自救目前均不增加护理技能');
 await page.locator('[data-action=close-overlay]').click();
 await page.locator('[data-action=prepare]').click();
 await page.locator('[data-action=start-night]').click();
 await expect(page.locator('[data-action=pause]')).toHaveText('继续');
 await expect.poll(()=>page.locator('#world').evaluate(el=>el.getNightSnapshot()?.paused)).toBe(true);
 const before={...await page.request.get('/api/campaign').then(r=>r.json()),battle:await page.locator('#world').evaluate(el=>el.getNightSnapshot())};
 await openTab(page,'members');
 await page.locator('[data-group=member][data-value=skills]').click();
 await page.locator('[data-group=skill][data-value=guard]').click();
 await expect(page.getByTestId('skill-current')).toContainText('自动攻击每次7伤害');
 await expect(page.getByTestId('skill-next')).toContainText('达到1级');
 await page.locator('[data-group=skill][data-value=engineering]').click();
 await expect(guide).toContainText('夜间恢复29耐久，作业4秒');
 const layout=await guide.evaluate(el=>{
  const sheet=document.querySelector('#overlay'),body=document.querySelector('#sheet-body');
  return {pageWidth:document.documentElement.scrollWidth,width:innerWidth,
   sheetRight:sheet.getBoundingClientRect().right,sheetBottom:sheet.getBoundingClientRect().bottom,
   height:innerHeight,bodyClient:body.clientWidth,bodyScroll:body.scrollWidth};
 });
 expect(layout.pageWidth).toBeLessThanOrEqual(layout.width);
 expect(layout.sheetRight).toBeLessThanOrEqual(layout.width);
 expect(layout.sheetBottom).toBeLessThanOrEqual(layout.height);
 expect(layout.bodyScroll).toBeLessThanOrEqual(layout.bodyClient);
 await page.screenshot({path:`test-results/skills-night-${width}.png`,fullPage:true});
 await page.locator('[data-group=member][data-value=status]').click();
 await expect(page.getByRole('button',{name:'设为执行者，回到战场'})).toBeVisible();
 const after={...await page.request.get('/api/campaign').then(r=>r.json()),battle:await page.locator('#world').evaluate(el=>el.getNightSnapshot())};
 expect(after.revision).toBe(before.revision);expect(after.battle.elapsed).toBe(before.battle.elapsed);
 expect(after.battle.resources).toEqual(before.battle.resources);expect(errors).toEqual([]);
});
