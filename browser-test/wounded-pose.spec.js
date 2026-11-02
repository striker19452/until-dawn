import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {initialCampaign,applyCampaignAction as act,makePerson} from '../src/campaign.js';
import {createBattle,stepBattle,battleCommand} from '../src/battle.js';
import {worldPoint} from '../client/scene-layout.js';
import {openTab} from './support/ui.js';
const evidence='.local/wounded-pose';mkdirSync(evidence,{recursive:true});
const d=page=>page.locator('canvas').evaluate(c=>c.getYardDiagnostics()),unit=(page,id='hero')=>d(page).then(s=>s.tokens.find(t=>t.id==='p-'+id));
const hurt=p=>Object.assign(p,{health:18,wound:'severe',deadline:2});
function day(){const s=act(initialCampaign(53),{type:'chooseRole',role:'repairman'});s.resources.medicine=10;return s;}
async function clickArt(page,p){const s=await d(page),box=await page.locator('canvas').boundingBox();await page.mouse.click(box.x+box.width/2+(p.x-240)*s.metrics.cssScale,box.y+box.height/2+(p.y-s.metrics.centerY)*s.metrics.cssScale);}
async function night(page,configure=()=>{}){const state=act(day(),{type:'prepare'}),b=createBattle(state,'injury-art',{autoPause:false});b.schedule=[{at:9999,type:'walker',zone:'gate'}];b.challenge=null;b.fires=[];Object.assign(b.people[0],{x:380,y:400});configure(b);
 const publish=()=>page.evaluate(b=>window.__poseWorker.dispatchEvent(new MessageEvent('message',{data:{type:'state',battle:b,result:null,steps:0}})),b);
 await page.exposeFunction('__poseMessage',async m=>{if(m.type==='command')battleCommand(b,m.action);if(m.type!=='dispose')await publish();});
 await page.addInitScript(()=>{const Native=window.Worker;window.Worker=class extends EventTarget{constructor(url,options){super();if(!String(url).includes('night-worker'))return new Native(url,options);window.__poseWorker=this;queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:{type:'ready'}})));}postMessage(m){window.__poseMessage(m);}terminate(){}};});
 await page.route('**/api/campaign',r=>r.fulfill({json:{state,runId:'pose-fixture',revision:1}}));await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await page.locator('[data-action=start-night]').click();await expect.poll(()=>unit(page).then(p=>p?.texture)).toBe(b.people[0].wound==='severe'?'people-wounded':'people-a');return {b,publish};}

