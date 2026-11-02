import {openTab} from './support/ui.js';
import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {initialCampaign,applyCampaignAction,settleNight} from '../src/campaign.js';
import {createBattle,battleCommand,stepBattle} from '../src/battle.js';
import {artPoint} from '../src/yard-geometry.js';

const diagnostics=page=>page.locator('canvas').evaluate(c=>c.getYardDiagnostics());
const snapshot=page=>page.locator('#world').evaluate(el=>el.getNightSnapshot());
async function boot(page){
 let state=applyCampaignAction(initialCampaign(53),{type:'chooseRole',role:'repairman'});
 state=applyCampaignAction(state,{type:'recruit',person:'lin'});
 state=applyCampaignAction(state,{type:'nightRole',person:'hero',role:'sleep'});
 state=applyCampaignAction(state,{type:'nightRole',person:'lin',role:'guard',zone:'right'});
 state=applyCampaignAction(state,{type:'prepare'});
 await page.route('**/api/campaign',route=>route.fulfill({json:{state,runId:randomUUID(),revision:1}}));
 await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');
 await expect.poll(async()=>(await diagnostics(page)).shelter.people).toEqual(['hero']);
 expect((await diagnostics(page)).tokens.some(p=>p.id==='p-hero')).toBe(false);
 expect((await diagnostics(page)).tokens.some(p=>p.id==='p-lin')).toBe(true);
 await page.locator('[data-action=start-night]').click();await expect(page.locator('[data-action=pause]')).toHaveText('继续');
 await expect(page.locator('#battle-live')).toContainText('屋内睡眠');
 await page.locator('[data-action=more-night]').click();await page.locator('[data-group=orders][data-value=support]').click();await page.locator('[data-action=auto-pause]').click();await page.locator('[data-action=close-overlay]').click();
}
async function clickGround(page,target){
 const {metrics}=await diagnostics(page),box=await page.locator('canvas').boundingBox(),p=artPoint(target);
 await page.mouse.click(box.x+box.width/2+(p.x-240)*metrics.cssScale,box.y+box.height/2+(p.y-metrics.centerY)*metrics.cssScale);
}
for(const width of [320,390])test(`indoor sleep ${width}: paused commands wait inside, then leave and return after a temporary task offline`,async({page,context})=>{
 await page.setViewportSize({width,height:width===320?568:844});const errors=[],posts=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='POST')posts.push(r.url());});
 await boot(page);await page.screenshot({path:`.local/validation/sleep/indoors-${width}.png`,fullPage:true});
 await page.locator('#battle-person').selectOption('hero');await context.setOffline(true);await clickGround(page,{x:315,y:365});
 await expect.poll(async()=>(await snapshot(page)).people[0].task?.type).toBe('move');
 expect((await snapshot(page)).elapsed).toBe(0);expect((await snapshot(page)).indoorPeople.hero).toBe(true);
 expect((await snapshot(page)).sleepInterrupted.hero).toBeUndefined();
 expect((await diagnostics(page)).tokens.some(p=>p.id==='p-hero')).toBe(false);
 await page.locator('[data-action=pause]').click();
 await expect.poll(async()=>(await diagnostics(page)).tokens.some(p=>p.id==='p-hero')).toBe(true);
 expect((await snapshot(page)).sleepInterrupted.hero).toBe(true);await expect(page.getByTestId('active-order').locator('[data-order=after]')).toContainText('本夜无睡眠收益');
 await expect.poll(async()=>(await snapshot(page)).people[0].task?.stage,{timeout:8000}).toBe('work');
 const outside=(await diagnostics(page)).tokens.find(p=>p.id==='p-hero');expect(outside.visible).toBe(true);expect(outside.occluded).toBe(false);
 await page.screenshot({path:`.local/validation/sleep/temporary-task-${width}.png`,fullPage:true});
 await expect.poll(async()=>(await snapshot(page)).indoorPeople.hero,{timeout:20000}).toBe(true);
 await expect.poll(async()=>(await diagnostics(page)).tokens.some(p=>p.id==='p-hero')).toBe(false);
 await expect(page.locator('#battle-live')).toContainText('睡眠已中断');expect((await diagnostics(page)).shelter.label).toBe('屋内休息 · 1人');
 await page.locator('[data-action=pause]').click();await openTab(page,'members');
 await expect(page.getByTestId('person-order').locator('[data-order=current]')).toHaveText('屋内休息 · 睡眠已中断');
 await page.screenshot({path:`.local/validation/sleep/returned-${width}.png`,fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight+1)).toBe(true);
 expect(posts).toEqual([]);expect(errors).toEqual([]);
});

test('a sleeper returns indoors after a paused cancellation and unused material is refunded once',async({page})=>{
 await boot(page);const materials=(await snapshot(page)).resources.materials;
 await page.locator('[data-command=repair]').click();await expect.poll(async()=>(await snapshot(page)).resources.materials).toBe(materials-1);
 await page.locator('[data-action=pause]').click();await expect.poll(async()=>(await snapshot(page)).indoorPeople.hero).toBeUndefined();
 await page.locator('[data-action=pause]').click();await expect.poll(async()=>(await snapshot(page)).paused).toBe(true);const before=(await snapshot(page)).people[0];
 await page.locator('[data-action=more-night]').click();await page.locator('[data-group=orders][data-value=actions]').click();await page.locator('[data-command=cancel]').click();
 await expect.poll(async()=>(await snapshot(page)).resources.materials).toBe(materials);
 await page.locator('[data-command=cancel]').click();expect((await snapshot(page)).resources.materials).toBe(materials);
 await page.waitForTimeout(250);expect((await snapshot(page)).people[0].x).toBe(before.x);expect((await snapshot(page)).people[0].y).toBe(before.y);
 await page.locator('[data-action=close-overlay]').click();await page.locator('[data-action=pause]').click();
 await expect.poll(async()=>(await snapshot(page)).indoorPeople.hero,{timeout:10000}).toBe(true);
 await expect.poll(async()=>(await diagnostics(page)).tokens.some(p=>p.id==='p-hero')).toBe(false);
 await expect(page.locator('#battle-live')).toContainText('睡眠已中断');
});

