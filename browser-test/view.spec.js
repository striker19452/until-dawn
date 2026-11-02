import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';

async function bounds(page){return page.locator('#world').evaluate(el=>{
 const rect=el.getBoundingClientRect(),art=el.querySelector('.yard-art').getBoundingClientRect();
 return {world:rect.toJSON(),art:art.toJSON(),width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight};
});}
async function fullApproaches(page){
 await expect.poll(async()=>{const {world,art}=await bounds(page);return art.top>=world.top-1&&art.bottom<=world.bottom+1&&art.left>=world.left-1&&art.right<=world.right+1;}).toBe(true);
 const measured=await bounds(page);expect(measured.scrollWidth).toBeLessThanOrEqual(measured.width);expect(measured.scrollHeight).toBeLessThanOrEqual(measured.height+1);
 const notice=await page.locator('#notice').boundingBox();if(notice)expect(notice.y>=measured.world.bottom-1||notice.x>=measured.world.right-1).toBe(true);
}

for(const viewport of [{width:320,height:568},{width:390,height:844},{width:960,height:640},{width:1280,height:900}])test(`full outside view ${viewport.width}: rear approaches, day/night controls and camera taps`,async({page})=>{
 await page.setViewportSize(viewport);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:/修理工/}).click();await expect(page.locator('#phase')).toHaveText('白天经营');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await fullApproaches(page);
 const expanded=await bounds(page);
 if(viewport.width<960){
  await expect(page.locator('#view-toggle')).toBeHidden();
  expect(expanded.world.height).toBeGreaterThan(viewport.height*.67);
  await expect(page.getByRole('button',{name:'打开游戏菜单'})).toBeVisible();
 }else{
  const panel=await page.locator('#panel').boundingBox();expect(panel.x).toBeGreaterThanOrEqual(expanded.world.right);expect(expanded.world.height).toBeGreaterThan(viewport.height-20);expect(expanded.world.width).toBeGreaterThan(viewport.width-330);
 }
 await page.screenshot({path:`test-results/wide-day-${viewport.width}.png`});
 // Both rear gates and the front gate remain aligned with the artwork.
 for(const [x,y,name] of [[168.75,126,'后左栏'],[311.25,126,'后右栏'],[240,468,'正门']]){
  const rect=await page.locator('canvas').boundingBox(),metrics=await page.locator('canvas').evaluate(c=>c.getYardDiagnostics().metrics);
  await page.mouse.click(rect.x+rect.width/2+(x-240)*metrics.cssScale,rect.y+rect.height/2+(y-metrics.centerY)*metrics.cssScale);
  await expect(page.locator('#sheet-title')).toContainText(name);await page.locator('[data-action=close-overlay]').click();
 }
 await page.locator('[data-action=prepare]').click();await page.locator('[data-action=start-night]').click();await expect(page.locator('[data-action=pause]')).toHaveText('继续');await fullApproaches(page);
 for(const selector of ['#nav','#panel','#zones','[data-action=pause]']){const box=await page.locator(selector).boundingBox();if(!box){expect(viewport.width).toBeLessThan(960);continue;}expect(box.y).toBeGreaterThanOrEqual(0);expect(box.y+box.height).toBeLessThanOrEqual(viewport.height+1);}
 await page.screenshot({path:`test-results/wide-night-${viewport.width}.png`});expect(errors).toEqual([]);
 writeFileSync(`test-results/wide-view-${viewport.width}.json`,JSON.stringify({day:expanded,night:await bounds(page)},null,2));
});
