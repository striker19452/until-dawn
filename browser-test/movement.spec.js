import {selectZone} from './support/ui.js';
import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {initialCampaign,applyCampaignAction} from '../src/campaign.js';
import {artPoint,worldPoint} from '../client/scene-layout.js';
import {nearestWalkablePoint,walkablePoint} from '../src/movement.js';
import {HOUSE_ANCHOR} from '../src/yard-geometry.js';
const diagnostics=page=>page.locator('canvas').evaluate(c=>c.getYardDiagnostics());
const snapshot=page=>page.locator('#world').evaluate(el=>el.getNightSnapshot());
function state(night=false){let s=applyCampaignAction(initialCampaign(53),{type:'chooseRole',role:'repairman'});s=applyCampaignAction(s,{type:'recruit',person:'lin'});s=applyCampaignAction(s,{type:'nightRole',person:'hero',role:'guard',zone:'left'});s=applyCampaignAction(s,{type:'nightRole',person:'lin',role:'guard',zone:'right'});return night?applyCampaignAction(s,{type:'prepare'}):s;}
async function boot(page,night=false){const s=state(night);await page.route('**/api/campaign',route=>route.fulfill({json:{state:s,runId:randomUUID(),revision:1}}));await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');if(night){await page.locator('[data-action=start-night]').click();await expect.poll(async()=>!!await snapshot(page)).toBe(true);await expect(page.locator('[data-action=pause]')).toHaveText('继续');}return s;}
async function clickArt(page,p,touch=false){const {metrics}=await diagnostics(page),box=await page.locator('canvas').boundingBox(),x=box.x+box.width/2+(p.x-240)*metrics.cssScale,y=box.y+box.height/2+(p.y-metrics.centerY)*metrics.cssScale;if(touch)await page.touchscreen.tap(x,y);else await page.mouse.click(x,y);}
async function select(page,id,touch=false){const d=await diagnostics(page),p=d.tokens.find(t=>t.id==='p-'+id),body=p.bodyBounds;await clickArt(page,{x:body.left+body.width*.5,y:body.top+body.height*.55},touch);await expect.poll(async()=>(await diagnostics(page)).movement.actor).toBe(id);await expect.poll(async()=>(await diagnostics(page)).movement.armed).toBe(true);await expect.poll(async()=>(await diagnostics(page)).tokens.find(t=>t.id==='p-'+id).highlighted).toBe(true);}
async function inOneScreen(page){const b=await page.evaluate(()=>({w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight}));expect(b.sw).toBeLessThanOrEqual(b.w);expect(b.sh).toBeLessThanOrEqual(b.h+1);}

for(const width of [320,390])test(`daytime ${width}: select a person, click ground and walk without spending or saving`,async({page})=>{
 await page.setViewportSize({width,height:width===320?568:844});const errors=[],posts=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='POST')posts.push(r.url());});const base=await boot(page);
 await select(page,'lin');await expect(page.locator('#map-help')).toContainText('林禾');const target={x:350,y:410},requested=artPoint(target);await clickArt(page,requested);
 await expect.poll(async()=>(await diagnostics(page)).movement.target).not.toBeNull();const paint=artPoint((await diagnostics(page)).movement.target);expect(Math.hypot(paint.x-requested.x,paint.y-requested.y)).toBeLessThan(2.5);
 await expect.poll(async()=>{const p=(await diagnostics(page)).tokens.find(t=>t.id==='p-lin');return Math.hypot(p.x-paint.x,p.y-paint.y);},{timeout:10000}).toBeLessThan(1);
 await expect.poll(async()=>(await diagnostics(page)).tokens.find(t=>t.id==='p-lin').moving).toBe(false);
 const blocked={x:240,y:240},snapped=nearestWalkablePoint(blocked,(await diagnostics(page)).movement.walkMap,target);await clickArt(page,artPoint(blocked));
 await expect.poll(async()=>{const t=(await diagnostics(page)).movement.target;return t?Math.hypot(t.x-snapped.x,t.y-snapped.y):Infinity;}).toBeLessThan(1.5);
 await expect(page.locator('#map-help')).not.toContainText('无法到达');
 expect(posts).toEqual([]);expect(await page.locator('#resources').textContent()).toContain(String(base.resources.materials));await inOneScreen(page);await page.screenshot({path:`test-results/click-move-day-${width}.png`,fullPage:true});expect(errors).toEqual([]);
});

