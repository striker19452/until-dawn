import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {initialCampaign,applyCampaignAction} from '../src/campaign.js';

const snapshot=page=>page.locator('#world').evaluate(el=>el.getNightSnapshot());
function campaign(day=1){let s=applyCampaignAction(initialCampaign(53),{type:'chooseRole',role:'repairman'});s.day=day;s.flags.seenTypes=['walker','climber','burrower','rammer','caller','quencher'];return s;}
async function boot(page,state){
 let current=state,revision=1;const runId=randomUUID(),actions=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/campaign',r=>r.fulfill({json:{state:current,revision,runId}}));
 await page.route('**/api/campaign/action',r=>{const action=r.request().postDataJSON().action;actions.push(action);current=applyCampaignAction(current,action);return r.fulfill({json:{state:current,revision:++revision,runId}});});
 await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');
 return {actions,errors,state:()=>current};
}
async function menu(page){await page.getByRole('button',{name:'打开游戏菜单'}).click();await expect(page.locator('#sheet-title')).toHaveText('游戏菜单');}
const close=page=>page.getByRole('button',{name:'关闭面板'}).click();
async function geometry(page){return page.evaluate(()=>{const rect=id=>document.querySelector(id).getBoundingClientRect().toJSON();return {world:rect('#world'),art:rect('.yard-art'),panel:rect('#panel'),pause:rect('[data-action=pause]'),width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight};});}
async function visibleMap(page,minimum){
 await expect.poll(async()=>{const g=await geometry(page);return g.world.height/g.height;}).toBeGreaterThan(minimum);
 await expect.poll(async()=>{const g=await geometry(page);return g.art.left>=g.world.left-1&&g.art.right<=g.world.right+1&&g.art.top>=g.world.top-1&&g.art.bottom<=g.world.bottom+1;}).toBe(true);
 const g=await geometry(page);expect(g.scrollWidth).toBeLessThanOrEqual(g.width);expect(g.scrollHeight).toBeLessThanOrEqual(g.height+1);
 expect(g.art.left).toBeGreaterThanOrEqual(g.world.left-1);expect(g.art.right).toBeLessThanOrEqual(g.world.right+1);expect(g.art.top).toBeGreaterThanOrEqual(g.world.top-1);expect(g.art.bottom).toBeLessThanOrEqual(g.world.bottom+1);
}

for(const [width,height] of [[320,568],[390,844],[430,932]])test(`mobile ${width}: large day, night and boss view keeps every approach visible`,async({page})=>{
 await page.setViewportSize({width,height});const {errors}=await boot(page,campaign());
 await visibleMap(page,width===320?.67:.77);
 for(const panel of ['manage','build']){await page.locator(`#nav [data-panel=${panel}]`).click();await expect(page.locator('#overlay')).toBeVisible();await close(page);}
 await page.locator('[data-action=prepare]').click();await page.locator('[data-action=start-night]').click();
 await expect(page.locator('[data-action=pause]')).toBeVisible();await visibleMap(page,width===320?.66:.77);
 expect((await geometry(page)).pause.height).toBeGreaterThanOrEqual(40);await expect(page.locator('#battle-zone')).toBeVisible();await expect(page.locator('#nav')).toBeHidden();
 await page.screenshot({path:`test-results/mobile-night-${width}.png`,fullPage:true});
 await page.unroute('**/api/campaign');await page.route('**/api/campaign',r=>r.fulfill({json:{state:applyCampaignAction(campaign(14),{type:'prepare'}),revision:1,runId:randomUUID()}}));
 await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await page.locator('[data-action=start-night]').click();
 await visibleMap(page,width===320?.59:.70);await expect(page.getByTestId('boss-status')).toBeVisible();
 await page.screenshot({path:`test-results/mobile-boss-${width}.png`,fullPage:true});expect(errors).toEqual([]);
});

test('small-screen menu reaches defenses, all day sections and settings without spending on navigation',async({page})=>{
 await page.setViewportSize({width:320,height:568});const base=campaign(),{actions,state,errors}=await boot(page,base);
 for(const tab of ['explore','members','journal']){await page.locator(`#nav [data-tab=${tab}]`).click();await expect(page.locator('#overlay')).toBeVisible();await close(page);}
 await menu(page);await page.locator('#sheet-body [data-action=menu-audio]').click();await expect(page.locator('#sheet-body [data-action=menu-audio]')).toHaveText('音效：开');
 await page.locator('#sheet-body [data-panel=defense]').click();await page.locator('#defense-zone').selectOption('backRight');await expect(page.locator('#sheet-title')).toContainText('后右栏');
 await expect(page.locator('[data-feature=spikes]')).toContainText('10建材');expect(actions).toEqual([]);expect(state().resources).toEqual(base.resources);
 await close(page);await menu(page);await page.locator('#sheet-body [data-panel=radio]').click();await expect(page.getByTestId('night-challenge')).toBeVisible();
 await close(page);await menu(page);await page.locator('#sheet-body [data-panel=story]').click();await expect(page.locator('#sheet-title')).toHaveText('今天的故事');
 expect(await page.locator('#sheet-body').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);expect(errors).toEqual([]);
});

