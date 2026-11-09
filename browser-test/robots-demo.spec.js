import {test,expect} from '@playwright/test';

test('direct robot demo starts isolated and paused, then shows actual repair and bell dispatch',async({page})=>{
 const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/api/'))requests.push(r.url());});
 await page.setViewportSize({width:1280,height:900});await page.goto('/?test=1&testPreset=robots');
 const snapshot=()=>page.locator('#world').evaluate(el=>el.getNightSnapshot?.());
 await expect(page.locator('#world')).toHaveAttribute('data-ready','true',{timeout:20000});await expect.poll(async()=>(await snapshot())?.robots.length,{timeout:15000}).toBe(3);expect((await snapshot()).elapsed).toBe(0);expect((await snapshot()).paused).toBe(true);
 await expect(page.getByTestId('objective-notice')).toContainText('三类机器人演示');
 await page.getByRole('button',{name:'查看机器人演示与规划'}).click();
 await expect(page.getByLabel('围栏／机体维修阈值').locator('option:checked')).toHaveText('低于85耐久');
 await page.locator('[data-action="close-overlay"]').click();await page.locator('[data-action="pause"]:visible').first().click();
 await expect.poll(async()=>(await snapshot()).elapsed,{timeout:25000}).toBeGreaterThan(17);
 await page.locator('[data-action="pause"]:visible').first().click();const b=await snapshot();expect(b.events.some(e=>e.type==='robot-dispatch'&&e.text.includes('铃绳'))).toBe(true);expect(b.events.some(e=>e.type==='repair'&&e.robotId==='robot-1')).toBe(true);expect(b.events.some(e=>e.type==='attack'&&e.robotId==='robot-2')).toBe(true);
 await page.screenshot({path:'.local/robots-demo-running.png'});expect(errors).toEqual([]);expect(requests).toEqual([]);
});
