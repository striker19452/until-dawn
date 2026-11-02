import {test,expect} from '@playwright/test';
import {initialCampaign,applyCampaignAction} from '../src/campaign.js';
import {createBattle,stepBattle,battleCommand} from '../src/battle.js';
import {mkdirSync} from 'node:fs';
const evidence='.local/validation/building-damage';
const diagnostics=page=>page.locator('canvas').evaluate(c=>c.getYardDiagnostics());
function fixture(){
 let s=applyCampaignAction(initialCampaign(53),{type:'chooseRole',role:'repairman'});s.people[0].nightRole='sleep';s.flags.centralFire=false;s.resources.materials=20;
 s.buildings=['garden','water','watchtower'].map((type,i)=>({id:'b'+i,type,level:1,branch:'normal',age:0,enabled:true,hp:10}));
 return s;
}
test('actual breach walks to a random facility, shows damage and ruins, retargets and freezes on pause',async({page})=>{
 mkdirSync(evidence,{recursive:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));const s=applyCampaignAction(fixture(),{type:'prepare'}),b=createBattle(s,'building-ui',{autoPause:false});b.challenge=null;b.schedule=[{at:9999,type:'walker',zone:'gate'}];b.zones[0].hp=0;b.rng=300;b.paused=false;
 b.enemies=[{id:'intruder',type:'walker',zone:'gate',x:240,y:468,hp:100,max:100,mode:'attack',attack:0,progress:0,stun:0}];stepBattle(b);expect(b.enemies[0].targetId).toBe('b0');
 for(let n=0;n<2000&&b.buildings[0].hp>5;n++)stepBattle(b);expect(b.buildings[0].hp).toBeLessThanOrEqual(5);b.paused=true;
 const publish=()=>page.evaluate(b=>window.__buildingWorker.dispatchEvent(new MessageEvent('message',{data:{type:'state',battle:b,result:null,steps:0}})),b);
 await page.exposeFunction('__buildingMessage',async m=>{if(m.type==='command')battleCommand(b,m.action);if(m.type!=='dispose')await publish();});
 await page.addInitScript(()=>{const Worker=window.Worker;window.Worker=class extends EventTarget{constructor(url,options){super();if(!String(url).includes('night-worker'))return new Worker(url,options);window.__buildingWorker=this;queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:{type:'ready'}})));}postMessage(m){window.__buildingMessage(m);}terminate(){}};});
 await page.route('**/api/campaign',route=>route.fulfill({json:{state:s,runId:'building-ui',revision:1}}));await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await page.locator('[data-action=start-night]').click();
 await expect.poll(async()=>(await diagnostics(page)).components.find(c=>c.id==='building-b0')?.state).toBe('damaged');const damaged=(await diagnostics(page)).components.find(c=>c.id==='building-b0');expect(damaged.hp).toBeCloseTo(b.buildings[0].hp);expect(damaged.occludes).toBe(true);expect((await diagnostics(page)).feedback.enemies[0].label).toContain('菜畦');await page.screenshot({path:`${evidence}/facility-damaged.png`,fullPage:true});
 const frozen=await diagnostics(page);await page.waitForTimeout(250);expect((await diagnostics(page)).components).toEqual(frozen.components);expect((await diagnostics(page)).feedback).toEqual(frozen.feedback);
 b.paused=false;while(b.buildings[0].hp>0)stepBattle(b);b.paused=true;await publish();await expect.poll(async()=>(await diagnostics(page)).components.find(c=>c.id==='building-b0')?.state).toBe('destroyed');const ruin=(await diagnostics(page)).components.find(c=>c.id==='building-b0');expect(ruin.hp).toBe(0);expect(ruin.occludes).toBe(false);expect((await diagnostics(page)).feedback.effects.some(e=>e.type==='destroyed'&&e.text.includes('菜畦'))).toBe(true);await page.screenshot({path:`${evidence}/facility-destroyed.png`,fullPage:true});
 b.paused=false;stepBattle(b);b.paused=true;expect(b.enemies[0].targetId).not.toBe('b0');await publish();await expect.poll(async()=>(await diagnostics(page)).feedback.enemies[0].label).not.toContain('菜畦');expect(errors).toEqual([]);
});

test('day UI exposes 10 durability, repairs surviving facilities with displayed cost and retains upgrades on a narrow phone',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));let s=fixture(),revision=1;Object.assign(s.buildings[0],{hp:4,level:2,branch:'steady'});const before=structuredClone(s);
 await page.route('**/api/campaign',route=>route.fulfill({json:{state:s,runId:'building-day',revision}}));
 await page.route('**/api/campaign/action',async route=>{const request=route.request().postDataJSON();expect(request.action.type).toBe('repairBuilding');s=applyCampaignAction(s,request.action);await route.fulfill({json:{state:s,runId:'building-day',revision:++revision}});});
 await page.setViewportSize({width:320,height:568});await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await page.locator('[data-action=drawer][data-panel=build]').click();await expect(page.getByTestId('building-health')).toContainText('4/10');await expect(page.getByTestId('building-card')).toContainText('受损，仍可使用');await expect(page.locator('[data-action=repair-building]')).toContainText('1行动2建材');await page.screenshot({path:`${evidence}/repair-before-320.png`,fullPage:true});
 await page.locator('[data-action=repair-building]').click();await expect(page.getByTestId('building-health')).toContainText('10/10');await expect(page.getByTestId('building-card')).toContainText('耐候');expect(s.ap).toBe(before.ap-1);expect(s.resources.materials).toBe(before.resources.materials-2);await page.locator('[data-action=close-overlay]').click();await expect.poll(async()=>(await diagnostics(page)).components.find(c=>c.id==='building-b0')?.state).toBe('intact');await page.screenshot({path:`${evidence}/facility-repaired-320.png`,fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
