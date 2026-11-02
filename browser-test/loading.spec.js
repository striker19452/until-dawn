import { test,expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('controls and saved state load before the deferred renderer',async({page})=>{
 let unblock;const gate=new Promise(resolve=>{unblock=resolve;});
 await page.route('**/assets/scene-*.js',async route=>{await gate;await route.continue();});
 try{
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('button',{name:/修理工/})).toBeVisible();
  await page.getByRole('button',{name:/修理工/}).click();
  await expect(page.locator('#phase')).toHaveText('白天经营');
  await expect(page.locator('#world')).not.toHaveAttribute('data-ready','true');
 }finally{unblock();}
 await expect(page.locator('#world')).toHaveAttribute('data-ready','true',{timeout:30000});
});

test('cold load defers night art and audio, and opt-in audio and night still work',async({page})=>{
 const requests=[],errors=[];page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:/修理工/}).click();
 await expect(page.locator('#world')).toHaveAttribute('data-ready','true',{timeout:30000});
 expect(requests.some(url=>/yard-(?:ground-)?night|\.wav/.test(url))).toBe(false);
 expect(requests.some(url=>/\.png(?:\?|$)/.test(url))).toBe(false);
 await page.locator('#audio-toggle').click();
 await expect.poll(()=>requests.filter(url=>url.endsWith('.wav')).length).toBe(2);
 expect(requests.some(url=>/\/fire-[^/]+\.wav$/.test(url))).toBe(false);
 await page.locator('[data-action=prepare]').click();await page.locator('[data-action=start-night]').click();
 await expect(page.locator('[data-action=pause]')).toHaveText('继续');
 await expect.poll(()=>page.locator('.yard-art').last().evaluate(img=>img.complete&&img.naturalWidth>1000)).toBe(true);
 await page.screenshot({path:'test-results/optimized-night.png'});expect(errors).toEqual([]);
});

test('2 Mbps cold load and warm cache transfer measurements',async({page,context})=>{
 test.setTimeout(90000);const cdp=await context.newCDPSession(page);
 await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:100,downloadThroughput:250000,uploadThroughput:125000});
 await page.goto('/',{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:/修理工/}).click();
 await expect(page.locator('#world')).toHaveAttribute('data-ready','true',{timeout:60000});
 const measure=()=>page.evaluate(()=>({uiReady:performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd,sceneReady:performance.now(),resources:performance.getEntriesByType('resource').filter(e=>e.name.includes('/assets/')).map(e=>({name:e.name.split('/').pop(),bytes:e.transferSize,encoded:e.encodedBodySize,duration:e.duration}))}));
 const cold=await measure();await page.reload({waitUntil:'domcontentloaded'});await expect(page.locator('#world')).toHaveAttribute('data-ready','true',{timeout:30000});const warm=await measure();
 const bytes=sample=>sample.resources.reduce((n,r)=>n+r.bytes,0);
 // Includes the new separate painted hearth and flame layers (under 250 KB).
 expect(bytes(cold)).toBeLessThan(4_250_000);expect(bytes(warm)).toBeLessThan(bytes(cold)*.15);
 writeFileSync('test-results/loading-metrics.json',JSON.stringify({network:'2 Mbps, 100 ms RTT',cold,warm,coldBytes:bytes(cold),warmBytes:bytes(warm)},null,2));
});
