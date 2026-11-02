import {test,expect} from '@playwright/test';
import {initialCampaign,applyCampaignAction} from '../src/campaign.js';
import {createBattle,stepBattle,battleCommand} from '../src/battle.js';
import {HOUSE_DOOR,enterHouse} from '../src/shelter.js';
import {mkdirSync} from 'node:fs';
import {openTab} from './support/ui.js';

const evidence='.local/house-hud';
function fixture(house){const s=applyCampaignAction(initialCampaign(53),{type:'chooseRole',role:'repairman'});s.house=house;s.people[0].nightRole='sleep';s.flags.centralFire=false;return s;}
const displayed=hp=>String(Math.ceil(hp*10)/10);

test('house durability stays on the roof across phone, desktop and landscape, and follows day repairs',async({page})=>{
 mkdirSync(evidence,{recursive:true});let s=fixture(64.25),revision=1;const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/campaign',route=>route.fulfill({json:{state:s,runId:'house-day',revision}}));
 await page.route('**/api/campaign/action',async route=>{const {action}=route.request().postDataJSON();expect(action.type).toBe('houseRepair');s=applyCampaignAction(s,action);await route.fulfill({json:{state:s,runId:'house-day',revision:++revision}});});
 await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');
 const hud=page.locator('#house-hud');await expect(hud).toBeVisible();await expect(hud).toHaveAttribute('data-state','damaged');await expect(page.locator('#house-hud-value')).toHaveText('64.3');
 for(const viewport of [{width:320,height:568},{width:390,height:844},{width:1280,height:900},{width:844,height:390}]){
  await page.setViewportSize(viewport);
  await expect.poll(()=>page.locator('#world').evaluate(world=>{const hud=world.querySelector('#house-hud').getBoundingClientRect(),rect=world.getBoundingClientRect(),m=world.querySelector('canvas').getYardDiagnostics().metrics;return Math.abs(hud.x+hud.width/2-rect.x-m.width/2)<2&&Math.abs(hud.y+hud.height/2-rect.y-(m.height/2+(192-m.centerY)*m.cssScale))<2;})).toBe(true);
  const layout=await hud.evaluate(el=>{const r=el.getBoundingClientRect(),w=el.parentElement.getBoundingClientRect();return {inside:r.left>=w.left&&r.right<=w.right&&r.top>=w.top&&r.bottom<=w.bottom,pointerEvents:getComputedStyle(el).pointerEvents,overflow:document.documentElement.scrollWidth>innerWidth};});
  expect(layout).toEqual({inside:true,pointerEvents:'none',overflow:false});
  await page.screenshot({path:`${evidence}/damaged-${viewport.width}.png`,fullPage:true});
 }
 await page.setViewportSize({width:390,height:844});await openTab(page,'manage');await page.locator('[data-action=house-repair]').click();await expect(hud).toHaveAttribute('aria-valuenow','94.25');await expect(page.locator('#house-hud-value')).toHaveText('94.3');expect(s.house).toBe(94.25);
 await page.locator('[data-action=house-repair]').click();await expect(hud).toHaveAttribute('data-state','intact');await expect(page.locator('#house-hud-value')).toHaveText('100');expect(s.house).toBe(100);expect(errors).toEqual([]);
});

test('live enemy damage, night barricade and house loss update the readout',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));const s=applyCampaignAction(fixture(30.04),{type:'prepare'}),b=createBattle(s,'house-night',{autoPause:false});b.challenge=null;b.schedule=[{at:9999,type:'walker',zone:'gate'}];b.zones[0].hp=0;
 b.enemies=[{id:'intruder',type:'walker',zone:'gate',...HOUSE_DOOR,hp:100,max:100,mode:'inside',attack:0,progress:0,stun:0}];
 const publish=()=>page.evaluate(b=>window.__houseWorker.dispatchEvent(new MessageEvent('message',{data:{type:'state',battle:b,result:null,steps:0}})),b);
 await page.exposeFunction('__houseMessage',async m=>{if(m.type==='command')battleCommand(b,m.action);if(m.type!=='dispose')await publish();});
 await page.addInitScript(()=>{const Worker=window.Worker;window.Worker=class extends EventTarget{constructor(url,options){super();if(!String(url).includes('night-worker'))return new Worker(url,options);window.__houseWorker=this;queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:{type:'ready'}})));}postMessage(m){window.__houseMessage(m);}terminate(){}};});
 await page.route('**/api/campaign',route=>route.fulfill({json:{state:s,runId:'house-night',revision:1}}));await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await page.locator('[data-action=start-night]').click();
 const hud=page.locator('#house-hud');await expect(hud).toHaveAttribute('data-state','damaged');b.paused=false;stepBattle(b);b.paused=true;expect(b.house).toBeLessThan(30);await publish();await expect(hud).toHaveAttribute('data-state','critical');await expect(page.locator('#house-hud-label')).toHaveText('小屋危急');await expect(page.locator('#house-hud-value')).toHaveText(displayed(b.house));await page.screenshot({path:`${evidence}/night-critical.png`,fullPage:true});
 b.enemies=[];battleCommand(b,{type:'barricade',person:b.people[0].id});b.paused=false;for(let i=0;i<500&&b.people[0].task;i++)stepBattle(b);b.paused=true;expect(b.house).toBeGreaterThan(49);await publish();await expect(hud).toHaveAttribute('data-state','damaged');await expect(page.locator('#house-hud-value')).toHaveText(displayed(b.house));
 b.people[0].nightRole='sleep';b.sleepInterrupted={};enterHouse(b,b.people[0]);b.enemies=[{id:'destroyer',type:'walker',zone:'gate',...HOUSE_DOOR,hp:100,max:100,mode:'inside',attack:0,progress:0,stun:0}];b.paused=false;for(let i=0;i<1000&&!b.finished;i++)stepBattle(b);expect(b.house).toBe(0);expect(b.finished).toBe(true);await publish();await expect(hud).toHaveAttribute('data-state','destroyed');await expect(page.locator('#house-hud-label')).toHaveText('小屋失守');await expect(page.locator('#house-hud-value')).toHaveText('0');expect(errors).toEqual([]);
});
