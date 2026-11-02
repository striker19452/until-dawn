import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';

test('CPU throttling: local worker runs offline, HUD updates coalesce and paused canvas sleeps',async({page,context})=>{
 test.setTimeout(45000);const requests=[],sockets=[],errors=[];page.on('request',r=>{if(r.url().includes('/api/'))requests.push(r.url());});page.on('websocket',ws=>sockets.push(ws.url()));page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:/夜班保安/}).click();await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await page.locator('[data-action=prepare]').click();await page.locator('[data-action=start-night]').click();await expect(page.locator('[data-action=pause]')).toHaveText('继续');
 await page.locator('[data-action=more-night]').click();await page.locator('[data-group=orders][data-value=support]').click();await page.locator('[data-action=auto-pause]').click();await page.locator('[data-action=close-overlay]').click();
 const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});await context.setOffline(true);const count=requests.length;
 await page.locator('[data-action=pause]').click();await expect(page.locator('[data-action=pause]')).toHaveText('暂停');
 const before=await page.locator('#world').evaluate(el=>el.getNightDiagnostics());
 const frames=await page.evaluate(()=>new Promise(resolve=>{const samples=[];let last=performance.now(),end=last+8000;function frame(now){samples.push(now-last);last=now;if(now<end)requestAnimationFrame(frame);else resolve(samples);}requestAnimationFrame(frame);}));
 const after=await page.locator('#world').evaluate(el=>({...el.getNightDiagnostics(),elapsed:el.getNightSnapshot().elapsed}));
 expect(after.elapsed).toBeGreaterThan(6);expect(after.steps).toBeGreaterThan(before.steps+100);expect(after.renders-before.renders).toBeLessThan((after.messages-before.messages)*.75+3);expect(requests.length).toBe(count);expect(sockets).toHaveLength(0);
 await page.locator('[data-action=pause]').click();await expect(page.locator('[data-action=pause]')).toHaveText('继续');await page.waitForTimeout(200);const paused=await page.locator('canvas').evaluate(c=>c.getYardDiagnostics().draws);await page.waitForTimeout(500);const later=await page.locator('canvas').evaluate(c=>c.getYardDiagnostics().draws);expect(later-paused).toBeLessThanOrEqual(1);expect(errors).toEqual([]);
 const sorted=[...frames].sort((a,b)=>a-b);writeFileSync('test-results/local-night-performance.json',JSON.stringify({cpuSlowdown:4,offline:true,webSockets:sockets.length,apiRequestsDuringNight:requests.length-count,messages:after.messages-before.messages,hudRenders:after.renders-before.renders,elapsed:after.elapsed,frameMedianMs:sorted[Math.floor(sorted.length*.5)],frameP95Ms:sorted[Math.floor(sorted.length*.95)],pausedDraws:later-paused},null,2));
 await context.setOffline(false);
});
