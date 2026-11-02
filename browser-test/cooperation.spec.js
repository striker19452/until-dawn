import {selectZone} from './support/ui.js';
import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {initialCampaign,applyCampaignAction,settleNight} from '../src/campaign.js';
import {createBattle,battleCommand,stepBattle,inner} from '../src/battle.js';
import {ZONES} from '../src/content.js';

const snapshot=page=>page.locator('#world').evaluate(el=>el.getNightSnapshot());
function base(){
 let state=applyCampaignAction(initialCampaign(53),{type:'chooseRole',role:'repairman'});state=applyCampaignAction(state,{type:'recruit',person:'lin'});
 state=applyCampaignAction(state,{type:'nightRole',person:'hero',role:'guard',zone:'left'});state=applyCampaignAction(state,{type:'nightRole',person:'lin',role:'support',zone:'left'});
 return applyCampaignAction(state,{type:'prepare'});
}

for(const width of [320,390])test(`warning ${width}: deploy before contact, keep helping past a far local and recall only when it approaches`,async({page})=>{
 await page.setViewportSize({width,height:width===320?568:844});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const state=base();state.people[1].nightRole='guard';state.buildings=[{id:'tower',type:'watchtower',level:1,branch:'normal',hp:10}];
 const b=createBattle(state,'warning-ui',{autoPause:false});b.schedule=[{at:9999,type:'walker',zone:'gate'}];b.challenge=null;b.supportBudget={materials:0,firewood:0};b.zones.forEach(z=>z.hp=100);
 const foe=(id,zone,x,y)=>({id,type:'walker',zone,x,y,hp:100,max:100,mode:'approach',attack:0,progress:0,stun:0,called:false});
 b.enemies=[foe('incoming','gate',240,inner(ZONES[0]).y+140),foe('far-home','left',-200,310)];
 const publish=()=>page.evaluate(battle=>window.__warningWorker.dispatchEvent(new MessageEvent('message',{data:{type:'state',battle,result:null,steps:0}})),b);
 await page.exposeFunction('__warningMessage',async message=>{if(message.type==='command')battleCommand(b,message.action);if(message.type!=='dispose')await publish();});
 await page.addInitScript(()=>{const Original=window.Worker;window.Worker=class extends EventTarget{constructor(url,options){super();if(!String(url).includes('night-worker'))return new Original(url,options);window.__warningWorker=this;queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:{type:'ready'}})));}postMessage(message){window.__warningMessage(message);}terminate(){}};});
 await page.route('**/api/campaign',route=>route.fulfill({json:{state,runId:'warning-ui',revision:1}}));await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await page.locator('[data-action=start-night]').click();await expect(page.locator('[data-action=pause]')).toHaveText('继续');await page.locator('#battle-person').selectOption('lin');await page.locator('[data-action=pause]').click();
 await expect.poll(async()=>(await snapshot(page)).paused).toBe(false);stepBattle(b);await publish();
 expect(b.people[1].task?.target).toBe('gate');await expect(page.getByTestId('active-order').locator('[data-order=current]')).toContainText('预警提前就位');
 expect(b.events.some(e=>e.type==='contact')).toBe(false);const task=b.people[1].task;for(let i=0;i<10;i++)stepBattle(b);expect(b.people[1].task).toBe(task);await publish();
 await page.screenshot({path:`.local/validation/warning/early-${width}.png`,fullPage:true});
 b.enemies.find(e=>e.id==='far-home').x=-20;stepBattle(b);await publish();expect(b.people[1].task).toBeNull();await expect(page.getByTestId('active-order').locator('[data-order=current]')).toContainText('巡守左栏');
 expect(b.people[1].zone).toBe('left');expect(errors).toEqual([]);for(const el of ['#panel','#zones','#nav'])expect(await page.locator(el).evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
});

for(const width of [320,390])test(`cooperation ${width}: finish home work, help another zone, refund obsolete work and preserve manual priority`,async({page})=>{
 await page.setViewportSize({width,height:width===320?568:844});const errors=[],posts=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='POST')posts.push(r.url());});
 const state=base(),b=createBattle(state,'coop-ui',{autoPause:false});b.schedule=[{at:9999,type:'walker',zone:'gate'}];b.challenge=null;b.zones.forEach(z=>z.hp=100);b.zones[1].hp=40;b.zones[0].hp=10;b.supportBudget={materials:2,firewood:0};
 const publish=()=>page.evaluate(battle=>window.__coopWorker.dispatchEvent(new MessageEvent('message',{data:{type:'state',battle,result:null,steps:0}})),b);
 await page.exposeFunction('__coopMessage',async message=>{if(message.type==='command')battleCommand(b,message.action);if(message.type!=='dispose')await publish();});
 await page.addInitScript(()=>{const Original=window.Worker;window.Worker=class extends EventTarget{constructor(url,options){super();if(!String(url).includes('night-worker'))return new Original(url,options);window.__coopWorker=this;queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:{type:'ready'}})));}postMessage(message){window.__coopMessage(message);}terminate(){}};});
 await page.route('**/api/campaign',route=>route.fulfill({json:{state,runId:'coop-ui',revision:1}}));await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await page.locator('[data-action=start-night]').click();await expect(page.locator('[data-action=pause]')).toHaveText('继续');await page.locator('#battle-person').selectOption('lin');
 await page.locator('[data-action=pause]').click();await expect.poll(async()=>(await snapshot(page)).paused).toBe(false);stepBattle(b);await publish();
 await expect(page.getByTestId('active-order').locator('[data-order=current]')).toContainText('自动修补');expect(b.people[1].task.target).toBe('left');
 for(let i=0;i<400&&b.people[1].task;i++)stepBattle(b);stepBattle(b);await publish();
 await expect(page.getByTestId('active-order').locator('[data-order=current]')).toContainText('自动支援修补');expect(b.people[1].task.target).toBe('gate');await expect(page.getByTestId('active-order').locator('[data-order=role]')).toHaveText('支援修补添火 · 左栏');await expect(page.getByTestId('active-order').locator('[data-order=after]')).toContainText('重点左栏');
 await page.screenshot({path:`.local/validation/cooperation/support-${width}.png`,fullPage:true});
 const reserved=b.resources.materials;b.zones[0].hp=100;stepBattle(b);await publish();expect(b.resources.materials).toBe(reserved+1);expect(b.people[1].task).toBeNull();
 b.zones[2].hp=40;await page.locator('[data-action=pause]').click();await expect.poll(async()=>(await snapshot(page)).paused).toBe(true);await selectZone(page,'right');await page.locator('[data-command=repair]').click();await expect.poll(async()=>(await snapshot(page)).people[1].task?.automatic).toBe(false);
 await expect(page.getByTestId('active-order').locator('[data-order=current]')).toContainText('临时修补');expect(b.people[1].zone).toBe('left');expect(posts).toEqual([]);expect(errors).toEqual([]);
 for(const el of ['#panel','#zones','#nav'])expect(await page.locator(el).evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
});

