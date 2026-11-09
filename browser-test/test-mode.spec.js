import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {openTab} from './support/ui.js';
import {createBattle,stepBattle} from '../src/battle.js';
import {settleNight} from '../src/campaign.js';
import {localNightId} from '../src/local-night.js';

async function formalProgress(page){let snap=await page.request.get('/api/campaign').then(r=>r.json());const r=await page.request.post('/api/campaign/action',{data:{runId:snap.runId,revision:snap.revision,requestId:randomUUID(),action:{type:'chooseRole',role:'repairman'}}});expect(r.ok()).toBe(true);return page.request.get('/api/campaign').then(r=>r.json());}
const snapshot=page=>page.locator('#world').evaluate(el=>el.getNightSnapshot());
async function menu(page){await page.getByRole('button',{name:'打开游戏菜单'}).click();}

for(const [width,day,boss,preset] of [[320,7,'bastion','crew'],[390,14,'broodmother','solo'],[1280,28,'twinvein','crew']])test(`select night ${day} at ${width}px, adjust preparation locally and return to unchanged formal progress`,async({page})=>{
 await page.setViewportSize({width,height:width===320?568:844});const before=await formalProgress(page),posts=[],errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/api/')&&r.method()==='POST')posts.push(r.url());});
 await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await menu(page);await page.locator('[data-panel=test]').click();
 await expect(page.locator('#test-day option')).toHaveCount(28);await page.locator('#test-day').selectOption(String(day));await page.locator('#test-role').selectOption('medic');await page.locator('#test-preset').selectOption(preset);await expect(page.getByTestId('test-level-preview')).toContainText(`第${day}夜`);
 const layout=await page.locator('#sheet-body').evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth,page:document.documentElement.scrollWidth,width:innerWidth}));expect(layout.scroll).toBeLessThanOrEqual(layout.client);expect(layout.page).toBeLessThanOrEqual(layout.width);await page.screenshot({path:`.local/test-mode/picker-${width}.png`,fullPage:true});
 await page.locator('[data-action=test-start]').click();await expect(page).toHaveURL(new RegExp(`test=${day}`));await expect(page.locator('#phase')).toHaveText('测试 · 实时守夜');await expect.poll(async()=>(await snapshot(page))?.day).toBe(day);
 const b=await snapshot(page);expect(b.paused).toBe(true);expect(b.boss.id).toBe(boss);expect(b.people).toHaveLength(preset==='crew'?5:1);expect(b.people[0].role).toBe('医护人员');expect(b.resources.materials).toBe(120);expect(posts).toEqual([]);await page.screenshot({path:`.local/test-mode/night-${width}.png`,fullPage:true});
 await menu(page);await page.locator('[data-action=test-prepare]').click();await expect(page.locator('#phase')).toHaveText('测试 · 白天经营');await openTab(page,'build');if(await page.locator('#facility-view').isVisible())await page.locator('#facility-view').selectOption('watchtower');else await page.locator('[data-action=facility][data-building=watchtower]').click();await page.locator('[data-action=build][data-building=watchtower]').click();await expect(page.getByTestId('building-card')).toContainText('耐久 50/50');await page.locator('[data-action=close-overlay]').click();await page.locator('[data-action=prepare]').click();await expect(page.locator('#phase')).toHaveText('测试 · 黄昏准备');await page.locator('[data-action=start-night]').click();await expect(page.locator('#phase')).toHaveText('测试 · 实时守夜');
 const adjusted=await snapshot(page);expect(adjusted.buildings.some(b=>b.type==='watchtower')).toBe(true);expect(adjusted.resources.materials).toBe(115);expect(posts).toEqual([]);
 await menu(page);await page.locator('[data-action=test-exit]').click();await expect(page).not.toHaveURL(/test=/);await expect(page.locator('#phase')).toHaveText('白天经营');expect(await page.request.get('/api/campaign').then(r=>r.json())).toEqual(before);expect(posts).toEqual([]);expect(errors).toEqual([]);
});

