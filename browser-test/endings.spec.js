import {test,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {createTestSession} from '../src/test-mode.js';
import {createBattle,stepBattle} from '../src/battle.js';
import {settleNight,applyCampaignAction} from '../src/campaign.js';
import {validateClientResult} from '../src/client-result.js';
import {localNightId} from '../src/local-night.js';

const evidence='.local/ending-screens';mkdirSync(evidence,{recursive:true});
function complete(base,id='ending-night'){
 const battle=createBattle(base,id,{autoPause:false});battle.paused=false;
 for(let i=0;i<18000&&!battle.finished;i++)stepBattle(battle);
 assert.ok(battle.finished);const state=settleNight(base,battle);validateClientResult(base,state);return {battle,state};
}
function fixture(outcome){
 const {snapshot,dawn}=createTestSession({day:outcome==='victory'?28:7,seed:53,preset:outcome==='victory'?'crew':'solo'}),base=snapshot.state;
 if(outcome==='defeat'){base.people[0].nightRole='sleep';base.flags.centralFire=false;}
 const result=complete(base);assert.equal(result.state.phase,outcome==='victory'?'rescued':'failed');return {...result,base,dawn};
}
const fixtures={victory:fixture('victory'),defeat:fixture('defeat')};
async function mount(page,outcome){
 const f=structuredClone(fixtures[outcome]);let state=f.state,revision=1;const actions=[];
 await page.route('**/api/campaign',route=>route.fulfill({json:{state,runId:'ending-fixture',revision}}));
 await page.route('**/api/campaign/action',async route=>{const data=route.request().postDataJSON();actions.push(data.action);if(data.action.type==='retryDay'){state=structuredClone(f.dawn);state.phase='day';}else state=applyCampaignAction(state,data.action);await route.fulfill({json:{state,runId:'ending-fixture',revision:++revision}});});
 await page.goto('/');await expect(page.getByTestId('ending-screen')).toBeVisible();return {actions,get state(){return state;},dawn:f.dawn};
}

for(const [width,height] of [[320,568],[390,844],[1280,900],[844,390]])for(const outcome of ['victory','defeat'])test(`${outcome} ending at ${width}x${height}: artwork, accessible modal, report and primary action`,async({page})=>{
 await page.setViewportSize({width,height});await page.emulateMedia({reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));const f=await mount(page,outcome),screen=page.getByTestId('ending-screen');
 await expect(screen).toHaveAttribute('data-outcome',outcome);await expect(page.locator('#overlay')).toHaveAttribute('aria-modal','true');await expect(page.locator('#ending-title')).toBeFocused();
 await expect.poll(()=>page.locator('.ending-art>img').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
 const layout=await page.locator('#overlay').evaluate(el=>{const r=el.getBoundingClientRect(),button=el.querySelector('.ending-primary').getBoundingClientRect();return {full:r.x===0&&r.y===0&&Math.abs(r.width-innerWidth)<1&&Math.abs(r.height-innerHeight)<1,button:button.y>=0&&button.bottom<=innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,inert:document.querySelector('.shell').inert};});expect(layout).toEqual({full:true,button:true,overflow:false,inert:true});
 if(outcome==='defeat')expect(await page.getByTestId('ending-reason').evaluate(el=>{const r=el.getBoundingClientRect(),area=el.closest('.ending-details').getBoundingClientRect();return r.top>=area.top&&r.bottom<=area.bottom;})).toBe(true);
 await page.screenshot({path:`${evidence}/${outcome}-${width}.png`,fullPage:true});
 await page.keyboard.press('Shift+Tab');await expect(page.locator('.ending-actions button').last()).toBeFocused();await page.keyboard.press('Tab');await expect(page.locator('.sheet-close')).toBeFocused();
 await page.getByRole('button',{name:'查看本夜战报',exact:true}).click();await expect(page.locator('#overlay')).not.toHaveClass(/ending-sheet/);await expect(page.getByTestId('night-elapsed')).toBeVisible();await page.locator('[data-group=report][data-value=events]').click();await page.getByRole('button',{name:'返回结局画面'}).click();await expect(screen).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.locator('#overlay')).toBeHidden();expect(await page.locator('.shell').evaluate(el=>el.inert)).toBe(false);await page.locator('#advance [data-panel=ending]').click();await expect(screen).toBeVisible();
 page.once('dialog',async dialog=>{expect(dialog.type()).toBe('confirm');await dialog.accept();});await page.locator('.ending-primary').click();
 if(outcome==='victory'){await expect(page.locator('#phase')).toHaveText('选择角色');expect(f.actions).toEqual([{type:'restart',confirm:true}]);expect(f.state.role).toBeNull();}
 else{await expect(page.locator('#phase')).toHaveText('白天经营');expect(f.actions).toEqual([{type:'retryDay'}]);expect(f.state.house).toBe(f.dawn.house);expect(f.state.resources).toEqual(f.dawn.resources);}
 await expect(screen).not.toBeVisible();expect(await page.locator('.shell').evaluate(el=>el.inert)).toBe(false);expect(errors).toEqual([]);
});

test('failure explains the hero treatment deadline even when the house survives',async({page})=>{
 const session=createTestSession({day:4,preset:'solo'}),base=session.snapshot.state;Object.assign(base.people[0],{wound:'severe',health:10,deadline:4});const battle=createBattle(base,'deadline',{autoPause:false});battle.schedule=[];battle.challenge=null;battle.paused=false;stepBattle(battle);const state=settleNight(base,battle);expect(state.phase).toBe('failed');expect(state.house).toBe(100);
 await page.route('**/api/campaign',route=>route.fulfill({json:{state,runId:'deadline',revision:1}}));await page.goto('/');await expect(page.getByTestId('ending-reason')).toContainText('主角未能在重伤期限内获救治');await expect(page.getByTestId('ending-reason')).not.toContainText('小屋耐久归零');await expect(page.locator('.ending-stats>div').nth(2).locator('strong')).toHaveText('100');
});

async function useFinishedWorker(page){
 await page.exposeFunction('__endNightForUI',base=>{const {battle,state}=complete(base.state,localNightId(base));return {type:'state',battle,result:state,steps:Math.round(battle.elapsed*20)};});
 await page.addInitScript(()=>{const Native=window.Worker;window.Worker=class extends EventTarget{constructor(url,options){super();if(!String(url).includes('night-worker'))return new Native(url,options);queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:{type:'ready'}})));}postMessage(m){if(m.type==='init')window.__endNightForUI(m.base).then(data=>this.dispatchEvent(new MessageEvent('message',{data})));}terminate(){}};});
}

