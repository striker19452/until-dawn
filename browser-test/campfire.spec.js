import {selectZone} from './support/ui.js';
import {test,expect} from '@playwright/test';
import {initialCampaign,applyCampaignAction} from '../src/campaign.js';
import {createBattle,battleCommand} from '../src/battle.js';
import {ENEMIES,ZONES} from '../src/content.js';

const diagnostics=page=>page.locator('canvas').evaluate(c=>c.getYardDiagnostics());
const fire=async page=>(await diagnostics(page)).components.find(c=>c.id==='fire-central');
async function clickArt(page,p){const {metrics}=await diagnostics(page),box=await page.locator('canvas').boundingBox();await page.mouse.click(box.x+box.width/2+(p.x-240)*metrics.cssScale,box.y+box.height/2+(p.y-metrics.centerY)*metrics.cssScale);}
function state(){let s=applyCampaignAction(initialCampaign(53),{type:'chooseRole',role:'repairman'});for(const z of s.zones)Object.assign(z,{brazier:true,shade:true,lit:true});return s;}
test('one cold daytime hearth replaces legacy perimeter braziers and stays visible when unlit',async({page})=>{
 let s=state(),revision=1;const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/campaign',route=>route.fulfill({json:{state:s,runId:'single-fire-day',revision}}));
 await page.route('**/api/campaign/action',route=>{s=applyCampaignAction(s,route.request().postDataJSON().action);return route.fulfill({json:{state:s,runId:'single-fire-day',revision:++revision}});});
 await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await expect.poll(async()=>(await fire(page))?.state).toBe('unlit');
 let d=await diagnostics(page);expect(d.components.filter(c=>c.kind==='fire')).toHaveLength(1);expect(d.components.some(c=>c.kind==='shade')).toBe(false);
 await page.screenshot({path:'.local/validation/central-campfire/art/campfire-day.png',fullPage:true});
 await selectZone(page,'left');await expect(page.locator('[data-feature=brazier]')).toHaveCount(0);await expect(page.locator('[data-feature=shade]')).toHaveCount(0);await expect(page.locator('#sheet-body')).toContainText('中央篝火');await page.locator('[data-action=close-overlay]').click();
 await page.locator('#nav [data-action=drawer][data-panel=manage]').click();await page.locator('[data-action=toggle-fire][data-target=central]').click();await page.locator('[data-action=close-overlay]').click();
 await expect.poll(async()=>(await fire(page)).state).toBe('unlit');expect((await fire(page)).flameVisible).toBe(false);expect((await fire(page)).glowAlpha).toBe(0);await page.screenshot({path:'.local/validation/central-campfire/art/campfire-day-unlit.png',fullPage:true});expect(errors).toEqual([]);
});