test('real API accepts indoor sleep results, keeps the configured assignment and reloads without runtime occupancy fields',async({page})=>{
 let snap=await page.request.get('/api/campaign').then(r=>r.json());
 const action=async action=>{const r=await page.request.post('/api/campaign/action',{data:{runId:snap.runId,revision:snap.revision,requestId:randomUUID(),action}});expect(r.status()).toBe(200);snap=await r.json();};
 await action({type:'chooseRole',role:'repairman'});await action({type:'nightRole',person:'hero',role:'sleep'});await action({type:'prepare'});
 const battle=createBattle(snap.state,`local-${snap.runId}-${snap.revision}`),result=settleNight(snap.state,battle);
 expect(battle.indoorPeople.hero).toBe(true);
 const r=await page.request.post('/api/campaign/night-result',{data:{runId:snap.runId,revision:snap.revision,nightId:battle.id,orderModel:'temporary-v1',result}});expect(r.status()).toBe(200);
 const saved=await page.request.get('/api/campaign').then(r=>r.json());expect(saved.state.people[0].nightRole).toBe('sleep');expect(saved.state.indoorPeople).toBeUndefined();expect(saved.state.people[0].indoors).toBeUndefined();expect(saved.state.people[0].x).toBeUndefined();
 snap=saved;await action({type:'nextDay'});await action({type:'prepare'});
 const called=createBattle(snap.state,`local-${snap.runId}-${snap.revision}`);called.schedule=[{at:9999,type:'walker',zone:'gate'}];called.challenge=null;
 battleCommand(called,{type:'move',person:'hero',target:{x:315,y:365}});battleCommand(called,{type:'resume'});stepBattle(called);battleCommand(called,{type:'cancel',person:'hero'});called.schedule=[];stepBattle(called);
 const calledResult=settleNight(snap.state,called),payload={runId:snap.runId,revision:snap.revision,nightId:called.id,orderModel:'temporary-v1',result:calledResult};
 const finished=await page.request.post('/api/campaign/night-result',{data:payload});expect(finished.status()).toBe(200);
 const after=await finished.json();expect(after.state.report.events.some(line=>line.includes('睡眠已中断')&&line.includes('未恢复22疲劳'))).toBe(true);expect(after.state.sleepInterrupted).toBeUndefined();expect(after.state.people[0].sleepInterrupted).toBeUndefined();
 const retry=await page.request.post('/api/campaign/night-result',{data:payload});expect(retry.status()).toBe(200);const replay=await retry.json();expect(replay.revision).toBe(after.revision);expect(replay.state.people[0].fatigue).toBe(after.state.people[0].fatigue);
});

test('interrupted sleep report explains the withheld recovery and the saved member keeps 60 fatigue',async({page})=>{
 let state=applyCampaignAction(initialCampaign(53),{type:'chooseRole',role:'repairman'});state.people[0].fatigue=60;
 state=applyCampaignAction(state,{type:'nightRole',person:'hero',role:'sleep'});state=applyCampaignAction(state,{type:'prepare'});
 const battle=createBattle(state,'sleep-report',{autoPause:false});battle.schedule=[{at:9999,type:'walker',zone:'gate'}];battle.challenge=null;
 battleCommand(battle,{type:'move',person:'hero',target:{x:315,y:365}});battleCommand(battle,{type:'resume'});stepBattle(battle);battleCommand(battle,{type:'cancel',person:'hero'});battle.finished=true;battle.paused=true;
 const result=settleNight(state,battle);
 await page.exposeFunction('__sleepReportMessage',async message=>{if(message.type==='init')await page.evaluate(data=>window.__sleepReportWorker.dispatchEvent(new MessageEvent('message',{data})),{type:'state',battle,result,steps:1});});
 await page.addInitScript(()=>{const Original=window.Worker;window.Worker=class extends EventTarget{constructor(url,options){super();if(!String(url).includes('night-worker'))return new Original(url,options);window.__sleepReportWorker=this;queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:{type:'ready'}})));}postMessage(message){window.__sleepReportMessage(message);}terminate(){}};});
 await page.route('**/api/campaign',route=>route.fulfill({json:{state,runId:'sleep-report',revision:1}}));await page.route('**/api/campaign/night-result',route=>route.fulfill({json:{state:result,runId:'sleep-report',revision:2}}));
 await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await page.locator('[data-action=start-night]').click();await expect(page.locator('#phase')).toHaveText('天亮战报');
 await page.locator('[data-group=report][data-value=events]').click();await expect(page.locator('#sheet-body')).toContainText('本夜未获得睡眠收益，未恢复22疲劳');await page.screenshot({path:'.local/validation/sleep/interrupted-report.png',fullPage:true});
 await page.locator('[data-action=close-overlay]').click();await openTab(page,'members');await expect(page.locator('.stat').filter({has:page.locator('span',{hasText:/^疲劳$/})}).locator('b')).toHaveText('60 / 100');
});