test('Retina touch: pick the actual person, queue movement while paused, arrive and temporarily hold offline',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[],posts=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='POST')posts.push(r.url());});
 await boot(page,true);await page.locator('[data-action=more-night]').click();await page.locator('[data-group=orders][data-value=support]').click();await page.locator('[data-action=auto-pause]').click();await page.locator('[data-action=close-overlay]').click();
 const before=await snapshot(page);await select(page,'lin',true);await expect(page.locator('#battle-person')).toHaveValue('lin');await context.setOffline(true);
 await clickArt(page,artPoint({x:350,y:400}),true);await expect.poll(async()=>(await snapshot(page)).people.find(p=>p.id==='lin').task?.type).toBe('move');
 const queued=await snapshot(page);expect(queued.elapsed).toBe(0);expect(queued.paused).toBe(true);expect(queued.people.find(p=>p.id==='hero').task).toBeNull();expect(queued.resources).toEqual(before.resources);await expect(page.locator('#map-help')).toContainText('继续后移动');await expect(page.locator('#battle-live')).toContainText('待出发');
 await expect.poll(async()=>(await diagnostics(page)).movement.target?.x).toBeCloseTo(350,2);await page.screenshot({path:'test-results/click-move-queued-retina.png',fullPage:true});
 await page.locator('[data-action=pause]').tap();await expect.poll(async()=>((await snapshot(page)).people.find(p=>p.id==='lin').task?.stage==='work'?(await snapshot(page)).people.find(p=>p.id==='lin').x:undefined),{timeout:10000}).toBeCloseTo(350,2);
 const arrived=(await snapshot(page)).people.find(p=>p.id==='lin');await page.waitForTimeout(500);const held=(await snapshot(page)).people.find(p=>p.id==='lin');expect(held.x).toBe(arrived.x);expect(held.y).toBe(arrived.y);
 await select(page,'hero',true);await clickArt(page,artPoint({x:335,y:205}),true);await expect.poll(async()=>((await snapshot(page)).people.find(p=>p.id==='hero').task?.stage==='work'?(await snapshot(page)).people.find(p=>p.id==='hero').y:undefined),{timeout:15000}).toBeCloseTo(205,2);
 await page.locator('[data-action=pause]').tap();await expect(page.locator('[data-action=pause]')).toHaveText('继续');await page.waitForTimeout(200);const frozen=(await diagnostics(page)).tokens;await page.waitForTimeout(250);expect((await diagnostics(page)).tokens).toEqual(frozen);expect(posts).toEqual([]);await inOneScreen(page);await page.screenshot({path:'test-results/click-move-night-retina.png',fullPage:true});expect(errors).toEqual([]);await context.close();
});

test('map orders snap a blocked tap, refund the replaced job, and distinguish a drag from a tap',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await boot(page,true);await selectZone(page,'left');await page.locator('[data-command=repair]').click();
 await expect.poll(async()=>(await snapshot(page)).people.find(p=>p.id==='hero').task?.type).toBe('repair');const before=await snapshot(page);await select(page,'hero');
 const box=await page.locator('canvas').boundingBox();await page.mouse.move(box.x+box.width*.5,box.y+box.height*.7);await page.mouse.down();await page.mouse.move(box.x+box.width*.8,box.y+box.height*.8,{steps:8});await page.mouse.up();expect((await snapshot(page)).people.find(p=>p.id==='hero').task.type).toBe('repair');
 const expected=nearestWalkablePoint({x:240,y:240},before.walkMap,before.people.find(p=>p.id==='hero'));await clickArt(page,artPoint({x:240,y:240}));
 await expect.poll(async()=>{const t=(await snapshot(page)).people.find(p=>p.id==='hero').task?.target;return t?Math.hypot(t.x-expected.x,t.y-expected.y):Infinity;}).toBeLessThan(1.5);expect((await snapshot(page)).resources.materials).toBe(before.resources.materials+1);
 await clickArt(page,artPoint({x:150,y:410}));await expect.poll(async()=>Math.abs((await snapshot(page)).people.find(p=>p.id==='hero').task?.target.x-150)).toBeLessThan(1.5);expect((await snapshot(page)).resources.materials).toBe(before.resources.materials+1);expect(errors).toEqual([]);
});

test('painted wall edges accept ground taps and exterior taps snap to the nearest inside edge',async({page})=>{
 await boot(page);await select(page,'hero');
 for(const requested of [{x:60,y:400},{x:420,y:400},{x:15,y:350},{x:300,y:520}]){
  const before=await diagnostics(page),expected=nearestWalkablePoint(worldPoint(requested),before.movement.walkMap);
  await clickArt(page,requested);await expect.poll(async()=>{const t=(await diagnostics(page)).movement.target;return t?Math.hypot(t.x-expected.x,t.y-expected.y):Infinity;}).toBeLessThan(1.5);
  expect(walkablePoint((await diagnostics(page)).movement.target,before.movement.walkMap)).toBe(true);
 }
 await select(page,'lin');const d=await diagnostics(page);expect(d.tokens.find(t=>t.id==='p-hero').highlighted).toBe(false);expect(d.tokens.find(t=>t.id==='p-lin').highlighted).toBe(true);
 await page.screenshot({path:'test-results/click-move-highlight-and-snap.png',fullPage:true});
});

