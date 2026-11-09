import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {createTestSession} from '../src/test-mode.js';
import {createBattle,stepBattle,battleCommand,event,inner} from '../src/battle.js';
import {phaseCreatureDamage} from '../src/phase-creature-combat.js';
import {ENEMIES,ZONES} from '../src/content.js';
import {leaveHouse} from '../src/shelter.js';
import {installStorage,seedSave} from './support/storage.js';

const evidence='.local/phase-creature-motion';mkdirSync(evidence,{recursive:true});
const diagnostics=page=>page.locator('canvas').evaluate(c=>c.getYardDiagnostics());
const token=(page,id)=>diagnostics(page).then(d=>d.tokens.find(t=>t.id==='e-'+id));
const advance=(b,seconds)=>{b.paused=false;for(let i=0;i<Math.round(seconds*20);i++)stepBattle(b);b.paused=true;};
function enemy(type,zone,id=type){const z=ZONES.find(z=>z.id===zone);return {id,type,zone,x:z.x,y:z.y,hp:1000,max:1000,mode:'attack',progress:0,attack:0,stun:0,called:false};}
function fixture(){
 const state=createTestSession({day:22}).snapshot.state;state.flags.seenTypes=Object.keys(ENEMIES);state.people.forEach(p=>p.nightRole='sleep');
 const b=createBattle(state,'phase-motion',{autoPause:false});Object.assign(b,{boss:null,challenge:null,schedule:[{at:9999,type:'walker',zone:'gate'}]});return {state,b};
}
async function mount(page,f){
 const publish=()=>page.evaluate(b=>window.__motionWorker.dispatchEvent(new MessageEvent('message',{data:{type:'state',battle:b,result:null,steps:0}})),f.b);
 await page.exposeFunction('__motionMessage',async m=>{if(m.type==='command')battleCommand(f.b,m.action);if(m.type!=='dispose')await publish();});
 await page.addInitScript(()=>{const Native=window.Worker;window.Worker=class extends EventTarget{constructor(url,options){super();if(!String(url).includes('night-worker'))return new Native(url,options);window.__motionWorker=this;queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:{type:'ready'}})));}postMessage(m){window.__motionMessage(m);}terminate(){}};});
 await installStorage(page);await seedSave(page,{state:f.state,runId:'phase-motion',revision:1});await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await page.locator('[data-action=start-night]').click();
 await expect.poll(()=>diagnostics(page).then(d=>d.tokens.filter(t=>t.id.startsWith('e-')).length)).toBe(f.b.enemies.length);return publish;
}
for(const [width,height,reduced]of [[390,844,false],[1280,900,false],[320,568,true]])test(`bladebeast visibly clears the gate and lands at ${width}px${reduced?' in reduced motion':''}`,async({page})=>{
 await page.setViewportSize({width,height});if(reduced)await page.emulateMedia({reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const f=fixture();f.b.enemies=[enemy('bladebeast','gate')];advance(f.b,3.6);const publish=await mount(page,f);
 await expect.poll(()=>token(page,'bladebeast').then(t=>t.phaseVisual?.phase)).toBe('crouch');
 advance(f.b,.45);await publish();await expect.poll(()=>token(page,'bladebeast').then(t=>t.phaseVisual?.phase)).toBe('airborne');
 const air=await token(page,'bladebeast');expect(air.y-air.spriteY).toBeGreaterThan(reduced?5:45);expect(air.occluders).not.toContain('gate');expect(air.visible).toBe(true);expect(air.label).toContain('腾空');
 await page.locator('#world').screenshot({path:`${evidence}/leap-${width}-air.png`});await page.waitForTimeout(130);expect(await token(page,'bladebeast')).toEqual(air);
 advance(f.b,.35);await publish();await expect.poll(()=>token(page,'bladebeast').then(t=>t.phaseVisual?.phase)).toBe('land');
 advance(f.b,.1);await publish();await expect.poll(()=>diagnostics(page).then(d=>d.feedback.effects.some(e=>e.visual==='leap-landing'))).toBe(true);
 await page.locator('#world').screenshot({path:`${evidence}/leap-${width}-land.png`});expect(errors).toEqual([]);
});
for(const [width,height,reduced]of [[390,844,false],[1280,900,false],[320,844,true]])test(`armor panels, spore cloud and outer-route echoes remain readable at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height});if(reduced)await page.emulateMedia({reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const f=fixture(),crab=enemy('shellcrab','right'),toad=enemy('sporetoad','left'),echo=enemy('echomantis','backRight');f.b.enemies=[crab,toad,echo];toad.progress=4;echo.hp=500;
 const p=f.b.people[0];leaveHouse(f.b,p);Object.assign(p,{x:125,y:330,cooldown:100,task:{type:'move',target:{x:125,y:330},stage:'work',progress:0,reserved:{}}});
 const left={x:crab.x-20,y:crab.y},below={x:crab.x,y:crab.y+20};phaseCreatureDamage(f.b,crab,10,'strike',left,event);f.b.paused=true;
 const publish=await mount(page,f);await expect.poll(()=>diagnostics(page).then(d=>d.feedback.effects.some(e=>e.visual==='armor-sparks'))).toBe(true);
 phaseCreatureDamage(f.b,crab,10,'strike',below,event);advance(f.b,1.25);await publish();
 await expect.poll(()=>token(page,'shellcrab').then(t=>t.phaseVisual?.phase)).toBe('open');
 const d=await diagnostics(page);expect(d.feedback.effects.some(e=>e.type==='shell-open'&&e.panels===2)).toBe(true);expect(d.feedback.effects.some(e=>e.visual==='spore-cloud')).toBe(true);expect(d.feedback.effects.some(e=>e.type==='echo-trail'&&e.routeVisible)).toBe(true);
 const trail=d.feedback.effects.find(e=>e.type==='echo-trail');expect(trail.copies).toBe(reduced?0:3);expect(d.tokens.find(t=>t.id==='e-shellcrab').phaseBodyCrop).toBeTruthy();
 await page.locator('#world').screenshot({path:`${evidence}/creatures-${width}.png`});await page.waitForTimeout(130);expect(await diagnostics(page).then(d=>d.feedback.effects)).toEqual(d.feedback.effects);expect(errors).toEqual([]);
});
test('throwing cancels the airborne body, shows a fall and never plays a successful landing',async({page})=>{
 const f=fixture();f.b.enemies=[enemy('bladebeast','gate')];advance(f.b,4.05);const publish=await mount(page,f),p=f.b.people[0];leaveHouse(f.b,p);Object.assign(p,inner(ZONES[0]),{nightRole:'guard',cooldown:100});
 battleCommand(f.b,{type:'throw',person:p.id,target:'gate'});f.b.people[0].task.stage='work';f.b.people[0].task.progress=100;advance(f.b,.05);await publish();
 await expect.poll(()=>token(page,'bladebeast').then(t=>t.phaseVisual?.phase)).toBe('fall');expect(f.b.enemies[0].leap).toBeUndefined();expect(f.b.enemies[0].progress).toBe(0);
 expect((await diagnostics(page)).feedback.effects.some(e=>e.visual==='leap-interrupt')).toBe(true);expect((await diagnostics(page)).feedback.effects.some(e=>e.visual==='leap-landing')).toBe(false);
 await page.locator('#world').screenshot({path:`${evidence}/leap-interrupted.png`});advance(f.b,.4);await publish();await expect.poll(()=>token(page,'bladebeast').then(t=>t.phaseVisual?.phase)).toBe('stunned');
});
