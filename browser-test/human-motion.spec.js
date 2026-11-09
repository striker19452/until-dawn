import {test,expect} from '@playwright/test';
import {initialCampaign,applyCampaignAction,makePerson} from '../src/campaign.js';
import {createBattle,stepBattle,battleCommand} from '../src/battle.js';
import {worldPoint} from '../src/yard-geometry.js';
const diagnostics=page=>page.locator('canvas').evaluate(c=>c.getYardDiagnostics());
const human=(page,id='hero')=>diagnostics(page).then(d=>d.tokens.find(t=>t.id==='p-'+id));
async function fixture(page){
 const state=applyCampaignAction(applyCampaignAction(initialCampaign(53),{type:'chooseRole',role:'repairman'}),{type:'prepare'});
 const b=createBattle(state,'human-poses',{autoPause:false});b.elapsed=10;b.schedule=[{at:9999,type:'walker',zone:'gate'}];b.challenge=null;
 const ids=['hero','lin','zhou','chen','meng'];
 b.people=ids.map((id,i)=>Object.assign(makePerson(id,{hero:'你',lin:'林禾',zhou:'老周',chen:'陈岚',meng:'孟姨'}[id],'幸存者','survival'),worldPoint([{x:125,y:350},{x:190,y:425},{x:380,y:350},{x:305,y:425},{x:285,y:343}][i]),{zone:'gate',cooldown:0}));
 const tasks=['repair','throw','compact','brace','stoke'];b.people.forEach((p,i)=>{p.task={type:tasks[i],target:i===4?'central':'gate',stage:'work',progress:i===0?.48:.65};});
 state.people.push({...b.people[4]});
 const publish=()=>page.evaluate(b=>window.__humanWorker.dispatchEvent(new MessageEvent('message',{data:{type:'state',battle:b,result:null,steps:0}})),b);
 await page.exposeFunction('__humanMessage',async m=>{if(m.type==='command')battleCommand(b,m.action);if(m.type!=='dispose')await publish();});
 await page.addInitScript(()=>{const Native=window.Worker;window.Worker=class extends EventTarget{constructor(url,options){super();if(!String(url).includes('night-worker'))return new Native(url,options);window.__humanWorker=this;queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:{type:'ready'}})));}postMessage(m){window.__humanMessage(m);}terminate(){}};});
 await page.route('**/api/campaign/export',r=>r.fulfill({json:{state,dawn:state,runId:'human-motion-fixture',revision:1}}));
 await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true',{timeout:20000});await page.locator('[data-action=start-night]').click();
 await expect.poll(()=>human(page).then(p=>p?.humanVisual?.phase)).toBe('repair');
 return {b,publish};
}
for(const [width,reduced]of [[1280,false],[390,false],[390,true]])test(`survivor gestures follow work, retain painted arms and freeze at ${width}px${reduced?' reduced':''}`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width,height:width===390?844:900});if(reduced)await page.emulateMedia({reducedMotion:'reduce'});
 const {b,publish}=await fixture(page);
 for(const [id,phase]of [['hero','repair'],['lin','throw'],['zhou','compact'],['chen','ready'],['meng','stoke']]){
  await expect.poll(()=>human(page,id).then(p=>p?.humanVisual?.phase)).toBe(phase);
  const obj=await human(page,id);expect(obj.texture).toMatch(/^human-rig-people/);expect(obj.humanArm).not.toBeNull();expect(obj.humanHand.x).toBeGreaterThan(obj.x-55);expect(obj.humanHand.x).toBeLessThan(obj.x+55);
  if(reduced){expect(obj.angle).toBe(0);expect(obj.humanVisual.contact).toBe(0);}
 }
 await page.screenshot({path:`.local/human-motion-work-${width}-${reduced}.png`});
 const frozen=await diagnostics(page);await page.waitForTimeout(220);expect((await diagnostics(page)).tokens).toEqual(frozen.tokens);
 const before=(await human(page)).humanArm.angle;b.people[0].task.progress=.2;b.elapsed+=.1;await publish();await expect.poll(()=>human(page).then(p=>p?.humanVisual?.beat)).toBeCloseTo(.2/.82);
 if(!reduced)expect((await human(page)).humanArm.angle).not.toBe(before);
 // Actual strike events come from the same simulation used by the worker.
 const p=b.people[0];p.task=null;p.cooldown=0;p.nightRole='guard';b.paused=false;b.enemies=[{id:'target',type:'walker',zone:'gate',x:p.x+8,y:p.y,hp:100,max:100,mode:'inside',attack:0,progress:0,stun:10}];stepBattle(b,.1);b.paused=true;await publish();
 await expect.poll(()=>human(page).then(p=>p?.humanVisual?.phase)).toBe('strike');expect(b.events.find(e=>e.type==='attack').personId).toBe('hero');
 expect((await human(page,'lin')).humanVisual.phase).toBe('throw');
 await page.screenshot({path:`.local/human-motion-strike-${width}-${reduced}.png`});
 // Completing a real throw retains its release pose and owns its projectile.
 const thrower=b.people[1];thrower.task.progress=99;b.paused=false;stepBattle(b,.1);b.paused=true;await publish();
 await expect.poll(()=>human(page,'lin').then(p=>p?.humanVisual?.phase)).toBe('release');expect((await diagnostics(page)).humans.find(p=>p.personId==='lin').effects).toContain('thrown-stone');
 b.elapsed+=1;for(const q of b.people){q.task=null;q.cooldown=0;q.nightRole='support';}await publish();
 await expect.poll(()=>human(page).then(p=>p?.humanArm)).toBeNull();expect((await human(page)).texture).toBe('people-a');
 expect(errors).toEqual([]);
});