test('offline victory is clearly pending, then becomes saved after reconnection without duplicate results',async({page,context})=>{
 const {base}=structuredClone(fixtures.victory);let state=base,revision=1;const payloads=[];await useFinishedWorker(page);
 await page.route('**/api/campaign',route=>route.fulfill({json:{state,runId:'offline-ending',revision}}));await page.route('**/api/campaign/night-result',async route=>{const data=route.request().postDataJSON();payloads.push(data);validateClientResult(base,data.result);state=data.result;await route.fulfill({json:{state,runId:'offline-ending',revision:++revision}});});
 await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await expect.poll(()=>page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>/victory-|defeat-/.test(r.name)).length)).toBe(2);await context.setOffline(true);await page.locator('[data-action=start-night]').click();
 const screen=page.getByTestId('ending-screen');await expect(screen).toHaveAttribute('data-pending','true');await expect(screen).toContainText('结果待保存');await expect(screen.locator('[data-action=restart],[data-action=retry]')).toHaveCount(0);expect(payloads).toHaveLength(0);
 await context.setOffline(false);await expect(screen).toHaveAttribute('data-pending','false');await expect(screen).toContainText('本局结果已保存');await expect(screen.locator('[data-action=restart]')).toBeVisible();expect(payloads).toHaveLength(1);expect(state.phase).toBe('rescued');
});

test('failed save keeps the defeat ending and retries the exact same night payload',async({page})=>{
 const {base}=structuredClone(fixtures.defeat);let state=base,revision=1;const payloads=[];await useFinishedWorker(page);
 await page.route('**/api/campaign',route=>route.fulfill({json:{state,runId:'failed-ending',revision}}));await page.route('**/api/campaign/night-result',async route=>{const data=route.request().postDataJSON();payloads.push(data);if(payloads.length===1)return route.fulfill({status:422,json:{error:'请重试保存本次结果。'}});validateClientResult(base,data.result);state=data.result;await route.fulfill({json:{state,runId:'failed-ending',revision:++revision}});});
 await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await page.locator('[data-action=start-night]').click();const screen=page.getByTestId('ending-screen');await expect(screen).toHaveAttribute('data-pending','true');await expect(screen).toHaveAttribute('data-outcome','defeat');await page.locator('[data-action=dismiss-error]').click();await screen.locator('[data-action=retry-save]').click();await expect(screen).toHaveAttribute('data-pending','false');expect(payloads).toHaveLength(2);expect(payloads[1]).toEqual(payloads[0]);await expect(screen.locator('[data-action=retry]')).toBeVisible();
});

test('test-mode victory labels local results and exits without saving formal progress',async({page})=>{
 const api=[];page.on('request',r=>{if(r.url().includes('/api/'))api.push(r.url());});await useFinishedWorker(page);await page.goto('/?test=28');await expect(page.getByTestId('ending-screen')).toHaveAttribute('data-outcome','victory');await expect(page.getByTestId('ending-screen')).toContainText('测试结局 · 不写入正式进度');await expect(page.getByTestId('ending-screen').getByRole('button',{name:'重开本关',exact:true})).toBeVisible();expect(api).toEqual([]);
});
