import {test,expect} from '@playwright/test';
import {initialCampaign,applyCampaignAction} from '../src/campaign.js';
import {createBattle,stepBattle,battleCommand} from '../src/battle.js';
import {ENEMIES,ZONES} from '../src/content.js';

const diagnostics=page=>page.locator('canvas').evaluate(c=>c.getYardDiagnostics());
function prepared(){let s=applyCampaignAction(initialCampaign(53),{type:'chooseRole',role:'repairman'});s.day=28;for(const z of s.zones)Object.assign(z,{hp:100,spikes:true,mesh:true,bell:true,traps:3});return applyCampaignAction(s,{type:'prepare'});}
function enemy(type,zone,extra={}){const p=ZONES.find(z=>z.id===zone);return {id:type,type,zone,x:p.x,y:p.y,hp:ENEMIES[type].hp,max:ENEMIES[type].hp,mode:'attack',stun:0,attack:0,progress:0,called:false,...extra};}
async function night(page,s,b){
 const publish=()=>page.evaluate(b=>window.__defenseWorker.dispatchEvent(new MessageEvent('message',{data:{type:'state',battle:b,result:null,steps:0}})),b);
 await page.exposeFunction('__defenseMessage',async m=>{if(m.type==='command')battleCommand(b,m.action);if(m.type!=='dispose')await publish();});
 await page.addInitScript(()=>{const Worker=window.Worker;window.Worker=class extends EventTarget{constructor(url,options){super();if(!String(url).includes('night-worker'))return new Worker(url,options);window.__defenseWorker=this;queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:{type:'ready'}})));}postMessage(m){window.__defenseMessage(m);}terminate(){}};});
 await page.route('**/api/campaign',route=>route.fulfill({json:{state:s,runId:'defense-art-v7',revision:1}}));await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await page.locator('[data-action=start-night]').click();await expect.poll(async()=>(await diagnostics(page)).components.find(c=>c.id==='house')?.frame).toBe(1);return publish;
}
function triggered(s){
 const b=createBattle(s,'defense-trigger',{autoPause:false});b.challenge=null;b.fires=[];b.schedule=[{at:.05,type:'walker',zone:'backRight'}];b.people[0].nightRole='sleep';b.people[0].x=240;b.people[0].y=350;b.paused=false;
 b.zones.find(z=>z.id==='right').traps=2;b.enemies=[enemy('climber','gate'),enemy('burrower','left'),enemy('rammer','right',{attack:8})];stepBattle(b);b.paused=true;b.elapsed+=.18;return b;
}

test('day defenses are distinct, follow side walls and retain each remaining trap position',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));const state=prepared();state.phase='day';
 await page.route('**/api/campaign',route=>route.fulfill({json:{state,runId:'defense-day-v7',revision:1}}));await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');
 const d=await diagnostics(page);for(const kind of ['spikes','mesh','bell'])expect(d.components.filter(c=>c.kind===kind&&c.visual==='v7')).toHaveLength(5);expect(d.components.filter(c=>c.kind==='trap')).toHaveLength(15);
 for(const kind of ['spikes','mesh','bell','trap']){expect(d.components.find(c=>c.kind===kind&&c.zone==='left').along).toEqual({x:.2,y:-1});expect(d.components.find(c=>c.kind===kind&&c.zone==='right').along).toEqual({x:.2,y:1});}
 await page.screenshot({path:'test-results/defenses-day-390.png',fullPage:true});const first=d.components.find(c=>c.id==='trap-gate-0');state.zones[0].traps=2;await page.reload();await expect(page.locator('#world')).toHaveAttribute('data-ready','true');
 const reduced=(await diagnostics(page)).components;expect(reduced.some(c=>c.id==='trap-gate-2')).toBe(false);const remaining=reduced.find(c=>c.id===first.id);expect({x:remaining.x,y:remaining.y}).toEqual({x:first.x,y:first.y});
 await page.setViewportSize({width:320,height:568});await page.screenshot({path:'test-results/defenses-day-320.png',fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});

for(const reduced of [false,true])test(`actual defenses trigger distinct physical feedback, expire and freeze${reduced?' with reduced motion':''}`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));if(reduced){await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:320,height:568});}
 const s=prepared(),b=triggered(s),publish=await night(page,s,b);
 let d=await diagnostics(page);expect(d.components.find(c=>c.id==='mesh-left').active).toBe(true);expect(d.components.find(c=>c.id==='spikes-gate').active).toBe(true);const bell=d.components.find(c=>c.id==='bell-backRight');expect(bell.active).toBe(true);if(reduced)expect(bell.bellAngle).toBe(0);else expect(Math.abs(bell.bellAngle)).toBeGreaterThan(1);
 for(const visual of ['snare-tighten','mesh-catch','spike-scrape','spike-block','bell-rings'])expect(d.feedback.effects.some(e=>e.visual===visual),visual).toBe(true);
 expect(d.components.filter(c=>c.kind==='trap'&&c.zone==='right')).toHaveLength(1);const frozen=await diagnostics(page);await page.waitForTimeout(250);expect((await diagnostics(page)).components).toEqual(frozen.components);expect((await diagnostics(page)).feedback).toEqual(frozen.feedback);
 await page.screenshot({path:`test-results/defenses-trigger-${reduced?'reduced-320':'390'}.png`,fullPage:true});b.elapsed+=.12;await publish();await expect.poll(async()=>(await diagnostics(page)).components.find(c=>c.id==='bell-backRight').phase).not.toBe(bell.phase);
 if(reduced)expect((await diagnostics(page)).components.find(c=>c.id==='bell-backRight').bellAngle).toBe(0);
 b.elapsed+=5;await publish();await expect.poll(async()=>(await diagnostics(page)).components.filter(c=>c.visual==='v7'&&c.active).length).toBe(0);expect((await diagnostics(page)).components.find(c=>c.id==='bell-backRight').bellAngle).toBe(0);expect(errors).toEqual([]);
});
