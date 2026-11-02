import {test,expect} from '@playwright/test';

const snapshot=page=>page.locator('#world').evaluate(el=>el.getNightSnapshot());
async function settings(page){
 await page.locator('[data-action=more-night]').click();
 await page.locator('[data-group=orders][data-value=support]').click();
 return page.locator('[data-action=auto-pause]');
}
async function changeLevel(page,day){
 await page.getByRole('button',{name:'打开游戏菜单'}).click();
 await page.locator('[data-action=drawer][data-panel=test]').click();
 await page.locator('#test-day').selectOption(String(day));
 await page.locator('[data-action=test-start]').click();
 await expect.poll(async()=>(await snapshot(page))?.day).toBe(day);
}

for(const width of [320,390])test(`danger auto-pause remembers off and on across selected levels and reloads at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:width===320?568:844});
 const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/api/'))requests.push(r.url());});
 await page.addInitScript(()=>{
  window.__preferenceWrites=[];const original=Storage.prototype.setItem;
  Storage.prototype.setItem=function(key,value){if(this===window.localStorage)window.__preferenceWrites.push({key,value:String(value)});return original.call(this,key,value);};
 });
 await page.goto('/?test=7');await expect.poll(async()=>(await snapshot(page))?.autoPause).toBe(true);
 expect(await page.evaluate(()=>window.__preferenceWrites)).toEqual([]);
 let button=await settings(page);await expect(button).toHaveText('危险自动暂停：开');await button.click();
 await expect.poll(async()=>(await snapshot(page))?.autoPause).toBe(false);await expect(button).toHaveText('危险自动暂停：关');
 expect(await page.evaluate(()=>window.__preferenceWrites)).toEqual([{key:'dawn-auto-pause',value:'false'}]);
 expect(await page.evaluate(()=>Object.keys(localStorage))).toEqual(['dawn-auto-pause']);
 await page.reload();await expect.poll(async()=>(await snapshot(page))?.autoPause).toBe(false);
 expect(await page.evaluate(()=>window.__preferenceWrites)).toEqual([]);
 await changeLevel(page,14);expect((await snapshot(page)).autoPause).toBe(false);
 button=await settings(page);await expect(button).toHaveText('危险自动暂停：关');
 expect(await page.locator('#sheet-body').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 await page.screenshot({path:`.local/auto-pause/off-${width}.png`,fullPage:true});
 await button.click();await expect.poll(async()=>(await snapshot(page))?.autoPause).toBe(true);
 expect(await page.evaluate(()=>localStorage.getItem('dawn-auto-pause'))).toBe('true');
 await changeLevel(page,21);expect((await snapshot(page)).autoPause).toBe(true);
 await page.reload();await expect.poll(async()=>(await snapshot(page))?.autoPause).toBe(true);
 expect(await page.evaluate(()=>window.__preferenceWrites)).toEqual([]);
 expect(errors).toEqual([]);expect(requests).toEqual([]);
});

test('when browser storage is unavailable, the switch still works and survives rebuilding a night in the same page',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Storage blocked','SecurityError');}}));
 await page.goto('/?test=7');await expect.poll(async()=>(await snapshot(page))?.autoPause).toBe(true);
 const button=await settings(page);await button.click();await expect.poll(async()=>(await snapshot(page))?.autoPause).toBe(false);
 await page.getByRole('button',{name:'打开游戏菜单'}).click();await page.locator('[data-action=test-prepare]').click();
 await expect(page.locator('#phase')).toHaveText('测试 · 白天经营');await page.locator('[data-action=close-overlay]').click();
 await page.locator('[data-action=prepare]').click();await expect(page.locator('#phase')).toHaveText('测试 · 黄昏准备');
 await page.locator('[data-action=start-night]').click();await expect.poll(async()=>(await snapshot(page))?.autoPause).toBe(false);
 expect(errors).toEqual([]);
});
