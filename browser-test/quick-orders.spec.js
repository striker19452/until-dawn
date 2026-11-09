import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
const snapshot=page=>page.locator('#world').evaluate(el=>el.getNightSnapshot());
for(const [width,height] of [[320,568],[390,844],[1280,900],[844,390]])test(`battlefield commands stay inline at ${width}x${height}`,async({page})=>{
 mkdirSync('.local/command-flow',{recursive:true});await page.setViewportSize({width,height});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?test=8');await expect(page.locator('#battle-person')).toBeVisible({timeout:20000});
 const before=await snapshot(page);await page.locator('#crew-hud [data-person=lin]').click();await expect(page.locator('#battle-person')).toHaveValue('lin');await expect(page.locator('#overlay')).toBeHidden();expect((await snapshot(page)).paused).toBe(before.paused);
 if(width<960)await page.selectOption('#battle-zone','right');else await page.locator('#zones [data-zone=right]').click();
 await page.screenshot({path:`.local/command-flow/after-${width}.png`});
 const heavyButton=page.locator('#panel [data-command=heavy]');await expect(heavyButton).toBeVisible();await expect(heavyButton).toBeDisabled();expect((await snapshot(page)).resources.materials).toBe(before.resources.materials);
 await page.locator('[data-action=more-night]').click();await expect(page.locator('#quick-extra')).toBeVisible();await expect(page.locator('#overlay')).toBeHidden();
 await page.screenshot({path:`.local/command-flow/expanded-${width}.png`});
 const geometry=await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,world:document.querySelector('#world').getBoundingClientRect().height,buttons:[...document.querySelectorAll('#panel button')].filter(e=>e.getClientRects().length&&!e.closest('.quick-extra')).map(e=>{const r=e.getBoundingClientRect();return {height:r.height,right:r.right,bottom:r.bottom};})}));
 expect(geometry.width).toBeLessThanOrEqual(width);expect(geometry.height).toBeLessThanOrEqual(height+1);expect(geometry.world).toBeGreaterThan(100);expect(geometry.buttons.every(r=>r.height>=44&&r.right<=width+1&&r.bottom<=height+1)).toBe(true);
 await page.locator('[data-action=more-night]').click();await page.locator('[data-action=pause]').click();await expect.poll(async()=>(await snapshot(page)).paused).toBe(false);
 await page.locator('[data-action=more-night]').click();expect((await snapshot(page)).paused).toBe(false);await page.locator('#crew-hud [data-person=zhou]').click();await expect(page.locator('#overlay')).toBeHidden();expect((await snapshot(page)).paused).toBe(false);
 // Detailed care remains an explicit pause, separate from selecting an actor.
 await page.locator('[data-action=actor-details]').scrollIntoViewIfNeeded();await page.locator('[data-action=actor-details]').click();await expect(page.getByTestId('crew-health-panel')).toBeVisible();await expect.poll(async()=>(await snapshot(page)).paused).toBe(true);
 expect(errors).toEqual([]);
});
