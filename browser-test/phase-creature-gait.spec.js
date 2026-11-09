import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {createTestSession} from '../src/test-mode.js';
import {createBattle,stepBattle,event} from '../src/battle.js';
import {leaveHouse} from '../src/shelter.js';
import {ENEMIES} from '../src/content.js';
import {worldPoint} from '../src/yard-geometry.js';
const types=['bladebeast','shellcrab','sporetoad','echomantis'];
const diagnostic=page=>page.locator('canvas').evaluate(c=>c.getYardDiagnostics());
async function mount(page){
 const state=createTestSession({day:22}).snapshot.state;state.people.forEach(p=>p.nightRole='sleep');
 const b=createBattle(state,'creature-gait',{autoPause:false});Object.assign(b,{boss:null,challenge:null,elapsed:10,schedule:[{at:9999,type:'walker',zone:'gate'}]});
 b.enemies=types.map((type,i)=>({id:type,type,zone:'gate',...worldPoint([{x:90,y:335},{x:180,y:415},{x:300,y:335},{x:385,y:415}][i]),hp:1000,max:1000,mode:'inside',progress:0,attack:0,stun:0}));
 const publish=()=>page.evaluate(b=>window.__gaitWorker.dispatchEvent(new MessageEvent('message',{data:{type:'state',battle:b,result:null,steps:0}})),b);
 await page.exposeFunction('__gaitMessage',async m=>{if(m.type!=='dispose')await publish();});
 await page.addInitScript(()=>{const Native=window.Worker;window.Worker=class extends EventTarget{constructor(url,options){super();if(!String(url).includes('night-worker'))return new Native(url,options);window.__gaitWorker=this;queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:{type:'ready'}})));}postMessage(m){window.__gaitMessage(m);}terminate(){}};});
 await page.route('**/api/campaign/export',r=>r.fulfill({json:{state,dawn:state,runId:'creature-gait',revision:1}}));
 await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true',{timeout:20000});await page.locator('[data-action=start-night]').click();
 await expect.poll(()=>diagnostic(page).then(d=>d.tokens.filter(o=>o.phaseRig).length)).toBe(4);return {b,publish};
}
for(const [width,height,reduced]of [[1280,900,false],[390,844,false],[320,568,true]])test(`four new species articulate while moving, stop and freeze at ${width}px`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width,height});if(reduced)await page.emulateMedia({reducedMotion:'reduce'});
 const {b,publish}=await mount(page);b.paused=false;b.elapsed+=.2;b.enemies.forEach(e=>e.x+=18);await publish();
 await expect.poll(()=>diagnostic(page).then(d=>d.tokens.filter(o=>o.phaseVisual?.locomotion==='walk').length)).toBe(4);
 const frames=await page.locator('canvas').evaluate(c=>new Promise(resolve=>{const rows=[];function frame(){rows.push(c.getYardDiagnostics().tokens.filter(o=>o.phaseRig).map(o=>({id:o.id,parts:o.phaseRig,distance:o.phaseVisual.stride,mode:o.phaseVisual.locomotion})));if(rows.length<12)requestAnimationFrame(frame);else resolve(rows);}requestAnimationFrame(frame);}));
 for(const type of types){const samples=frames.map(f=>f.find(o=>o.id==='e-'+type)),angles=samples.map(s=>s.parts.find(p=>p.id==='legFront').joint.angle);expect(samples[0].parts.length).toBeGreaterThanOrEqual(3);if(!reduced)expect(new Set(angles).size).toBeGreaterThan(2);else expect(angles.every(a=>a===0)).toBe(true);}
 await page.locator('#world').screenshot({path:`.local/phase-creature-motion/gait-${width}.png`});
 b.paused=true;await publish();await expect.poll(()=>diagnostic(page).then(d=>d.paused)).toBe(true);await page.waitForTimeout(80);const frozen=(await diagnostic(page)).tokens;await page.waitForTimeout(180);expect((await diagnostic(page)).tokens).toEqual(frozen);
 b.enemies.forEach(e=>e.stun=2);await publish();await expect.poll(()=>diagnostic(page).then(d=>d.tokens.every(o=>!o.phaseVisual||o.phaseVisual.phase==='stunned'))).toBe(true);
 expect((await diagnostic(page)).tokens.filter(o=>o.phaseRig).every(o=>o.phaseRig.filter(p=>p.id.startsWith('leg')).every(p=>p.joint.dy===0))).toBe(true);
 b.enemies=[];await publish();await expect.poll(()=>diagnostic(page).then(d=>d.tokens.filter(o=>o.phaseRig).length)).toBe(0);expect(errors).toEqual([]);
});
test('actual combat contacts animate the owning creature and incoming strikes remain distinct',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));const {b,publish}=await mount(page),p=b.people[0];leaveHouse(b,p);Object.assign(p,worldPoint({x:240,y:400}),{nightRole:'guard',cooldown:100,task:{type:'move',target:worldPoint({x:240,y:400}),stage:'work',progress:0,reserved:{}}});
 b.enemies.forEach((e,i)=>Object.assign(e,{x:p.x+6+i,y:p.y}));b.paused=false;stepBattle(b,.05);b.paused=true;b.elapsed+=.12;await publish();
 await expect.poll(()=>diagnostic(page).then(d=>d.tokens.filter(o=>o.phaseVisual?.attack).length)).toBe(4);
 const d=await diagnostic(page);for(const type of types){const actor=d.tokens.find(o=>o.id==='e-'+type);expect(actor.phaseVisual.strike).toBeGreaterThan(0);expect(actor.phaseVisual.attack.targetId).toBe('hero');expect(actor.phaseVisual.hurt).toBe(0);}
 event(b,'heavy',b.enemies[0].x,b.enemies[0].y,'重击',{enemyId:'bladebeast',source:{x:p.x,y:p.y}});b.elapsed+=.1;await publish();await expect.poll(()=>diagnostic(page).then(d=>d.tokens.find(o=>o.id==='e-bladebeast').phaseVisual.hurt)).toBeGreaterThan(0);expect(errors).toEqual([]);
});
test('pixel audit covers every enemy: seven painted walk cycles, four articulated paintings and boss locomotion',async({page})=>{
 const read=name=>JSON.parse(readFileSync(new URL('../client/assets/'+name,import.meta.url))),legacy=read('creatures-walk-v4.json'),skitter=read('skitter-walk-v1.json'),phase=read('phase-creatures-v1/registration.json');
 const sheets=legacy.sheets.map(s=>({url:'/assets/'+s.file.replace('.png','.webp'),frames:s.frames.map((f,i)=>({...f,rect:[i%4*legacy.frameWidth,Math.floor(i/4)*legacy.frameHeight,legacy.frameWidth,legacy.frameHeight]}))}));sheets.push({url:'/assets/skitter-walk-v1.webp',frames:skitter.frames},{url:'/assets/phase-creatures-v1/atlas.webp',frames:phase.frames});
 await page.goto('/assets/phase-creatures-v1/registration.json');const unique=await page.evaluate(async sheets=>{const map={};for(const s of sheets){const image=await createImageBitmap(await(await fetch(s.url)).blob()),c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);for(const f of s.frames){const rgba=ctx.getImageData(...f.rect).data,bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',rgba)),hash=Array.from(bytes).join(',');map[f.species]??=[];map[f.species].push(hash);}}return Object.fromEntries(Object.entries(map).map(([id,hashes])=>[id,new Set(hashes).size]));},sheets);
 for(const id of ['walker','climber','rammer','caller','burrower','quencher','skitter'])expect(unique[id]).toBe(4);
 for(const id of types)expect(unique[id]).toBe(1);
 expect([...Object.keys(unique),'bastion','broodmother','cinderwhale','twinvein'].sort()).toEqual(Object.keys(ENEMIES).sort());
});
