import {test,expect} from '@playwright/test';
import {initialCampaign,applyCampaignAction} from '../src/campaign.js';
import {createBattle,stepBattle,battleCommand,inner} from '../src/battle.js';
import {BOSSES} from '../src/boss-content.js';
import {ZONES,ENEMIES} from '../src/content.js';
import {leaveHouse} from '../src/shelter.js';
const diag=page=>page.locator('canvas').evaluate(c=>c.getYardDiagnostics());
function base(day){let s=applyCampaignAction(initialCampaign(53),{type:'chooseRole',role:'repairman'});s.day=day;s.resources.materials=100;s.zones.forEach(z=>z.hp=100);s.people[0].nightRole='sleep';s.flags.seenTypes=Object.keys(ENEMIES);return applyCampaignAction(s,{type:'prepare'});}
function simulate(b,seconds){for(let i=0;i<Math.ceil(seconds*20)&&!b.finished;i++)stepBattle(b);}
async function scenario(page,day){
 const s=base(day),b=createBattle(s,'boss-ui-'+day,{autoPause:false});b.schedule=[{at:.05,type:BOSSES[day].id,zone:b.boss.zone,challenge:true}];b.paused=false;stepBattle(b);Object.assign(b.enemies[0],{mode:'attack',x:ZONES.find(z=>z.id===b.boss.zone).x,y:ZONES.find(z=>z.id===b.boss.zone).y});stepBattle(b);b.paused=true;
 const publish=()=>page.evaluate(b=>window.__bossWorker.dispatchEvent(new MessageEvent('message',{data:{type:'state',battle:b,result:null,steps:0}})),b);
 await page.exposeFunction('__bossMessage',async m=>{if(m.type==='command')battleCommand(b,m.action);if(m.type!=='dispose')await publish();});
 await page.addInitScript(()=>{const Original=window.Worker;window.Worker=class extends EventTarget{constructor(url,options){super();if(!String(url).includes('night-worker'))return new Original(url,options);window.__bossWorker=this;queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:{type:'ready'}})));}postMessage(m){window.__bossMessage(m);}terminate(){}};});
 await page.route('**/api/campaign',route=>route.fulfill({json:{runId:'boss-ui-'+day,revision:1,state:s}}));await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');
 await page.locator('[data-action=start-night]').click();await expect(page.getByTestId('boss-status')).toContainText(BOSSES[day].name);await expect.poll(async()=>(await diag(page)).tokens.some(t=>t.texture==='boss-'+BOSSES[day].id)).toBe(true);return {s,b,publish};
}

for(const width of [320,390])test(`boss preview ${width}: four original creatures, independent rules, readable mechanics`,async({page})=>{
 await page.setViewportSize({width,height:width===320?568:844});let state=base(7);state.phase='day';await page.route('**/api/campaign',route=>route.fulfill({json:{state,runId:'preview',revision:1}}));
 for(const day of [7,14,21,28]){state=base(day);state.phase='day';await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await page.getByRole('button',{name:'打开游戏菜单'}).click();await page.locator('#sheet-body [data-panel=radio]').click();const card=page.getByTestId('boss-preview');await expect(card).toContainText(BOSSES[day].name);await expect(card).toContainText(BOSSES[day].mechanism);await expect(card.locator('svg')).toHaveAttribute('aria-label',BOSSES[day].name+'的独立生物外观');await expect(card).toContainText('应对');expect(await page.locator('#sheet-body').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);if(day===28)await page.screenshot({path:`.local/boss-design/screens/preview-${width}.png`,fullPage:true});}
});

