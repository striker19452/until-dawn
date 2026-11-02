import {openTab,selectZone} from './support/ui.js';
import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {initialCampaign,applyCampaignAction as act,settleNight} from '../src/campaign.js';
import {createBattle,battleCommand,stepBattle,inner} from '../src/battle.js';
import {fearRetreat} from '../src/fear.js';
import {ZONES} from '../src/content.js';

const snapshot=page=>page.locator('#world').evaluate(el=>el.getNightSnapshot());
const intruder=p=>({id:'inside',type:'walker',zone:'gate',x:p.x,y:p.y,hp:1000,max:1000,mode:'inside',stun:0,attack:0,progress:0});
async function controlled(page){
 let state=act(initialCampaign(53),{type:'chooseRole',role:'repairman'});state=act(state,{type:'recruit',person:'lin'});state.people[0].nightRole='sleep';state.people[1].nightRole='guard';state.people[1].zone='left';state=act(state,{type:'prepare'});
 const b=createBattle(state,'fear-ui',{autoPause:false});b.schedule=[{at:9999,type:'walker',zone:'gate'}];b.challenge=null;b.fires=[];b.zones.forEach(z=>z.hp=100);
 Object.assign(b.people[1],{x:315,y:400,fear:95});b.enemies=[intruder(b.people[1])];
 const publish=()=>page.evaluate(battle=>window.__fearWorker.dispatchEvent(new MessageEvent('message',{data:{type:'state',battle,result:null,steps:Math.round(battle.elapsed*20)}})),b);
 await page.exposeFunction('__fearMessage',async message=>{if(message.type==='command')battleCommand(b,message.action);if(message.type!=='dispose')await publish();});
 await page.addInitScript(()=>{const Original=window.Worker;window.Worker=class extends EventTarget{constructor(url,options){super();if(!String(url).includes('night-worker'))return new Original(url,options);window.__fearWorker=this;queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:{type:'ready'}})));}postMessage(message){window.__fearMessage(message);}terminate(){}};});
 await page.route('**/api/campaign',route=>route.fulfill({json:{state,runId:'fear-ui',revision:1}}));
 await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await page.locator('[data-action=start-night]').click();await expect(page.locator('[data-action=pause]')).toHaveText('继续');await page.locator('#battle-person').selectOption('lin');
 return {b,publish};
}