for(const width of [320,390])test(`safe standing ${width}: house-front taps stay solid, gate taps stop inside and sleepers stay indoors`,async({page})=>{
 await page.setViewportSize({width,height:width===320?568:844});const errors=[],posts=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='POST')posts.push(r.url());});
 const s=await boot(page);await select(page,'hero');
 // Move clear of the short-screen touch hit area before tapping the house front.
 await clickArt(page,{x:320,y:400});
 await expect.poll(async()=>{const p=(await diagnostics(page)).tokens.find(t=>t.id==='p-hero');return Math.hypot(p.x-320,p.y-400);},{timeout:10000}).toBeLessThan(3);
 await expect.poll(async()=>(await diagnostics(page)).tokens.find(t=>t.id==='p-hero').moving).toBe(false);
 for(const requested of [{x:180,y:272},{x:300,y:272}]){
  const map=(await diagnostics(page)).movement.walkMap,ideal=artPoint(nearestWalkablePoint(worldPoint(requested),map));
  await clickArt(page,requested);
  await expect.poll(async()=>(await diagnostics(page)).movement.target).not.toBeNull();
  const expected=artPoint((await diagnostics(page)).movement.target);expect(Math.hypot(expected.x-ideal.x,expected.y-ideal.y)).toBeLessThan(3);
  await expect.poll(async()=>{const p=(await diagnostics(page)).tokens.find(t=>t.id==='p-hero');return Math.hypot(p.x-expected.x,p.y-expected.y);},{timeout:10000}).toBeLessThan(1);
  await expect.poll(async()=>(await diagnostics(page)).tokens.find(t=>t.id==='p-hero').moving).toBe(false);
  const p=(await diagnostics(page)).tokens.find(t=>t.id==='p-hero');expect(p.y).toBeGreaterThan(HOUSE_ANCHOR.y);expect(p.occluded).toBe(false);expect(p.visible).toBe(true);expect(p.alpha).toBe(1);expect(p.occluders).not.toContain('house');
 }
 await page.screenshot({path:`.local/validation/safe-standing/house-front-${width}.png`,fullPage:true});
 const map=(await diagnostics(page)).movement.walkMap,ideal=artPoint(nearestWalkablePoint(worldPoint({x:240,y:500}),map));
 await clickArt(page,{x:240,y:500});
 await expect.poll(async()=>(await diagnostics(page)).movement.target).not.toBeNull();
 const target=artPoint((await diagnostics(page)).movement.target);expect(Math.hypot(target.x-ideal.x,target.y-ideal.y)).toBeLessThan(3);
 await expect.poll(async()=>{const p=(await diagnostics(page)).tokens.find(t=>t.id==='p-hero');return Math.hypot(p.x-target.x,p.y-target.y);},{timeout:12000}).toBeLessThan(1);
 await expect.poll(async()=>(await diagnostics(page)).tokens.find(t=>t.id==='p-hero').moving).toBe(false);
 const gate=await diagnostics(page),person=gate.tokens.find(t=>t.id==='p-hero');expect(person.y).toBeLessThanOrEqual(443.01);expect(person.y).toBeLessThan(gate.components.find(c=>c.id==='gate').depth);
 await page.screenshot({path:`.local/validation/safe-standing/gate-inside-${width}.png`,fullPage:true});
 Object.assign(s,applyCampaignAction(s,{type:'prepare'}));for(const p of s.people)p.nightRole='sleep';
 await page.reload();await expect(page.locator('#world')).toHaveAttribute('data-ready','true');
 await expect.poll(async()=>(await diagnostics(page)).tokens.filter(t=>t.id.startsWith('p-')).length).toBe(0);
 expect((await diagnostics(page)).shelter.people).toEqual(['hero','lin']);
 await page.locator('[data-action=start-night]').click();await expect(page.locator('[data-action=pause]')).toHaveText('继续');
 await expect.poll(async()=>(await diagnostics(page)).tokens.filter(t=>t.id.startsWith('p-')).length).toBe(0);
 expect((await diagnostics(page)).shelter.people).toEqual(['hero','lin']);await expect(page.locator('#battle-live')).toContainText('屋内睡眠');
 await page.screenshot({path:`.local/validation/safe-standing/sleep-${width}.png`,fullPage:true});
 expect(posts).toEqual([]);expect(errors).toEqual([]);await inOneScreen(page);
});
