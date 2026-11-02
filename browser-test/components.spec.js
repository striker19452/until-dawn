import { test,expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { initialCampaign,applyCampaignAction } from '../src/campaign.js';
import { createBattle,stepBattle,battleCommand } from '../src/battle.js';
import { ENEMIES,BUILDINGS } from '../src/content.js';
import { worldPoint } from '../client/scene-layout.js';

const diagnostics=page=>page.locator('canvas').evaluate(c=>c.getYardDiagnostics());
function expectSideWallDirection(d,frame){
 for(const [id,sign] of [['left',-1],['right',1]]){
  const panel=d.components.find(c=>c.id==='fence-'+id),[tl,tr,br,bl]=panel.quad;
  expect(panel.renderer).toBe('Mesh2D');expect(panel.frame).toBe(frame);
  expect(panel.uv[0].y).toBe(frame<3?1:.5);expect(panel.uv[2].y).toBe(frame<3?.5:0);
  expect((tr.y-tl.y)*sign).toBeGreaterThan((tr.x-tl.x)*4);
  expect(tl.x).toBeCloseTo(bl.x,6);expect(tr.x).toBeCloseTo(br.x,6);
  expect(bl.y-tl.y).toBeGreaterThan(0);expect(br.y-tr.y).toBeGreaterThan(0);
 }
 for(const id of ['backLeft','backRight'])expect(d.components.find(c=>c.id==='fence-'+id).renderer).toBe('Image');
}
function fixture(){
 let state=applyCampaignAction(initialCampaign(53),{type:'chooseRole',role:'repairman'});state.day=28;state=applyCampaignAction(state,{type:'prepare'});
 const battle=createBattle(state,randomUUID(),{autoPause:false});battle.schedule=[{at:9999,type:'walker',zone:'gate'}];battle.challenge=null;battle.fires=[];battle.people[0].nightRole='guard';battle.people[0].x=235;battle.people[0].y=205;
 return {state,battle};
}
async function simulatedNight(page,initial){
 let current=initial;
 const publish=()=>page.evaluate(battle=>window.__fixtureWorker.dispatchEvent(new MessageEvent('message',{data:{type:'state',battle,result:null,steps:0}})),current.battle);
 await page.exposeFunction('__fixtureMessage',async message=>{if(message.type==='command')battleCommand(current.battle,message.action);if(message.type!=='dispose')await publish();});
 await page.addInitScript(()=>{const RealWorker=window.Worker;window.Worker=class extends EventTarget{
  constructor(url,options){super();if(!String(url).includes('night-worker'))return new RealWorker(url,options);window.__fixtureWorker=this;queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:{type:'ready'}})));}
  postMessage(message){window.__fixtureMessage(message);}terminate(){}
 };});
 await page.route('**/api/campaign',route=>route.fulfill({json:{state:current.state,runId:'components-ui',revision:1}}));
 await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await page.locator('[data-action=start-night]').click();
 await expect.poll(async()=>(await diagnostics(page)).components.find(c=>c.id==='house')?.frame).toBe(1);
 return async next=>{current=next;await publish();};
}

test('each building and defense owns a component, and gates change art on damage, breach and repair',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));const f=fixture();
 f.state.buildings=Object.keys(BUILDINGS).slice(0,6).map((type,i)=>({id:'b'+i,type,level:1}));
 Object.assign(f.battle.zones[0],{hp:100,traps:2,spikes:true,mesh:true,bell:true,compacted:true});
 f.battle.fires=[{id:'central',x:240,y:390,heat:45,wet:0,shade:true}];
 const show=await simulatedNight(page,f);
 await expect.poll(async()=>(await diagnostics(page)).components.filter(c=>c.id.startsWith('building-')).length).toBe(6);
 let d=await diagnostics(page);expect(new Set(d.components.map(c=>c.id)).size).toBe(d.components.length);
 for(const id of ['house','gate','fence-left','fence-right','fence-backLeft','fence-backRight','trap-gate-0','trap-gate-1','mesh-gate','spikes-gate','bell-gate','compacted-gate','fire-central'])expect(d.components.some(c=>c.id===id),id).toBe(true);
 expect(d.components.some(c=>c.kind==='shade')).toBe(false);
 for(const [hp,state,frame] of [[100,'intact',3],[35,'damaged',4],[0,'destroyed',5],[100,'intact',3]]){
  for(const z of f.battle.zones.filter(z=>['gate','left','right'].includes(z.id)))z.hp=hp;await show(f);await expect.poll(async()=>(await diagnostics(page)).components.find(c=>c.id==='gate')?.frame).toBe(frame);
  await expect(page.locator('#zones [data-zone=gate] b')).toHaveText(String(hp));
  d=await diagnostics(page);expectSideWallDirection(d,frame);const gates=d.components.filter(c=>c.id==='gate');expect(gates).toHaveLength(1);expect(gates[0].state).toBe(state);expect(gates[0].occludes).toBe(hp>0);
  await page.screenshot({path:`test-results/components-gate-${state}.png`,fullPage:true});
 }
 // Consumed traps disappear as individual objects; the other installations remain.
 f.battle.zones[0].traps=1;await show(f);
 await expect.poll(async()=>(await diagnostics(page)).components.filter(c=>c.id.startsWith('trap-gate-')).length).toBe(1);
 f.state.buildings=[{id:'stove',type:'stove',level:2},{id:'exchange',type:'exchange',level:1}];await page.reload();await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await page.locator('[data-action=start-night]').click();
 await expect.poll(async()=>(await diagnostics(page)).components.find(c=>c.id==='house')?.frame).toBe(1);
 await expect.poll(async()=>(await diagnostics(page)).components.filter(c=>c.id.startsWith('building-')).map(c=>c.kind)).toEqual(['stove','exchange']);
 d=await diagnostics(page);expect(d.components.some(c=>c.id==='trap-gate-0')).toBe(true);expect(d.components.some(c=>c.id==='trap-gate-1')).toBe(false);expect(errors).toEqual([]);
});