for(const width of [320,390,1280])test(`fear ${width}: visible reasons, reliable manual override, four-second calm and restored original post`,async({page})=>{
 await page.setViewportSize({width,height:width===320?568:844});const errors=[],posts=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/api/')&&r.method()==='POST')posts.push(r.url());});
 const {b,publish}=await controlled(page);
 await expect(page.getByTestId('active-order').locator('[data-order=fear]')).toContainText('保守防守');
 await page.locator('[data-action=pause]').click();await expect.poll(async()=>(await snapshot(page)).paused).toBe(false);stepBattle(b);await publish();
 await expect(page.getByTestId('active-order').locator('[data-order=current]')).toContainText('恐惧退却');
 await expect(page.getByTestId('active-order').locator('[data-order=current]')).toContainText('遭到近身攻击');
 await expect(page.getByTestId('active-order').locator('[data-order=after]')).toContainText('返回左栏巡守');
 await page.screenshot({path:`.local/validation/fear/retreat-${width}.png`,fullPage:true});
 await page.locator('[data-action=pause]').click();await expect.poll(async()=>(await snapshot(page)).paused).toBe(true);
 await selectZone(page,'gate');await page.locator('[data-command=guard]').click();
 await expect(page.getByTestId('active-order').locator('[data-order=fear]')).toContainText('手动任务优先');
 expect(b.fearRetreats.lin).toBeUndefined();expect(b.people[1].task.automatic).toBe(false);expect(b.people[1].zone).toBe('left');
 battleCommand(b,{type:'cancel',person:'lin'});b.fearCooldowns.lin=0;b.people[1].fear=95;b.enemies=[intruder(b.people[1])];b.paused=false;stepBattle(b);b.enemies=[];
 for(let i=0;i<600&&fearRetreat(b,b.people[1])?.stage!=='calm';i++)stepBattle(b);
 b.paused=true;await publish();await expect(page.getByTestId('active-order').locator('[data-order=current]')).toContainText('屋内镇定');
 await openTab(page,'members');await page.locator('[data-action=member-view][data-person=lin]').click();
 const guide=page.getByTestId('fear-effects');await expect(guide).toContainText('手动指令可以立即接管');await expect(guide).toContainText('每多1只每秒+0.8，最高+1.6');await expect(guide).toContainText('附近破口每秒+0.24');await expect(guide).toContainText('同伴新重伤+16');await expect(guide).toContainText('夜末出现过破口时+16');
 await expect(guide).toContainText('镇定剩余4秒');await guide.scrollIntoViewIfNeeded();await page.screenshot({path:`.local/validation/fear/guide-${width}.png`,fullPage:true});
 b.paused=false;for(let i=0;i<100&&fearRetreat(b,b.people[1]);i++)stepBattle(b);b.paused=true;await publish();
 await expect(guide).toContainText('退却冷却剩余20秒');expect(b.people[1].nightRole).toBe('guard');expect(b.people[1].zone).toBe('left');
 await page.locator('[data-action=close-overlay]').click();
 b.paused=false;const home=inner(ZONES[1]);for(let i=0;i<600&&Math.hypot(b.people[1].x-home.x,b.people[1].y-home.y)>1;i++)stepBattle(b);b.paused=true;await publish();
 expect(Math.hypot(b.people[1].x-home.x,b.people[1].y-home.y)).toBeLessThan(1.1);
 for(const selector of ['#panel','#zones','#nav'])expect(await page.locator(selector).evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 const layout=await page.evaluate(()=>({height:document.documentElement.scrollHeight,h:innerHeight,width:document.documentElement.scrollWidth,w:innerWidth}));expect(layout.width).toBeLessThanOrEqual(layout.w);expect(layout.height).toBeLessThanOrEqual(layout.h+1);
 expect(posts).toEqual([]);expect(errors).toEqual([]);
});

test('the real client worker completes high-fear manual work using fatigue alone and makes no night requests',async({page})=>{
 let state=act(initialCampaign(53),{type:'chooseRole',role:'repairman'});Object.assign(state.people[0],{fear:100,fatigue:50});state=act(state,{type:'prepare'});
 await page.route('**/api/campaign',route=>route.fulfill({json:{state,runId:'fear-worker',revision:1}}));await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await page.locator('[data-action=start-night]').click();await expect(page.locator('[data-action=pause]')).toHaveText('继续');
 const requests=[];page.on('request',r=>{if(r.url().includes('/api/'))requests.push(r.url());});
 await page.locator('[data-command=repair]').click();await expect(page.getByTestId('active-order').locator('[data-order=fear]')).toContainText('手动任务优先');await page.locator('[data-action=pause]').click();
 await expect.poll(async()=>(await snapshot(page)).people[0].task,{timeout:10000}).toBeNull();
 const b=await snapshot(page);expect(b.elapsed).toBeGreaterThanOrEqual(5);expect(b.events.find(e=>e.type==='repair').time).toBeLessThan(5.1);expect(b.zones[0].hp).toBe(79);expect(b.fearRetreats).toEqual({});expect(requests).toEqual([]);
});

test('real API saves fear-retreat outcome without changing posts or persisting runtime state, and replay does not settle twice',async({page})=>{
 let snap=await page.request.get('/api/campaign').then(r=>r.json());
 async function action(action){const response=await page.request.post('/api/campaign/action',{data:{runId:snap.runId,revision:snap.revision,requestId:randomUUID(),action}});expect(response.status()).toBe(200);snap=await response.json();}
 await action({type:'chooseRole',role:'repairman'});await action({type:'prepare'});
 const b=createBattle(snap.state,`local-${snap.runId}-${snap.revision}`,{autoPause:false});b.schedule=[{at:9999,type:'walker',zone:'gate'}];b.challenge=null;b.paused=false;Object.assign(b.people[0],{x:315,y:400,fear:95});b.enemies=[intruder(b.people[0])];stepBattle(b);b.enemies=[];
 for(let i=0;i<600&&fearRetreat(b,b.people[0]);i++)stepBattle(b);
 const payload={runId:snap.runId,revision:snap.revision,nightId:b.id,orderModel:'temporary-v1',result:settleNight(snap.state,b)};
 const response=await page.request.post('/api/campaign/night-result',{data:payload});expect(response.status()).toBe(200);const saved=await response.json();
 expect(saved.state.people[0].nightRole).toBe('guard');expect(saved.state.people[0].zone).toBe('gate');expect(saved.state.fearRetreats).toBeUndefined();expect(saved.state.fearCooldowns).toBeUndefined();expect(saved.state.people[0].task).toBeUndefined();
 expect(saved.state.report.events.some(e=>e.includes('镇定结束'))).toBe(true);
 const replay=await page.request.post('/api/campaign/night-result',{data:payload});expect(replay.status()).toBe(200);expect((await replay.json()).revision).toBe(saved.revision);
});