test('a real test worker runs the selected boss offline and pending formal requests stay untouched',async({page,context})=>{
 const before=await formalProgress(page),pending={runId:before.runId,revision:before.revision,requestId:randomUUID(),action:{type:'search',site:'shed'}},requests=[];
 await page.addInitScript(value=>sessionStorage.setItem('dawn-campaign-pending',JSON.stringify(value)),pending);page.on('request',r=>{if(r.url().includes('/api/'))requests.push(r.url());});
 await page.goto('/?test=21&testRole=watchman&testPreset=solo');await expect(page.locator('#phase')).toHaveText('测试 · 实时守夜');expect((await snapshot(page)).boss.id).toBe('cinderwhale');expect(requests).toEqual([]);
 await context.setOffline(true);await page.locator('[data-action=pause]').click();await expect.poll(async()=>(await snapshot(page)).elapsed).toBeGreaterThan(1);await page.locator('[data-action=pause]').click();await expect.poll(async()=>(await snapshot(page)).paused).toBe(true);expect(JSON.parse(await page.evaluate(()=>sessionStorage.getItem('dawn-campaign-pending')))).toEqual(pending);expect(requests).toEqual([]);
 await menu(page);await page.locator('[data-action=test-prepare]').click();await openTab(page,'manage');await page.locator('[data-action=craft][data-item=fuel]').click();expect(requests).toEqual([]);await context.setOffline(false);expect(await page.request.get('/api/campaign').then(r=>r.json())).toEqual(before);
});

test('a complete test night displays a local report, can restart, and never uploads a night result',async({page})=>{
 const before=await formalProgress(page),posts=[];page.on('request',r=>{if(r.url().includes('/api/')&&r.method()==='POST')posts.push(r.url());});
 await page.exposeFunction('__completeTestNight',base=>{const b=createBattle(base.state,localNightId(base),{autoPause:false});b.paused=false;for(let i=0;i<10000&&!b.finished;i++)stepBattle(b);expect(b.finished).toBe(true);return {type:'state',battle:b,result:settleNight(base.state,b),steps:Math.round(b.elapsed*20)};});
 await page.addInitScript(()=>{const Native=window.Worker;window.Worker=class extends EventTarget{constructor(url,options){super();if(!String(url).includes('night-worker'))return new Native(url,options);queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:{type:'ready'}})));}postMessage(m){if(m.type==='init')window.__completeTestNight(m.base).then(data=>this.dispatchEvent(new MessageEvent('message',{data})));}terminate(){}};});
 await page.goto('/?test=1');await expect(page.locator('#phase')).toHaveText('测试 · 天亮战报');await expect(page.getByTestId('night-elapsed')).toBeVisible();expect(await snapshot(page)).toBeNull();expect(posts).toEqual([]);expect(await page.request.get('/api/campaign').then(r=>r.json())).toEqual(before);
 await page.locator('[data-action=close-overlay]').click();await page.locator('[data-action=retry]').click();await expect(page.locator('#phase')).toHaveText('测试 · 白天经营');await menu(page);await page.locator('[data-action=restart]').click();await expect(page.locator('#phase')).toHaveText('测试 · 天亮战报');expect(posts).toEqual([]);expect(await page.request.get('/api/campaign').then(r=>r.json())).toEqual(before);
});

test('the opening screen has a test entry and invalid direct levels remain isolated',async({page})=>{
 const requests=[];await page.goto('/');await page.locator('[data-action=drawer][data-panel=test]:visible').click();await expect(page.getByTestId('test-mode-picker')).toBeVisible();page.on('request',r=>{if(r.url().includes('/api/'))requests.push(r.url());});
 await page.goto('/?test=99');await expect(page.getByTestId('test-mode-picker')).toBeVisible();await expect(page.locator('#error')).toContainText('第1～28夜');expect(await snapshot(page)).toBeNull();expect(requests).toEqual([]);
});
