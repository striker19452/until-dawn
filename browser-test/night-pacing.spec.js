import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';

const snapshot=page=>page.locator('#world').evaluate(el=>el.getNightSnapshot());
const commands=(page,actions)=>page.evaluate(actions=>{for(const action of actions)window.__pacingWorker.postMessage({type:'command',action});},actions);

for(const [width,day] of [[320,1],[1280,7]])test(`real offline night ${day} has compact arrivals, freezes on pause and clears at ${width}px`,async({page,context})=>{
 test.setTimeout(75000);mkdirSync('.local/night-pacing',{recursive:true});await page.setViewportSize({width,height:width===320?568:900});const errors=[],api=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/api/'))api.push(r.url());});
 await page.addInitScript(()=>{const Native=window.Worker;window.__arrivalSamples=[];window.Worker=class extends Native{constructor(url,options){super(url,options);if(!String(url).includes('night-worker'))return;window.__pacingWorker=this;let seq=0;this.addEventListener('message',({data})=>{if(data.type!=='state')return;for(const e of data.battle.events.filter(e=>e.id>seq&&e.type==='warning'))window.__arrivalSamples.push(e);seq=data.battle.eventSeq;});}};});
 await page.goto(`/?test=${day}`);await expect(page.locator('#phase')).toHaveText('测试 · 实时守夜');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');
 const before=await snapshot(page);expect(before.paused).toBe(true);expect(before.schedule[0].at).toBe(day===1?3:2);expect(before.schedule.at(-1).at).toBeLessThanOrEqual(day===1?30:40);expect(before.challenge.starts).toBe(day===1?3:8);
 if(day===7){await page.getByRole('button',{name:'打开游戏菜单'}).click();await page.getByRole('button',{name:'本夜情报',exact:true}).click();await expect(page.getByTestId('boss-preview')).toContainText('约8秒出现');await page.locator('[data-action=close-overlay]').click();}
 await context.setOffline(true);await commands(page,[{type:'autoPause',enabled:false},{type:'speed',value:2},{type:'resume'}]);
 await expect.poll(async()=>(await snapshot(page))?.elapsed||0,{timeout:12000,intervals:[100]}).toBeGreaterThan(12);
 await commands(page,[{type:'pause'}]);await expect.poll(async()=>(await snapshot(page))?.paused).toBe(true);const paused=await snapshot(page);await page.waitForTimeout(250);expect((await snapshot(page)).elapsed).toBe(paused.elapsed);
 const arrivals=await page.evaluate(()=>window.__arrivalSamples);expect(arrivals[0].time).toBeLessThanOrEqual(3.1);if(day===7){expect(paused.boss.id).toBe('bastion');expect(arrivals.some(e=>e.text==='棘冠背兽'&&e.time>=8&&e.time<8.1)).toBe(true);}
 await page.screenshot({path:`.local/night-pacing/pressure-${width}.png`,fullPage:true});await commands(page,[{type:'resume'}]);
 await expect(page.locator('#phase')).toHaveText('测试 · 天亮战报',{timeout:55000});await expect(page.getByTestId('night-elapsed')).toBeVisible();const text=await page.getByTestId('night-elapsed').textContent();expect(Number(text.match(/[\d.]+/)[0])).toBeLessThan(day===1?50:90);
 expect(api).toEqual([]);expect(errors).toEqual([]);
});