test('people and creatures behind the house use hollow contours, the front stays solid and pausing freezes them',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));const f=fixture();
 f.battle.people.push({...structuredClone(f.battle.people[0]),id:'lin',name:'林禾',x:240,y:380});
 f.battle.enemies=[{id:'behind',type:'walker',zone:'backRight',x:275,y:205,hp:23,max:ENEMIES.walker.hp,mode:'inside',attack:0,progress:0,stun:0,called:false}];
 await simulatedNight(page,f);
 await expect.poll(async()=>(await diagnostics(page)).tokens.find(t=>t.id==='p-hero')?.occluded).toBe(true);
 const d=await diagnostics(page),hero=d.tokens.find(t=>t.id==='p-hero'),enemy=d.tokens.find(t=>t.id==='e-behind'),front=d.tokens.find(t=>t.id==='p-lin');
 for(const unit of [hero,enemy]){expect(unit.occluders).toContain('house');expect(unit.visible).toBe(false);expect(unit.outlineVisible).toBe(true);expect(unit.outlineFrame).toMatch(/^unit-contour-/);}
 expect(front.occluded).toBe(false);expect(front.visible).toBe(true);expect(front.outlineVisible).toBe(false);
 await page.screenshot({path:'test-results/components-house-contours.png',fullPage:true});await page.waitForTimeout(350);expect((await diagnostics(page)).tokens).toEqual(d.tokens);expect(errors).toEqual([]);
});

test('real pathfinding walks out from behind the house and restores the body without residual outlines',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));const f=fixture(),show=await simulatedNight(page,f);
 await expect.poll(async()=>(await diagnostics(page)).tokens.find(t=>t.id==='p-hero')?.outlineVisible).toBe(true);
 battleCommand(f.battle,{type:'retreat',person:'hero'});battleCommand(f.battle,{type:'resume'});
 const phases=new Set(),masks=new Set();
 for(let i=0;i<85;i++){
  stepBattle(f.battle,.1);await show(f);await page.waitForTimeout(55);
  const p=(await diagnostics(page)).tokens.find(t=>t.id==='p-hero');if(p.occluded&&p.moving){phases.add(p.frame);masks.add(`${p.occlusion.hidden}:${p.occlusion.exposed}`);expect(p.occlusion.ghostOutsideMask).toBe(0);}
 }
 expect(phases.size).toBeGreaterThanOrEqual(3);expect(masks.size).toBeGreaterThanOrEqual(3);
 await expect.poll(async()=>(await diagnostics(page)).tokens.find(t=>t.id==='p-hero')?.occluded).toBe(false);
 const front=(await diagnostics(page)).tokens.find(t=>t.id==='p-hero');expect(front.visible).toBe(true);expect(front.outlineVisible).toBe(false);
 battleCommand(f.battle,{type:'pause'});await show(f);await page.waitForTimeout(250);const frozen=await diagnostics(page);await page.waitForTimeout(250);expect((await diagnostics(page)).tokens).toEqual(frozen.tokens);
 await page.screenshot({path:'test-results/components-return-to-front.png',fullPage:true});expect(errors).toEqual([]);
});