test('the real offline worker dispatches an idle guard companion to an uncovered distant threat and accepts a manual override',async({page,context})=>{
 const state=base();state.people[1].nightRole='guard';state.flags.seenTypes=['walker'];state.flags.scouted=state.day;state.buildings=[{id:'tower',type:'watchtower',level:2,branch:'yield',hp:10}];const plan=createBattle(state,'preview',{autoPause:false}),first=ZONES.find(z=>z.id===plan.schedule[0].zone),home=[...ZONES].sort((a,b)=>Math.hypot(b.x-first.x,b.y-first.y)-Math.hypot(a.x-first.x,a.y-first.y))[0];state.zones.find(z=>z.id===first.id).bell=true;for(const p of state.people)p.zone=home.id;
 await page.route('**/api/campaign',route=>route.fulfill({json:{state,runId:randomUUID(),revision:1}}));await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await page.locator('[data-action=start-night]').click();await expect(page.locator('[data-action=pause]')).toHaveText('继续');await page.locator('#battle-person').selectOption('lin');
 await page.locator('[data-action=more-night]').click();await page.locator('[data-group=orders][data-value=support]').click();await page.locator('[data-action=auto-pause]').click();await page.locator('[data-action=close-overlay]').click();await context.setOffline(true);await page.locator('[data-action=pause]').click();
 await expect.poll(async()=>(await snapshot(page)).people.find(p=>p.id==='lin').task?.assist,{timeout:25000}).toBe(true);
 await expect(page.getByTestId('active-order').locator('[data-order=current]')).toContainText('预警提前就位');const early=await snapshot(page),incoming=early.enemies.find(e=>e.zone===first.id);expect(incoming.mode).toBe('approach');expect(Math.hypot(incoming.x-inner(first).x,incoming.y-inner(first).y)).toBeGreaterThan(125);expect(early.people[1].zone).toBe(home.id);await page.screenshot({path:'.local/validation/warning/guard-offline.png',fullPage:true});
 await page.locator('[data-action=pause]').click();await expect.poll(async()=>(await snapshot(page)).paused).toBe(true);await selectZone(page,'gate');await page.locator('[data-command=repair]').click();await expect.poll(async()=>(await snapshot(page)).people[1].task?.automatic).toBe(false);expect((await snapshot(page)).people[1].zone).toBe(home.id);
});

test('real API saves automatic guard assistance with unchanged assignments and no duplicated fatigue on retry',async({page})=>{
 let snap=await page.request.get('/api/campaign').then(r=>r.json());
 const action=async action=>{const r=await page.request.post('/api/campaign/action',{data:{runId:snap.runId,revision:snap.revision,requestId:randomUUID(),action}});expect(r.status()).toBe(200);snap=await r.json();};
 await action({type:'chooseRole',role:'repairman'});await action({type:'recruit',person:'lin'});for(const id of ['hero','lin'])await action({type:'nightRole',person:id,role:'guard',zone:'left'});await action({type:'prepare'});
 const b=createBattle(snap.state,`local-${snap.runId}-${snap.revision}`,{autoPause:false});b.schedule=[{at:9999,type:'walker',zone:'gate'}];b.challenge=null;b.paused=false;b.enemies=[{id:'front',type:'walker',zone:'gate',x:240,y:475,hp:23,max:23,mode:'attack',attack:0,progress:0,stun:0,called:false}];stepBattle(b);expect(b.people[1].task.assist).toBe(true);
 for(let i=0;i<1600&&(b.enemies.length||b.people[1].task);i++)stepBattle(b);expect(b.enemies).toHaveLength(0);
 const result=settleNight(snap.state,b),request={runId:snap.runId,revision:snap.revision,nightId:b.id,orderModel:'temporary-v1',result};const r=await page.request.post('/api/campaign/night-result',{data:request});expect(r.status()).toBe(200);const saved=await r.json();expect(saved.state.people[1].nightRole).toBe('guard');expect(saved.state.people[1].zone).toBe('left');expect(saved.state.people[1].task).toBeUndefined();expect(saved.state.report.events.some(line=>line.includes('自动支援'))).toBe(true);
 const retry=await page.request.post('/api/campaign/night-result',{data:request});expect(retry.status()).toBe(200);const replay=await retry.json();expect(replay.revision).toBe(saved.revision);expect(replay.state.people[1].fatigue).toBe(saved.state.people[1].fatigue);
});