test('night dock queues the selected teammate and zone, menu pauses, details and fire effects stay accessible',async({page,context})=>{
 await page.setViewportSize({width:320,height:568});let s=campaign();s=applyCampaignAction(s,{type:'recruit',person:'lin'});s=applyCampaignAction(s,{type:'nightRole',person:'lin',role:'support',zone:'right'});s.zones[2].hp=30;
 const {errors}=await boot(page,applyCampaignAction(s,{type:'prepare'}));await page.locator('[data-action=start-night]').click();await page.locator('#battle-person').selectOption('lin');await page.locator('#battle-zone').selectOption('right');
 const initial=await snapshot(page);await context.setOffline(true);await page.locator('[data-command=repair]').click();
 await expect.poll(async()=>(await snapshot(page)).people.find(p=>p.id==='lin').task?.target).toBe('right');expect((await snapshot(page)).resources.materials).toBe(initial.resources.materials-1);
 await page.locator('[data-action=more-night]').click();await expect(page.getByTestId('person-order').locator('[data-order=current]')).toContainText('临时修补');await close(page);
 await page.locator('[data-action=pause]').click();await expect.poll(async()=>(await snapshot(page)).zones[2].hp,{timeout:15000}).toBeGreaterThan(initial.zones[2].hp);
 await menu(page);await expect.poll(async()=>(await snapshot(page)).paused).toBe(true);await page.locator('#sheet-body [data-panel=members]').click();await expect(page.getByTestId('person-order')).toBeVisible();await close(page);
 await page.getByRole('button',{name:'查看篝火效果'}).click();await expect(page.getByTestId('campfire-guide')).toBeVisible();await close(page);
 await menu(page);await page.locator('[data-action=pause]').click();await expect(page.locator('#overlay')).toBeHidden();await expect.poll(async()=>(await snapshot(page)).paused).toBe(false);
 await page.locator('[data-action=pause]').click();expect(errors).toEqual([]);
});

test('desktop and responsive resize keep a single working pause control and the complete yard',async({page})=>{
 await page.setViewportSize({width:1280,height:900});const {errors}=await boot(page,applyCampaignAction(campaign(),{type:'prepare'}));await page.locator('[data-action=start-night]').click();
 for(const [width,height] of [[1280,900],[390,844],[1280,900]]){
  await page.setViewportSize({width,height});await expect(page.locator('[data-action=pause]')).toHaveCount(1);await expect(page.locator('[data-action=pause]')).toBeVisible();
  await visibleMap(page,width===1280?.95:.77);const g=await geometry(page);if(width===1280)expect(g.panel.x).toBeGreaterThanOrEqual(g.world.right);
  await page.locator('[data-action=pause]').click();await expect.poll(async()=>(await snapshot(page)).paused).toBe(false);await page.locator('[data-action=pause]').click();await expect.poll(async()=>(await snapshot(page)).paused).toBe(true);
 }
 expect(errors).toEqual([]);
});

test('Retina touch: open menus, inspect the fire and rotate into a usable landscape sidebar',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true}),page=await context.newPage();
 const {errors}=await boot(page,applyCampaignAction(campaign(),{type:'prepare'}));
 await page.locator('[data-action=start-night]').tap();await page.locator('[data-action=pause]').tap();await expect.poll(async()=>(await snapshot(page)).paused).toBe(false);
 await page.getByRole('button',{name:'打开游戏菜单'}).tap();await expect.poll(async()=>(await snapshot(page)).paused).toBe(true);
 await page.locator('#sheet-body [data-panel=campfire]').tap();await expect(page.getByTestId('campfire-guide')).toBeVisible();await page.getByRole('button',{name:'关闭面板'}).tap();
 await page.setViewportSize({width:844,height:390});await visibleMap(page,.95);
 const g=await geometry(page);expect(g.world.width).toBeGreaterThan(550);expect(g.panel.x).toBeGreaterThanOrEqual(g.world.right);expect(g.pause.right).toBeLessThanOrEqual(844);
 await page.locator('#battle-zone').selectOption('backRight');await page.locator('[data-command=guard]').tap();await expect.poll(async()=>(await snapshot(page)).people[0].task?.target).toBe('backRight');
 await page.screenshot({path:'test-results/mobile-landscape-touch.png',fullPage:true});expect(errors).toEqual([]);await context.close();
});