for(const day of [7,14,21,28])test(`boss ${day}: new artwork and real mechanism feedback survive pause`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));if(day===14)await page.setViewportSize({width:320,height:568});const {b,publish}=await scenario(page,day);const status=page.getByTestId('boss-status');
 if(day===7){await expect(status).toContainText('棘冠蓄撞');const p=b.people[0];leaveHouse(b,p);Object.assign(p,inner(ZONES[0]),{nightRole:'guard'});battleCommand(b,{type:'brace',person:p.id,target:'gate'});b.paused=false;b.boss.clock=4.99;stepBattle(b);b.paused=true;await publish();await expect(status).toContainText('弱点暴露');expect(b.events.some(e=>e.text.includes('顶住成功'))).toBe(true);}
 if(day===14){const layout=await page.locator('.shell').evaluate(el=>({world:el.querySelector('#world').getBoundingClientRect().height,navBottom:el.querySelector('#nav').getBoundingClientRect().bottom,height:innerHeight}));expect(layout.world).toBeGreaterThanOrEqual(155);expect(layout.navBottom).toBeLessThanOrEqual(layout.height);await expect(status).toContainText('后左栏鼓包');await expect.poll(async()=>(await diag(page)).feedback.boss.mounds.length).toBe(1);b.zones[3].mesh=true;b.paused=false;stepBattle(b);b.paused=true;await publish();expect(b.boss.sealed).toBe(1);await expect(status).toContainText(`${BOSSES[14].hp-16} / ${BOSSES[14].hp}`);await expect.poll(async()=>(await diag(page)).feedback.effects.some(e=>e.text.includes('封巢成功'))).toBe(true);}
 if(day===21){await expect(status).toContainText('吸焰蓄能');const p=b.people[0];leaveHouse(b,p);Object.assign(p,{x:240,y:390,nightRole:'guard'});battleCommand(b,{type:'extinguish',person:p.id,target:'central'});b.paused=false;simulate(b,4.5);b.paused=true;await publish();await expect(status).toContainText('弱点暴露');expect(b.fires[0].heat).toBe(0);}
 if(day===28){await expect(status).toContainText('450 / 450');b.enemies[0].hp=225;b.paused=false;stepBattle(b);b.paused=true;await publish();await expect(status).toContainText('分裂3体');await expect.poll(async()=>(await diag(page)).tokens.filter(t=>t.texture==='boss-twinvein').length).toBe(3);expect((await diag(page)).tokens.filter(t=>t.texture==='boss-twinvein').map(t=>t.label).sort()).toEqual(['紫脉','金脉','青脉'].sort());await expect.poll(async()=>(await diag(page)).feedback.boss.links.length).toBe(3);await expect(status).toContainText('324 / 324');b.enemies[0].hp=0;b.paused=false;stepBattle(b);b.paused=true;await publish();await expect(status).toContainText('同灭还剩 12.0秒');}
 const frozen=await status.innerText();await page.waitForTimeout(400);expect(await status.innerText()).toBe(frozen);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`.local/boss-design/screens/fight-${day}.png`,fullPage:true});expect(errors).toEqual([]);
});

test('real offline Worker spawns the new seventh-night boss and advances its charge without night API calls',async({page,context})=>{
 const s=base(7),posts=[];s.people[0].nightRole='sleep';await page.route('**/api/campaign',route=>route.fulfill({json:{runId:'real-boss-worker',revision:1,state:s}}));page.on('request',r=>{if(r.url().includes('/api/')&&r.method()!=='GET')posts.push(r.url());});await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await page.locator('[data-action=start-night]').click();await page.locator('[data-action=more-night]').click();await page.locator('[data-group=orders][data-value=support]').click();await page.locator('[data-action=auto-pause]').click();await page.locator('[data-action=close-overlay]').click();await context.setOffline(true);await page.locator('[data-action=pause]').click();await expect.poll(async()=>page.locator('#world').evaluate(el=>el.getNightSnapshot()?.boss?.phase),{timeout:45000}).toBe('charge');await expect(page.getByTestId('boss-status')).toContainText('棘冠蓄撞');await expect.poll(async()=>(await diag(page)).tokens.some(t=>t.texture==='boss-bastion')).toBe(true);expect(posts).toEqual([]);await page.locator('[data-action=pause]').click();await expect.poll(()=>page.locator('#world').evaluate(el=>el.getNightSnapshot().paused)).toBe(true);const frozen=await page.locator('#world').evaluate(el=>el.getNightSnapshot().boss);await page.waitForTimeout(350);expect(await page.locator('#world').evaluate(el=>el.getNightSnapshot().boss)).toEqual(frozen);
});