test('the central hearth has night light, a damp ember state, frozen pause and direct fire orders',async({page})=>{
 const s=applyCampaignAction(state(),{type:'prepare'}),b=createBattle(s,'single-fire-night',{autoPause:false});b.schedule=[];b.challenge=null;const errors=[];page.on('pageerror',e=>errors.push(e.message));
 b.enemies=['walker','climber','rammer','caller','burrower'].map((type,i)=>({id:type,type,zone:ZONES[i].id,x:ZONES[i].x,y:ZONES[i].y,hp:ENEMIES[type].hp,max:ENEMIES[type].hp,mode:'attack',progress:0,attack:0,stun:0}));
 const publish=()=>page.evaluate(b=>window.__campfireWorker.dispatchEvent(new MessageEvent('message',{data:{type:'state',battle:b,result:null,steps:0}})),b);
 await page.exposeFunction('__campfireMessage',async m=>{if(m.type==='command')battleCommand(b,m.action);if(m.type!=='dispose')await publish();});
 await page.addInitScript(()=>{const RealWorker=window.Worker;window.Worker=class extends EventTarget{constructor(url,options){super();if(!String(url).includes('night-worker'))return new RealWorker(url,options);window.__campfireWorker=this;queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:{type:'ready'}})));}postMessage(m){window.__campfireMessage(m);}terminate(){}};});
 await page.route('**/api/campaign',route=>route.fulfill({json:{state:s,runId:'single-fire-night',revision:1}}));await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await page.locator('[data-action=start-night]').click();
 await expect.poll(async()=>(await fire(page))?.frame).toBe(1);expect((await fire(page)).glowAlpha).toBeGreaterThan(.5);await expect(page.locator('#fire-target')).toHaveCount(0);await expect(page.locator('#central-fire-status')).toContainText('60');
 await expect(page.locator('#central-fire-effect')).toHaveText('中央篝火 · 全场生效');expect((await diagnostics(page)).feedback.enemies.every(e=>e.heat)).toBe(true);
 // A map tap opens the guide even while a person is selected for movement.
 const stock=structuredClone(b.resources),hero=(await diagnostics(page)).tokens.find(t=>t.id==='p-hero');
 await clickArt(page,{x:hero.bodyBounds.left+hero.bodyBounds.width/2,y:hero.bodyBounds.top+hero.bodyBounds.height*.55});
 await expect.poll(async()=>(await diagnostics(page)).movement.armed).toBe(true);
 for(const width of [320,390]){
  await page.setViewportSize({width,height:width===320?568:844});b.paused=false;await publish();
  await clickArt(page,{x:240,y:336});
  await expect(page.getByTestId('campfire-guide')).toBeVisible();await expect.poll(()=>b.paused).toBe(true);
  await expect(page.getByTestId('campfire-current')).toContainText('当前生效');
  await expect(page.getByTestId('campfire-guide')).toContainText('重撞兽−15%');await expect(page.getByTestId('campfire-guide')).toContainText('×0.65');
  expect(b.people[0].task).toBeNull();expect(b.resources).toEqual(stock);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`test-results/campfire-guide-${width}.png`,fullPage:true});
  await page.locator('[data-action=close-overlay]').click();
 }
 await page.setViewportSize({width:320,height:568});await page.waitForTimeout(100);const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,panel:document.querySelector('#panel').getBoundingClientRect().toJSON()}));expect(layout.scroll).toBeLessThanOrEqual(layout.width);expect(layout.panel.right).toBeLessThanOrEqual(layout.width);await page.screenshot({path:'test-results/global-fire-320.png',fullPage:true});await page.setViewportSize({width:390,height:844});
 b.paused=false;
 let width;const frames=new Set(),scales=new Set(),heights=new Set();for(let i=0;i<8;i++){b.elapsed+=.16;await publish();await page.waitForTimeout(80);const f=await fire(page);frames.add(f.flameFrame);scales.add(f.baseScale);heights.add(f.flameScaleY);expect(f.flameX).toBe(0);expect(f.flameAngle).toBe(0);if(i===0)width=f.flameScaleX;else expect(f.flameScaleX).toBe(width);}
 expect([...frames]).toEqual([1]);expect(heights.size).toBeGreaterThanOrEqual(3);expect(scales.size).toBe(1);
 b.paused=true;await publish();await page.waitForTimeout(80);
 const frozen=await fire(page);await page.waitForTimeout(350);expect(await fire(page)).toEqual(frozen);await page.screenshot({path:'.local/validation/central-campfire/art/campfire-night.png',fullPage:true});
 b.fires[0].heat=8;b.fires[0].wet=4;await publish();await expect.poll(async()=>(await fire(page)).state).toBe('wet');expect((await fire(page)).flameAlpha).toBeLessThan(.3);expect((await fire(page)).baseScale).toBe(frozen.baseScale);await expect(page.locator('#central-fire-status')).toContainText('湿污');await page.screenshot({path:'.local/validation/central-campfire/art/campfire-night-wet.png',fullPage:true});
 await expect(page.locator('#central-fire-effect')).toHaveText('中央篝火 · 增益暂停');expect((await diagnostics(page)).feedback.enemies.every(e=>!e.heat)).toBe(true);
 await page.getByRole('button',{name:'查看篝火效果'}).focus();await page.keyboard.press('Enter');
 await expect(page.getByTestId('campfire-current')).toContainText('湿污还剩4秒');await expect(page.getByTestId('campfire-current')).toContainText('火势不足');
 b.fires[0].heat=0;b.fires[0].wet=0;await publish();await expect(page.getByTestId('campfire-current')).toContainText('未点燃');
 b.fires[0].heat=15;await publish();await expect(page.getByTestId('campfire-current')).toContainText('火势不足');
 b.fires[0].heat=60;await publish();await expect(page.getByTestId('campfire-current')).toContainText('当前生效');
 await page.locator('[data-action=close-overlay]').click();
 await page.locator('[data-action=night-fire]').click();await expect.poll(()=>b.people[0].task?.target).toBe('central');
 b.fires[0].heat=0;b.fires[0].wet=0;await publish();await expect.poll(async()=>(await fire(page)).state).toBe('unlit');expect((await fire(page)).glowAlpha).toBe(0);await expect(page.locator('#central-fire-status')).toContainText('未点燃');await page.screenshot({path:'.local/validation/central-campfire/art/campfire-night-unlit.png',fullPage:true});expect(errors).toEqual([]);
 for(const heat of [15,8,1]){
  b.fires[0].heat=heat;await publish();await expect(page.locator('#central-fire-effect')).toHaveText('中央篝火 · 增益暂停');await expect(page.locator('#central-fire-status')).toContainText('火势不足');
  await expect.poll(async()=>(await fire(page)).state).toBe('embers');const weak=await fire(page);expect(weak.flameVisible).toBe(false);expect(weak.flameAlpha).toBe(0);expect(weak.glowAlpha).toBe(0);expect(weak.emberAlpha).toBeGreaterThan(0);expect(weak.smokeVisible).toBe(true);expect(weak.baseScale).toBe(frozen.baseScale);
 }
 await page.setViewportSize({width:320,height:568});await page.waitForTimeout(100);await page.screenshot({path:'test-results/weak-fire-320.png',fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight+1)).toBe(true);await page.setViewportSize({width:390,height:844});
 const coals=[];b.paused=false;for(let i=0;i<3;i++){b.elapsed+=.6;await publish();await page.waitForTimeout(80);coals.push((await fire(page)).emberAlpha);}expect(new Set(coals).size).toBeGreaterThan(1);
 b.paused=true;await publish();await page.waitForTimeout(80);const weakFrozen=await fire(page);await page.waitForTimeout(250);expect(await fire(page)).toEqual(weakFrozen);await page.screenshot({path:'test-results/weak-fire-390.png',fullPage:true});
 b.fires[0].heat=15.01;await publish();await expect.poll(async()=>(await fire(page)).state).toBe('burning');expect((await fire(page)).flameVisible).toBe(true);expect((await fire(page)).glowAlpha).toBeGreaterThan(0);
 b.fires[0].heat=60;await publish();await expect(page.locator('#central-fire-effect')).toHaveText('中央篝火 · 全场生效');await expect.poll(async()=>(await diagnostics(page)).feedback.enemies.every(e=>e.heat)).toBe(true);expect((await fire(page)).smokeVisible).toBe(false);expect((await fire(page)).flameAlpha).toBeGreaterThan(.8);expect(errors).toEqual([]);
});