test('every survivor can work, recover to their walking atlas and switch to wounded poses without orphaned arms',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));const {b,publish}=await fixture(page);
 const ids=['hero','lin','zhou','chen','xu','yuan','meng','visitor'];
 b.people=ids.map((id,i)=>Object.assign(makePerson(id,id,'幸存者','survival'),worldPoint({x:85+i%4*100,y:335+Math.floor(i/4)*80}),{task:{type:'repair',target:'gate',stage:'work',progress:.45}}));
 await publish();
 for(const id of ids){await expect.poll(()=>human(page,id).then(p=>p?.humanVisual?.phase)).toBe('repair');expect((await human(page,id)).humanArm).not.toBeNull();}
 const p=b.people[0];p.wound='severe';p.health=18;p.task=null;await publish();await expect.poll(()=>human(page).then(p=>p?.pose)).toBe('seated');expect((await human(page)).humanArm).toBeNull();expect((await human(page)).texture).toBe('people-wounded');
 b.paused=false;b.elapsed+=1;for(const p of b.people){p.task=null;p.cooldown=0;p.x+=20;}await publish();
 await expect.poll(()=>human(page).then(p=>p?.pose)).toBe('crawl');
 for(const id of ids.slice(1)){await expect.poll(()=>human(page,id).then(p=>p?.moving)).toBe(true);expect((await human(page,id)).humanArm).toBeNull();expect((await human(page,id)).texture).toMatch(/^people-/);}
 b.paused=true;await publish();await page.waitForTimeout(100);const frozen=(await diagnostics(page)).tokens;await page.waitForTimeout(200);expect((await diagnostics(page)).tokens).toEqual(frozen);
 p.dead=true;p.health=0;await publish();await expect.poll(()=>human(page)).toBeUndefined();expect(errors).toEqual([]);
});

for(const width of [1280,390])test(`all eight survivors articulate their painted hands in both strike directions at ${width}px`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width,height:width===390?844:900});
 const {b,publish}=await fixture(page),ids=['hero','lin','zhou','chen','xu','yuan','meng','visitor'];
 b.people=ids.map((id,i)=>Object.assign(makePerson(id,id,'幸存者','survival'),worldPoint({x:90+i%4*100,y:350+Math.floor(i/4)*85}),{nightRole:'guard',zone:'gate',cooldown:0}));
 b.id='all-strikes-'+width;b.work=Object.fromEntries(ids.map(id=>[id,0]));b.events=[];
 b.enemies=b.people.map(p=>({id:'target-'+p.id,type:'walker',zone:'gate',x:p.x+10,y:p.y,hp:100,max:100,mode:'inside',attack:0,progress:0,stun:10}));
 for(const p of b.people)p.task={type:'guard',target:'gate',stage:'work',progress:0,reserved:{},threatIds:['target-'+p.id]};
 b.paused=false;stepBattle(b,.05);b.paused=true;const hitAt=b.elapsed;
 for(const id of ids)expect(b.events.some(e=>e.type==='attack'&&e.personId===id)).toBe(true);
 for(const direction of [1,-1]){
  for(const e of b.events.filter(e=>e.type==='attack')){const p=b.people.find(p=>p.id===e.personId);Object.assign(e,{x:p.x+direction*40,y:p.y});}
  for(const age of [0,.075,.23,.559]){
   b.elapsed=hitAt+age;await publish();
   await expect.poll(()=>human(page).then(p=>p.humanVisual.clock)).toBe(b.elapsed);
   for(const id of ids){
    const obj=await human(page,id);expect(obj.humanVisual.phase).toBe('strike');expect(obj.facing).toBe(direction);
    expect(obj.humanWrist).not.toBeNull();expect(obj.humanArm).not.toBeNull();
    expect(obj.humanWrist.angle-obj.humanArm.angle).toBeCloseTo(obj.humanVisual.wrist*direction);
    expect(Math.hypot(obj.humanHand.x-obj.humanWrist.x,obj.humanHand.y-obj.humanWrist.y)).toBeLessThan(7);
    if(age===0)expect((obj.humanHand.x-obj.x)*direction).toBeGreaterThan(4);
   }
   await page.locator('#world').screenshot({path:`.local/human-strike-${width}-${direction}-${age}.png`});
  }
 }
 // Pause must freeze the wrist as well as the body and forearm.
 const frozen=(await diagnostics(page)).tokens;await page.waitForTimeout(180);expect((await diagnostics(page)).tokens).toEqual(frozen);
 b.elapsed=hitAt+1;for(const p of b.people){p.cooldown=0;p.task=null;p.nightRole='sleep';}await publish();
 for(const id of ids){await expect.poll(()=>human(page,id).then(p=>p?.humanWrist)).toBeNull();expect((await human(page,id)).humanHand).toBeNull();}
 expect(errors).toEqual([]);
});

test('real worker keeps walking smoothly and the paused canvas sleeps with articulated characters',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/?test=1');await expect(page.locator('#world')).toHaveAttribute('data-ready','true',{timeout:20000});
 await page.locator('[data-action=pause]:visible').first().click();
 await expect.poll(()=>page.locator('#world').evaluate(el=>el.getNightSnapshot().elapsed)).toBeGreaterThan(.4);
 await page.locator('[data-action=pause]:visible').first().click();await expect.poll(()=>diagnostics(page).then(d=>d.paused)).toBe(true);await page.waitForTimeout(120);
 const before=await diagnostics(page);await page.waitForTimeout(250);const after=await diagnostics(page);expect(after.tokens).toEqual(before.tokens);expect(after.draws-before.draws).toBeLessThanOrEqual(1);expect(errors).toEqual([]);
});
