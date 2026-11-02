import {test,expect} from '@playwright/test';
import {initialCampaign,applyCampaignAction as act,settleNight} from '../src/campaign.js';
import {createBattle,stepBattle,battleCommand,inner} from '../src/battle.js';
import {ZONES} from '../src/content.js';

for(const width of [320,390,1280])test(`clearing the last wave ends immediately with actual time at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:width===320?568:844});let state=act(initialCampaign(53),{type:'chooseRole',role:'watchman'});state=act(state,{type:'prepare'});
 const b=createBattle(state,'clear-ui',{autoPause:false});b.elapsed=42;b.challenge=null;b.schedule=[{at:44,type:'walker',zone:'left'}];b.enemies=[{id:'first',type:'walker',zone:'gate',x:240,y:475,hp:1,max:34.5,mode:'attack',attack:0,progress:0,stun:0}];
 const errors=[],payloads=[];page.on('pageerror',e=>errors.push(e.message));
 const publish=()=>page.evaluate(data=>window.__clearWorker.dispatchEvent(new MessageEvent('message',{data})),{type:'state',battle:b,result:b.finished?settleNight(state,b):null,steps:Math.round(b.elapsed*20)});
 await page.exposeFunction('__clearCommand',async m=>{if(m.type==='dispose')return;if(m.type==='command')battleCommand(b,m.action);await publish();});
 await page.addInitScript(()=>{const Native=window.Worker;window.Worker=class extends EventTarget{constructor(url,options){super();if(!String(url).includes('night-worker'))return new Native(url,options);window.__clearWorker=this;queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:{type:'ready'}})));}postMessage(m){window.__clearCommand(m);}terminate(){}};});
 await page.route('**/api/campaign',route=>route.fulfill({json:{state,runId:'clear-ui',revision:1}}));await page.route('**/api/campaign/night-result',route=>{const payload=route.request().postDataJSON();payloads.push(payload);return route.fulfill({json:{state:payload.result,runId:'clear-ui',revision:2}});});
 await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');if(width<960)await page.getByRole('button',{name:'打开游戏菜单'}).click();await page.locator('[data-action=drawer][data-panel=ready]').filter({visible:true}).click();await expect(page.getByTestId('night-clear-rule')).toContainText('立即结束');await page.locator('[data-action=close-overlay]').click();await page.locator('[data-action=start-night]').click();await expect(page.locator('#phase')).toHaveText('实时守夜');
 await expect(page.locator('#scene-time')).toHaveText('已守夜42秒 · 场上1 · 待来1');expect(await page.locator('#nightbar .progress').count()).toBe(0);
 b.paused=false;stepBattle(b);b.paused=true;await publish();expect(b.finished).toBe(false);await expect(page.locator('#scene-time')).toContainText('场上0 · 待来1');expect(payloads).toHaveLength(0);
 b.paused=false;while(b.elapsed<44.1)stepBattle(b);const last=b.enemies[0];Object.assign(last,{x:70,y:310,mode:'attack',hp:1});Object.assign(b.people[0],inner(ZONES[1]),{cooldown:0});battleCommand(b,{type:'guard',person:'hero',target:'left'});stepBattle(b);expect(b.finished).toBe(true);await publish();
 await expect(page.locator('#phase')).toHaveText('天亮战报');await expect(page.getByTestId('night-elapsed')).toContainText(`${Number(b.elapsed.toFixed(2))}秒`);expect(b.elapsed).toBeLessThan(45);expect(payloads).toHaveLength(1);expect(payloads[0].result.report.elapsed).toBe(Number(b.elapsed.toFixed(2)));
 const layout=await page.locator('#sheet-body').evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth,page:document.documentElement.scrollWidth,width:innerWidth}));expect(layout.scroll).toBeLessThanOrEqual(layout.client);expect(layout.page).toBeLessThanOrEqual(layout.width);await page.screenshot({path:`.local/night-clear/report-${width}.png`,fullPage:true});expect(errors).toEqual([]);
});

test('a real offline worker finishes before the old limit and saves that result once after reconnecting',async({page,context})=>{
 test.setTimeout(90000);await page.addInitScript(()=>{const Native=window.Worker;window.Worker=class extends Native{constructor(url,options){super(url,options);if(String(url).includes('night-worker'))window.__realClearWorker=this;}};});
 await page.goto('/');await page.getByRole('button',{name:/夜班保安/}).click();await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await page.locator('[data-action=prepare]').click();await expect(page.locator('#phase')).toHaveText('黄昏准备');const before=await page.request.get('/api/campaign').then(r=>r.json());await page.locator('[data-action=start-night]').click();
 const snapshot=()=>page.locator('#world').evaluate(el=>el.getNightSnapshot());await expect.poll(async()=>(await snapshot())?.paused).toBe(true);
 await page.locator('[data-action=more-night]').click();await page.locator('[data-group=orders][data-value=support]').click();await page.locator('[data-action=auto-pause]').click();await page.locator('[data-action=close-overlay]').click();
 await page.evaluate(()=>window.__realClearWorker.postMessage({type:'command',action:{type:'speed',value:2}}));await context.setOffline(true);await page.locator('[data-action=pause]').click();
 await expect.poll(async()=>{
  const b=await snapshot();if(b.finished)return true;const hero=b.people[0],target=b.enemies.find(e=>e.hp>0);if(target&&!hero.task){await page.locator('#battle-zone').selectOption(target.zone);await page.locator('[data-action=night-cmd][data-command=guard]').click();}return false;
 },{timeout:75000,intervals:[200]}).toBe(true);
 const ended=await snapshot();expect(ended.schedule).toHaveLength(0);expect(ended.enemies).toHaveLength(0);expect(ended.elapsed).toBeLessThan(120);await expect.poll(()=>page.locator('#world').evaluate(el=>el.getNightDiagnostics().pendingSave)).toBe(true);
 const payloads=[];page.on('request',r=>{if(r.url().endsWith('/api/campaign/night-result'))payloads.push(r.postDataJSON());});await context.setOffline(false);await expect(page.locator('#phase')).toHaveText('天亮战报');
 const saved=await page.request.get('/api/campaign').then(r=>r.json());expect(saved.revision).toBe(before.revision+1);expect(saved.state.report.elapsed).toBe(Number(ended.elapsed.toFixed(2)));expect(payloads.length).toBeGreaterThanOrEqual(1);expect(payloads.every(p=>p.nightId===payloads[0].nightId)).toBe(true);
 const replay=await page.request.post('/api/campaign/night-result',{data:payloads[0]});expect(replay.status()).toBe(200);expect((await replay.json()).revision).toBe(saved.revision);
});
