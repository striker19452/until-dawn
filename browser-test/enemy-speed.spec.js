import {test,expect} from '@playwright/test';
import {initialCampaign,applyCampaignAction as act} from '../src/campaign.js';

for(const [day,type,speed,width] of [[3,'climber',44,320],[16,'burrower',34,390]])test(`the real offline worker moves ${type} at ${speed} and renders it on a ${width}px phone`,async({page,context})=>{
 await page.setViewportSize({width,height:width===320?568:844});
 let state=act(initialCampaign(53),{type:'chooseRole',role:'repairman'});state.day=day;state.people[0].nightRole='sleep';state=act(state,{type:'prepare'});
 const posts=[],errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/api/')&&r.method()==='POST')posts.push(r.url());});
 await page.route('**/api/campaign',route=>route.fulfill({json:{state,runId:`fast-${type}`,revision:1}}));await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await page.locator('[data-action=start-night]').click();
 const snapshot=()=>page.locator('#world').evaluate(el=>el.getNightSnapshot());
 await page.locator('[data-action=more-night]').click();await page.locator('[data-group=orders][data-value=support]').click();await page.locator('[data-action=auto-pause]').click();await expect.poll(async()=>(await snapshot()).autoPause).toBe(false);await page.locator('[data-action=close-overlay]').click();
 await context.setOffline(true);await page.locator('[data-action=pause]').click();
 await expect.poll(async()=>(await snapshot()).enemies.some(e=>e.type===type),{timeout:15000,intervals:[100]}).toBe(true);
 const first=await snapshot(),enemy=first.enemies.find(e=>e.type===type);expect(enemy.mode).toBe('approach');
 await expect.poll(async()=>(await snapshot()).elapsed,{intervals:[100]}).toBeGreaterThan(first.elapsed+.5);
 const second=await snapshot(),moved=second.enemies.find(e=>e.id===enemy.id);expect(moved.mode).toBe('approach');
 expect(Math.hypot(moved.x-enemy.x,moved.y-enemy.y)).toBeCloseTo(speed*(second.elapsed-first.elapsed),6);
 await expect.poll(()=>page.locator('canvas').evaluate((canvas,id)=>canvas.getYardDiagnostics().tokens.some(t=>t.id==='e-'+id&&t.moving),enemy.id)).toBe(true);
 await page.locator('[data-action=pause]').click();await expect.poll(async()=>(await snapshot()).paused).toBe(true);
 const frozen=await snapshot();await page.waitForTimeout(200);expect((await snapshot()).enemies).toEqual(frozen.enemies);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`.local/threat-pacing/fast-${type}-${width}.png`,fullPage:true});expect(posts).toEqual([]);expect(errors).toEqual([]);
});