test('daylight uses its own intact, damaged and breached gate artwork',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));const f=fixture();f.state.phase='day';
 await page.route('**/api/campaign',route=>route.fulfill({json:{state:f.state,runId:'day-components',revision:1}}));
 for(const [hp,frame] of [[100,0],[35,1],[0,2]]){
  f.state.zones[0].hp=hp;f.state.zones[1].hp=hp;f.state.zones[2].hp=hp;await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');
  await expect.poll(async()=>(await diagnostics(page)).components.find(c=>c.id==='gate')?.frame).toBe(frame);
  const d=await diagnostics(page);expectSideWallDirection(d,frame);expect(d.components.find(c=>c.id==='house').frame).toBe(0);expect(d.components.find(c=>c.id==='fence-left').frame).toBe(frame);
  await page.screenshot({path:`test-results/components-day-gate-${frame}.png`,fullPage:true});
 }
 expect(errors).toEqual([]);
});

test('side door alpha and occlusion follow the projected wall face and disappear with a breach',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));const f=fixture();
 f.battle.enemies=[['left',65,310],['right',405,320],['right-gap',415,310]].map(([id,x,y])=>({id,type:'walker',zone:id==='left'?'left':'right',x,y,hp:23,max:23,mode:'approach',attack:0,progress:0,stun:0,called:false}));
 const show=await simulatedNight(page,f);
 await expect.poll(async()=>(await diagnostics(page)).tokens.filter(t=>t.id==='e-left'||t.id==='e-right').map(t=>t.occluded)).toEqual([true,true]);
 const d=await diagnostics(page);for(const side of ['left','right']){const unit=d.tokens.find(t=>t.id==='e-'+side);expect(unit.occluders).toContain('fence-'+side);expect(unit.occlusion.hidden).toBeGreaterThan(0);expect(unit.occlusion.exposed).toBeGreaterThan(0);expect(unit.occlusion.ghostOutsideMask).toBe(0);}
 expect(d.tokens.find(t=>t.id==='e-right-gap').occluded).toBe(false,'a transparent gap beside the boards must keep the real body');
 await page.screenshot({path:'test-results/side-doors-occlusion.png',fullPage:true});
 f.battle.zones.find(z=>z.id==='left').hp=0;f.battle.zones.find(z=>z.id==='right').hp=0;await show(f);
 await expect.poll(async()=>(await diagnostics(page)).tokens.filter(t=>t.id==='e-left'||t.id==='e-right').map(t=>t.occluded)).toEqual([false,false]);
 expect(errors).toEqual([]);
});

test('a partly covered person keeps exposed body pixels solid and only hidden pixels become translucent',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));const f=fixture();
 Object.assign(f.battle.people[0],worldPoint({x:135,y:235}));
 const show=await simulatedNight(page,f);
 await expect.poll(async()=>(await diagnostics(page)).tokens.find(t=>t.id==='p-hero')?.occlusion.hidden).toBeGreaterThan(0);
 let hero=(await diagnostics(page)).tokens.find(t=>t.id==='p-hero');
 expect(hero.occlusion.exposed).toBeGreaterThan(20);expect(hero.occlusion.solidExposed).toBeGreaterThan(20);expect(hero.occlusion.translucentHidden).toBeGreaterThan(20);expect(hero.occlusion.ghostOutsideMask).toBe(0);
 await page.screenshot({path:'test-results/components-partial-body.png',fullPage:true});
 // Selection adds gold highlighting while retaining the same partial mask.
 const d=await diagnostics(page),box=await page.locator('canvas').boundingBox(),body=hero.bodyBounds,p={x:body.left+body.width*.5,y:body.top+body.height*.55};
 await page.mouse.click(box.x+box.width/2+(p.x-240)*d.metrics.cssScale,box.y+box.height/2+(p.y-d.metrics.centerY)*d.metrics.cssScale);
 await expect.poll(async()=>(await diagnostics(page)).tokens.find(t=>t.id==='p-hero')?.highlighted).toBe(true);
 hero=(await diagnostics(page)).tokens.find(t=>t.id==='p-hero');expect(hero.occlusion.solidExposed).toBeGreaterThan(20);expect(hero.occlusion.ghostOutsideMask).toBe(0);
 await page.screenshot({path:'test-results/components-partial-selected.png',fullPage:true});
 // Mirroring a frame and changing the house state must preserve clipping.
 Object.assign(f.battle.people[0],worldPoint({x:134,y:235}));f.battle.house=50;f.battle.paused=false;await show(f);await page.waitForTimeout(150);
 hero=(await diagnostics(page)).tokens.find(t=>t.id==='p-hero');expect(hero.flipX).toBe(true);expect(hero.occlusion.hidden).toBeGreaterThan(0);expect(hero.occlusion.solidExposed).toBeGreaterThan(20);expect(hero.occlusion.ghostOutsideMask).toBe(0);
 f.battle.paused=true;await show(f);await page.waitForTimeout(200);
 const frozen=await diagnostics(page);await page.waitForTimeout(250);expect((await diagnostics(page)).tokens).toEqual(frozen.tokens);
 expect(errors).toEqual([]);
});