for(const width of [320,390])test(`bastion ${width}: stays outside the gate, rolls belly-up, recovers and freezes its pose`,async({page})=>{
 await page.setViewportSize({width,height:width===320?568:844});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const {b,publish}=await scenario(page,7),enemy=b.enemies.find(e=>e.boss);
 const current=async()=>(await diag(page)).tokens.find(t=>t.id==='e-'+enemy.id);
 const initial=await current();expect(initial.bodyBounds.top).toBeGreaterThan(468);
 // Snapshot changes use actual simulation counters, rather than a detached CSS animation.
 b.paused=false;simulate(b,1);b.paused=true;await publish();await expect.poll(async()=>(await current()).bossVisual.phase).toBe('charge');
 const charging=await current();expect(charging.scaleY).not.toBe(initial.scaleY);
 b.paused=false;b.boss.clock=4.99;stepBattle(b);simulate(b,.8);b.paused=true;await publish();
 await expect.poll(async()=>(await current()).bossVisual.roll).toBe(1);
 const flipped=await current();expect(Math.abs(Math.abs(flipped.angle)-180)).toBeLessThan(3);expect(flipped.bodyBounds.top).toBeGreaterThan(468);
 expect(flipped.bodyBounds.top+flipped.bodyBounds.height).toBeLessThan(605);
 expect((await diag(page)).feedback.boss.visuals[0].weakPoint).not.toBeNull();
 await page.screenshot({path:`.local/boss-upgrade/bastion-belly-${width}.png`,fullPage:true});
 await page.waitForTimeout(350);const frozen=await current();for(const key of ['angle','spriteX','spriteY','scaleX','scaleY'])expect(frozen[key]).toBe(flipped[key]);
 b.paused=false;simulate(b,8);b.paused=true;await publish();await expect.poll(async()=>(await current()).bossVisual.roll).toBe(0);expect(Math.abs((await current()).angle)).toBeLessThan(8);
 await page.screenshot({path:`.local/boss-upgrade/bastion-recovered-${width}.png`,fullPage:true});expect(errors).toEqual([]);
});

test('reduced motion keeps the boss clearly overturned without shaking or losing its weak point',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});const {b,publish}=await scenario(page,7);
 b.paused=false;b.boss.clock=4.99;stepBattle(b);simulate(b,.8);b.paused=true;await publish();
 await expect.poll(async()=>Math.abs((await diag(page)).tokens.find(t=>t.texture==='boss-bastion').angle)).toBe(180);
 expect((await diag(page)).feedback.boss.visuals[0].weakPoint).not.toBeNull();
});

for(const day of [14,21,28])test(`boss ${day}: a stationary body breathes and performs its own stage animation`,async({page})=>{
 const {b,publish}=await scenario(page,day),id=b.enemies.find(e=>e.boss).id;
 const pose=async()=>(await diag(page)).tokens.find(t=>t.id==='e-'+id).bossVisual;
 const before=await pose();b.paused=false;simulate(b,.65);b.paused=true;await publish();
 await expect.poll(async()=>JSON.stringify(await pose())).not.toBe(JSON.stringify(before));
 const after=await pose();expect(Number.isFinite(after.cx)&&Number.isFinite(after.cy)).toBe(true);
 await page.waitForTimeout(200);expect(await pose()).toEqual(after);
 await page.screenshot({path:`.local/boss-upgrade/animated-${day}.png`,fullPage:true});
});