for(const width of [320,1280])test(`severe injury sits on the ground, remains selectable and returns to standing after treatment at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:width===320?568:900});const errors=[];page.on('pageerror',e=>errors.push(e.message));let state=day(),revision=1;hurt(state.people[0]);
 await page.route('**/api/campaign',r=>r.fulfill({json:{state,runId:'seated-day',revision}}));await page.route('**/api/campaign/action',r=>{state=act(state,r.request().postDataJSON().action);return r.fulfill({json:{state,runId:'seated-day',revision:++revision}});});
 await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await expect.poll(()=>unit(page).then(p=>p?.pose)).toBe('seated');const seated=await unit(page);expect(seated.texture).toBe('people-wounded');expect(seated.frame).toBe('0');expect(seated.label).toContain('重伤');expect(seated.bodyBounds.height).toBeLessThan(55);
 await clickArt(page,{x:seated.bodyBounds.left+seated.bodyBounds.width/2,y:seated.bodyBounds.top+seated.bodyBounds.height*.4});await expect.poll(()=>unit(page).then(p=>p?.highlighted)).toBe(true);await page.screenshot({path:`${evidence}/seated-${width}.png`,fullPage:true});
 await openTab(page,'members');await page.locator('[data-action=treat]').first().click();await page.locator('[data-action=close-overlay]').click();await expect.poll(()=>unit(page).then(p=>p?.texture)).toBe('people-a');const standing=await unit(page);expect(standing.wounded).toBe(false);expect(standing.label).not.toContain('重伤');expect(standing.bodyBounds.height).toBeGreaterThan(seated.bodyBounds.height*1.3);expect(standing.x).toBeCloseTo(seated.x,3);expect(standing.y).toBeCloseTo(seated.y,3);expect(errors).toEqual([]);
});

test('every survivor including Meng and the visitor uses their own seated and crawling frames',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));const ids=['hero','lin','zhou','chen','xu','yuan','meng','visitor'];
 const {b,publish}=await night(page,b=>{b.people=ids.map((id,i)=>Object.assign(hurt(makePerson(id,id,'幸存者','survival')),{x:110+i%3*115,y:370+Math.floor(i/3)*65}));});
 for(const [i,id]of ids.entries()){await expect.poll(()=>unit(page,id).then(p=>p?.frame)).toBe(String(i*2));expect((await unit(page,id)).pose).toBe('seated');}
 const seated=await Promise.all(ids.map(id=>unit(page,id)));await page.screenshot({path:`${evidence}/all-seated.png`,fullPage:true});
 b.elapsed=2;b.paused=false;for(const p of b.people)p.x+=20;await publish();
 for(const [i,id]of ids.entries()){await expect.poll(()=>unit(page,id).then(p=>p?.frame)).toBe(String(i*2+1));const crawling=await unit(page,id);expect(crawling.pose).toBe('crawl');expect(crawling.bodyBounds.height).toBeLessThan(seated[i].bodyBounds.height);}
 await page.screenshot({path:`${evidence}/all-crawling.png`,fullPage:true});expect(errors).toEqual([]);
});

test('actual attack triggers the seated pose, retreat crawls, pause freezes and reaching the house hides the body',async({page})=>{
 await page.setViewportSize({width:1280,height:900});const errors=[];page.on('pageerror',e=>errors.push(e.message));const {b,publish}=await night(page);const p=b.people[0];p.health=20.01;b.enemies=[{id:'hurt',type:'walker',zone:'right',x:p.x,y:p.y,hp:100,max:100,mode:'inside',attack:0,progress:0,stun:0}];b.paused=false;stepBattle(b,.1);b.paused=true;await publish();await expect.poll(()=>unit(page).then(p=>p?.pose)).toBe('seated');expect(p.wound).toBe('severe');await page.screenshot({path:`${evidence}/attack-seated.png`,fullPage:true});
 b.enemies=[];b.paused=false;for(let i=0;i<10;i++)stepBattle(b,.1);await publish();await expect.poll(()=>unit(page).then(p=>p?.pose)).toBe('crawl');writeFileSync(`${evidence}/retreat-diagnostics.json`,JSON.stringify(await d(page),null,2));await page.screenshot({path:`${evidence}/retreat-night.png`,fullPage:true});b.paused=true;await publish();await page.waitForTimeout(150);const frozen=await unit(page);await page.waitForTimeout(300);expect(await unit(page)).toEqual(frozen);
 b.paused=false;for(let i=0;i<160;i++)stepBattle(b,.1);await publish();await expect.poll(()=>unit(page)).toBeUndefined();expect((await d(page)).shelter.people).toContain('hero');expect(p.dead).toBe(false);expect(errors).toEqual([]);
});

test('seated partial occlusion uses the seated silhouette and death removes the whole unit',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));const {b,publish}=await night(page,b=>{hurt(b.people[0]);Object.assign(b.people[0],worldPoint({x:135,y:235}));}),p=b.people[0];await expect.poll(()=>unit(page).then(p=>p?.occluded)).toBe(true);let seated=await unit(page);expect(seated.pose).toBe('seated');expect(seated.occlusion.exposed).toBeGreaterThan(0);expect(seated.occlusion.hidden).toBeGreaterThan(0);expect(seated.occlusion.ghostOutsideMask).toBe(0);
 await clickArt(page,{x:seated.bodyBounds.left+seated.bodyBounds.width*.4,y:seated.bodyBounds.top+seated.bodyBounds.height*.4});await expect.poll(()=>unit(page).then(p=>p?.highlighted)).toBe(true);await page.screenshot({path:`${evidence}/seated-occluded.png`,fullPage:true});p.dead=true;p.health=0;await publish();await expect.poll(()=>unit(page)).toBeUndefined();expect(errors).toEqual([]);
});
