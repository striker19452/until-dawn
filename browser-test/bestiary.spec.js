import {openTab} from './support/ui.js';
import { test,expect } from '@playwright/test';
import { initialCampaign,applyCampaignAction } from '../src/campaign.js';
import { ENEMIES } from '../src/content.js';

async function openBestiary(page){
 await openTab(page,'journal');
 await page.locator('[data-group=journal][data-value=bestiary]').click();
}
async function checkLayout(page){
 const result=await page.locator('#sheet-body').evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth,
  pageWidth:document.documentElement.scrollWidth,width:innerWidth,
  bottom:document.querySelector('#overlay').getBoundingClientRect().bottom,height:innerHeight}));
 expect(result.scroll).toBeLessThanOrEqual(result.client);
 expect(result.pageWidth).toBeLessThanOrEqual(result.width);expect(result.bottom).toBeLessThanOrEqual(result.height);
}

test('first encounter unlocks locally; a refresh discards unsaved encounters and returns to preparation',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:/修理工/}).click();
 await expect(page.locator('.shell')).toHaveAttribute('data-phase','day');await expect(page.locator('#overlay')).toBeHidden();
 await expect(page.locator('#world')).toHaveAttribute('data-ready','true');
 await openBestiary(page);const book=page.getByTestId('bestiary');
 await expect(page.getByTestId('bestiary-empty')).toBeVisible();
 await expect(book.locator('[data-action=species]:disabled')).toHaveCount(Object.keys(ENEMIES).length);
 await expect(book).not.toContainText('灰行者');await expect(page.getByTestId('bestiary-entry')).toHaveCount(0);
 await page.locator('[data-action=close-overlay]').click();
 await page.locator('[data-action=prepare]').click();await page.locator('[data-action=start-night]').click();
 await expect(page.locator('[data-action=pause]')).toHaveText('继续');
 const before=await page.request.get('/api/campaign').then(r=>r.json());
 await page.locator('[data-action=pause]').click();
 await page.getByRole('button',{name:'图鉴已解锁 · 查看'}).waitFor({timeout:35000});
 await page.getByRole('button',{name:'图鉴已解锁 · 查看'}).click({delay:250});
 const entry=page.getByTestId('bestiary-entry');await expect(entry).toContainText('灰行者');
 await expect(book.locator('[data-action=species]:disabled')).toHaveCount(Object.keys(ENEMIES).length-1);
 await expect(entry).toContainText('34.5');await expect(entry).toContainText('1.55秒');
 await expect(entry.locator('svg image')).toHaveAttribute('href',/creatures-walk-a/);
 await checkLayout(page);await page.screenshot({path:'test-results/bestiary-first-encounter.png',fullPage:true});
 const unlocked=await page.request.get('/api/campaign').then(r=>r.json());
 expect(unlocked.revision).toBe(before.revision);expect(unlocked.state.flags.seenTypes||[]).toEqual([]);
 expect(await page.locator('#world').evaluate(el=>el.getNightSnapshot().seen)).toContain('walker');
 await page.reload();await openBestiary(page);await expect(page.getByTestId('bestiary-empty')).toBeVisible();
 const reloaded=await page.request.get('/api/campaign').then(r=>r.json());
 expect(reloaded.state.phase).toBe('ready');expect(await page.locator('#world').evaluate(el=>el.getNightSnapshot())).toBeNull();
 expect(reloaded.revision).toBe(unlocked.revision);expect(errors).toEqual([]);
});

test('saved encounters show all regular and boss portraits and exact stats on a small phone',async({page})=>{
 await page.setViewportSize({width:320,height:568});
 const state=applyCampaignAction(initialCampaign(),{type:'chooseRole',role:'repairman'});
 state.day=23;state.flags.seenTypes=Object.keys(ENEMIES);
 await page.route('**/api/campaign',route=>route.fulfill({json:{state,runId:'bestiary-ui',revision:1}}));
 await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');
 await openBestiary(page);const book=page.getByTestId('bestiary'),entry=page.getByTestId('bestiary-entry');
 await expect(book).toContainText(`已发现 ${Object.keys(ENEMIES).length} / ${Object.keys(ENEMIES).length} 种`);
 for(const [id,enemy] of Object.entries(ENEMIES)){
  await page.locator(`[data-action=species][data-species=${id}]`).click();
  await expect(entry.locator('h3').first()).toHaveText(enemy.name);
  const values=await entry.locator('.bestiary-stats dd').allTextContents();
  expect(values).toEqual([String(enemy.hp),String(enemy.damage),`${enemy.interval}秒`,`${enemy.speed} 距离／秒${enemy.agile?' · 灵活型':''}`]);
  await expect(entry.getByRole('img')).toHaveAccessibleName(`${enemy.name}的${enemy.boss?'独立生物外观':'外观'}`);
  await expect(entry.locator('svg image')).toHaveAttribute('href',enemy.boss?new RegExp(enemy.art+'-'):id==='skitter'?/skitter-walk-v1/:(id==='walker'||id==='climber'||id==='rammer'?/creatures-walk-a/:/creatures-walk-b/));
  await expect(entry).toContainText('增加1恐惧');await checkLayout(page);
 }
 await page.locator('[data-action=species][data-species=quencher]').click();await expect(entry).toContainText('喷污损失9火势');await expect(entry).toContainText('湿污4秒');await expect(entry).toContainText('无距离限制');await expect(entry).not.toContainText('105距离');
 await page.screenshot({path:'test-results/bestiary-saved-320.png',fullPage:true});
});
