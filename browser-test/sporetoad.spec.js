import {test,expect} from '@playwright/test';
import {createTestSession} from '../src/test-mode.js';
import {createBattle,stepBattle,battleCommand} from '../src/battle.js';
import {leaveHouse} from '../src/shelter.js';
import {worldPoint} from '../src/yard-geometry.js';
const diagnostics=page=>page.locator('canvas').evaluate(c=>c.getYardDiagnostics());
async function mount(page){
 const state=createTestSession({day:22}).snapshot.state;state.people.forEach(p=>p.nightRole='sleep');
 const b=createBattle(state,'spore-ui',{autoPause:false});Object.assign(b,{paused:false,boss:null,challenge:null,elapsed:5,fires:[],schedule:[{at:9999,type:'walker',zone:'gate'}]});
 const p=b.people[0];leaveHouse(b,p);const at=worldPoint({x:205,y:395});Object.assign(p,at,{nightRole:'guard',cooldown:100,stamina:80,fear:20,task:{type:'move',target:at,stage:'work',progress:0,reserved:{}}});
 const e={id:'toad',type:'sporetoad',zone:'gate',...worldPoint({x:305,y:395}),hp:1000,max:1000,mode:'inside',progress:4.95,attack:0,stun:0};b.enemies=[e];stepBattle(b,.05);b.paused=true;
 const publish=()=>page.evaluate(b=>window.__sporeWorker.dispatchEvent(new MessageEvent('message',{data:{type:'state',battle:b,result:null,steps:0}})),b);
 await page.exposeFunction('__sporeMessage',async m=>{if(m.type==='command')battleCommand(b,m.action);if(m.type!=='dispose')await publish();});
 await page.addInitScript(()=>{const Native=window.Worker;window.Worker=class extends EventTarget{constructor(url,options){super();if(!String(url).includes('night-worker'))return new Native(url,options);window.__sporeWorker=this;queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:{type:'ready'}})));}postMessage(m){window.__sporeMessage(m);}terminate(){}};});
 await page.route('**/api/campaign/export',r=>r.fulfill({json:{state,dawn:state,runId:'spore-ui',revision:1}}));
 await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true',{timeout:20000});await page.locator('[data-action=start-night]').click();
 await expect.poll(()=>page.locator('#world').evaluate(el=>el.getNightSnapshot?.()?.id)).toBe('spore-ui');await publish();
 await expect.poll(()=>diagnostics(page).then(d=>d.feedback.sporeHits.length)).toBe(1);return {b,publish};
}
for(const [width,height,reduced]of [[1280,900,false],[390,844,false],[320,568,true]])test(`inside spore hits show real stamina/fear loss without health damage at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height});if(reduced)await page.emulateMedia({reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));const {b,publish}=await mount(page);
 const burst=b.events.find(e=>e.type==='spores');expect(burst.targets).toHaveLength(1);expect(burst.targets[0].staminaLoss).toBe(18);expect(burst.targets[0].fearGain).toBe(6);expect(b.people[0].health).toBe(100);expect(b.people[0].stamina).toBeLessThan(63);
 const d=await diagnostics(page);expect(d.feedback.sporeHits[0].text).toBe('体力 −18\n恐惧 +6');expect(d.feedback.effects.some(e=>e.visual==='spore-cloud')).toBe(true);expect(d.tokens.find(o=>o.id==='e-toad').label).toContain('院内蓄雾');
 await expect(page.locator('[data-action=crew-health][data-person=hero]')).toHaveAttribute('aria-label',/健康100\/100.*体力63\//);
 await page.screenshot({path:`.local/sporetoad-hit-${width}.png`});await page.waitForTimeout(150);expect((await diagnostics(page)).feedback.sporeHits).toEqual(d.feedback.sporeHits);
 // The next inside pulse must actually settle again, after the first labels expire.
 b.elapsed+=2;await publish();await expect.poll(()=>diagnostics(page).then(d=>d.feedback.sporeHits.length)).toBe(0);
 b.enemies[0].progress=4.95;b.paused=false;stepBattle(b,.05);b.paused=true;await publish();await expect.poll(()=>diagnostics(page).then(d=>d.feedback.sporeHits.length)).toBe(1);
 expect(b.events.filter(e=>e.type==='spores')).toHaveLength(2);expect(b.people[0].health).toBe(100);expect(b.people[0].stamina).toBeLessThan(45);expect(errors).toEqual([]);
});