test('stored wood supports free relighting and extinguishing from the night controls',async({page})=>{
 let s=state();s.flags.centralFire=false;s.flags.campfireWood=1;s.flags.seenTypes=['walker','climber','burrower','rammer','caller','quencher'];
 s=applyCampaignAction(s,{type:'prepare'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/campaign',route=>route.fulfill({json:{state:s,runId:'wood-controls',revision:1}}));
 await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await page.locator('[data-action=start-night]').click();
 const snapshot=()=>page.locator('#world').evaluate(el=>el.getNightSnapshot());
 await expect(page.locator('#central-fire-status')).toContainText('余柴 1.00');
 const stock=(await snapshot()).resources;
 await page.locator('[data-action=more-night]').click();
 await page.locator('[data-action=night-cmd][data-command=fire]').click();
 await page.locator('[data-action=close-overlay]').click();
 await expect.poll(async()=>(await snapshot()).people[0].task?.type).toBe('fire');
 expect((await snapshot()).resources).toEqual(stock);
 await page.locator('[data-action=pause]').click();
 await expect.poll(async()=>(await snapshot()).fires[0].heat,{timeout:15000}).toBeGreaterThan(0);
 await page.locator('[data-action=pause]').click();
 await page.locator('[data-action=more-night]').click();
 await page.locator('[data-action=night-cmd][data-command=extinguish]').click();
 await expect.poll(async()=>(await snapshot()).people[0].task?.type).toBe('extinguish');
 await page.locator('[data-action=close-overlay]').click();
 await page.locator('[data-action=pause]').click();
 await expect.poll(async()=>(await snapshot()).fires[0].heat,{timeout:15000}).toBe(0);
 await page.locator('[data-action=pause]').click();
 const stopped=await snapshot();expect(stopped.fires[0].wood).toBeGreaterThan(0);expect(stopped.resources).toEqual(stock);
 expect(errors).toEqual([]);
});
