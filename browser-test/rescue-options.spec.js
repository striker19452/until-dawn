import {test,expect} from '@playwright/test';
import {openTab} from './support/ui.js';

async function testDay(page,day){
 await page.goto(`/?test=${day}`);await expect(page.locator('#phase')).toHaveText('测试 · 实时守夜');await page.getByRole('button',{name:'打开游戏菜单'}).click();await page.locator('[data-action=test-prepare]').click();await expect(page.locator('#phase')).toHaveText('测试 · 白天经营');
}
async function goTab(page,tab){if(await page.locator('#overlay').isVisible())await page.locator('[data-action=close-overlay]').click();await openTab(page,tab);}
async function routePanel(page){await goTab(page,'radio');await page.locator('[data-group=radio][data-value=route]').click();}
const stock=(page,key)=>page.locator(`[data-resource=${key}] b`).first().textContent().then(Number);

for(const width of [320,390,1280])test(`rescue actions explain and deliver their real benefits at ${width}px without changing formal progress`,async({page})=>{
 await page.setViewportSize({width,height:width===320?568:900});const before=await page.request.get('/api/campaign').then(r=>r.json()),api=[],errors=[];page.on('request',r=>{if(r.url().includes('/api/'))api.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
 await testDay(page,28);await routePanel(page);await expect(page.getByTestId('route-road')).toContainText('正门');await expect(page.getByTestId('route-river')).toContainText('后左栏');await expect(page.getByTestId('route-work-guide')).toContainText('1行动 · 3建材');
 await page.locator('[data-action=route][data-route=river]').click();await page.locator('[data-action=route-work]').click();await page.locator('[data-action=route-work]').click();await expect(page.getByTestId('rescue-benefit')).toContainText('少来2只普通生物');expect(await stock(page,'materials')).toBe(114);
 await expect(page.getByTestId('help-guide')).toContainText('4建材、1药品');await page.locator('[data-action=help]').click();expect(await stock(page,'materials')).toBe(118);expect(await stock(page,'food')).toBe(77);expect(await stock(page,'medicine')).toBe(21);await expect(page.getByTestId('rescue-benefit')).toContainText('少来3只普通生物');await expect(page.locator('[data-action=help]')).toBeDisabled();await expect(page.getByTestId('help-guide')).toContainText('本局已无再次援助机会');
 await page.locator('[data-action=site-shortcut][data-site=contact]').click();await expect(page.getByTestId('search-side-effect')).toContainText('转交当前所选路线');await page.locator('[data-action=search]').click();await routePanel(page);await expect(page.getByTestId('pickup-status')).toHaveText('已满足抵近接应条件。');
 const layout=await page.locator('#sheet-body').evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth,page:document.documentElement.scrollWidth,width:innerWidth}));expect(layout.scroll).toBeLessThanOrEqual(layout.client);expect(layout.page).toBeLessThanOrEqual(layout.width);await page.getByTestId('rescue-benefit').scrollIntoViewIfNeeded();await page.screenshot({path:`.local/rescue-options/route-${width}.png`,fullPage:true});
 await page.locator('[data-action=close-overlay]').click();await page.locator('[data-action=prepare]').click();await page.locator('[data-action=start-night]').click();await expect(page.locator('#phase')).toHaveText('测试 · 实时守夜');const b=await page.locator('#world').evaluate(el=>el.getNightSnapshot());expect(b.schedule).toHaveLength(10);expect(b.boss.zone).toBe('backLeft');expect(b.zones.find(z=>z.id==='backLeft').traps).toBe(1);expect(b.zones.find(z=>z.id==='backRight').traps).toBe(1);expect(b.paused).toBe(true);expect(api).toEqual([]);
 await page.getByRole('button',{name:'打开游戏菜单'}).click();await page.locator('[data-action=test-exit]').click();expect(await page.request.get('/api/campaign').then(r=>r.json())).toEqual(before);expect(errors).toEqual([]);
});

test('all six story actions expose costs, real rewards and prerequisites before acting',async({page})=>{
 test.setTimeout(90000);
 for(const [day,effect] of [[8,'恐惧−18'],[10,'次日自动转报登记'],[17,'从6秒降至4秒'],[19,'4建材、3燃料'],[24,'恐惧−12'],[27,'不增加物资或战力']]){
  await testDay(page,day);await goTab(page,'story');await expect(page.getByTestId('story-choice')).toContainText('消耗：');await expect(page.getByTestId('story-effect')).toContainText(effect);
  if(day===10){await expect(page.locator('[data-action=event]')).toBeDisabled();await expect(page.getByTestId('story-choice')).toContainText('需先建立互助留言处');continue;}
  await page.locator('[data-action=event]').click();await expect(page.getByTestId('story-choice')).toHaveCount(0);
  if(day===19){expect(await stock(page,'parts')).toBe(18);expect(await stock(page,'materials')).toBe(124);expect(await stock(page,'fuel')).toBe(33);}
  if(day===24){await routePanel(page);await expect(page.getByTestId('rescue-benefit')).toContainText('援助−1');}
 }
});

test('manage, member, search and night menus reveal outcomes and prevent day actions after dusk',async({page})=>{
 await testDay(page,18);await expect(page.locator('[data-action=house-repair]')).toContainText('房屋耐久+30');await expect(page.locator('[data-action=craft][data-item=medicine]')).toContainText('→ 1药品');
 await goTab(page,'members');await expect(page.getByTestId('treatment-guide')).toContainText('健康+30');await page.locator('[data-action=member-view][data-person=lin]').click();await page.locator('[data-group=member][data-value=story]').click();await expect(page.getByTestId('personal-story-effect')).toContainText('恐惧−15');await expect(page.locator('[data-action=story]')).toBeDisabled();
 await goTab(page,'explore');await page.locator('#site-view').selectOption('contact');await expect(page.getByTestId('search-side-effect')).toContainText('自动递交院落登记');await page.locator('#site-view').selectOption('rescue');await expect(page.getByTestId('search-side-effect')).toContainText('路线准备+1');
 await page.locator('[data-action=close-overlay]').click();await page.locator('[data-action=prepare]').click();await goTab(page,'members');await page.locator('[data-group=member][data-value=work]').click();await expect(page.locator('select[data-change=night-role]')).toBeDisabled();await expect(page.locator('#sheet-body')).toContainText('返回白天后才能更改安排');await page.locator('[data-action=close-overlay]').click();await page.locator('[data-action=start-night]').click();await expect(page.locator('#phase')).toHaveText('测试 · 实时守夜');
 await page.locator('[data-action=more-night]').click();await expect(page.locator('[data-command=throw]')).toContainText('基础10伤害、眩晕2秒');await expect(page.locator('[data-command=bait]')).toContainText('重撞兽和首领无效');await expect(page.locator('[data-command=compact]')).toContainText('浅掘速度×0.35');await expect(page.locator('[data-command=aid]')).toContainText('健康至少42');await expect(page.locator('[data-command=barricade]')).toContainText('房屋耐久+20');await expect(page.locator('[data-command=clearWet]')).toContainText('解除中央篝火湿污');
 await page.locator('[data-command=throw]').scrollIntoViewIfNeeded();await page.screenshot({path:'.local/rescue-options/night-actions-390.png',fullPage:true});
});
