import { test,expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { initialCampaign,applyCampaignAction } from '../src/campaign.js';
import { createBattle,stepBattle,battleCommand,inner } from '../src/battle.js';
import { ENEMIES,ZONES } from '../src/content.js';
import { artPoint } from '../src/yard-geometry.js';

const snapshot=async page=>({...await page.request.get('/api/campaign').then(r=>r.json()),battle:await page.locator('#world').evaluate(el=>el.getNightSnapshot?.())});
const diagnostics=page=>page.locator('canvas').evaluate(c=>c.getYardDiagnostics());
function fixture(){let state=applyCampaignAction(initialCampaign(53),{type:'chooseRole',role:'repairman'});state.day=28;state=applyCampaignAction(state,{type:'prepare'});const battle=createBattle(state,randomUUID(),{autoPause:false});battle.schedule=[];battle.challenge=null;battle.fires=[];battle.paused=false;battle.people[0].nightRole='sleep';battle.people[0].x=240;battle.people[0].y=350;return {state,battle};}
function enemy(type,zone='gate',extra={}){const z=ZONES.find(z=>z.id===zone);return {id:type,type,zone,x:z.x,y:z.y,hp:ENEMIES[type].hp,max:ENEMIES[type].hp,mode:'attack',attack:0,progress:0,stun:0,called:false,...extra};}
async function simulatedNight(page,initial){
 let current=initial;
 const publish=()=>page.evaluate(battle=>window.__fixtureWorker.dispatchEvent(new MessageEvent('message',{data:{type:'state',battle,result:null,steps:0}})),current.battle);
 await page.exposeFunction('__fixtureMessage',async message=>{if(message.type==='command')battleCommand(current.battle,message.action);if(message.type!=='dispose')await publish();});
 await page.addInitScript(()=>{const RealWorker=window.Worker;window.Worker=class extends EventTarget{
  constructor(url,options){super();if(!String(url).includes('night-worker'))return new RealWorker(url,options);window.__fixtureWorker=this;queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:{type:'ready'}})));}
  postMessage(message){window.__fixtureMessage(message);}terminate(){}
 };});
 await page.route('**/api/campaign',route=>route.fulfill({json:{state:current.state,runId:'interaction-ui',revision:1}}));
 await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await page.locator('[data-action=start-night]').click();
 await expect(page.locator('canvas')).toBeVisible();
 return async next=>{current=next;await publish();await expect.poll(async()=>(await diagnostics(page)).feedback.enemies.map(e=>e.id)).toEqual(current.battle.enemies.map(e=>e.id));};
}

test('a real night shows a consumed trap, its exact damage and frozen feedback without saving',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:/修理工/}).click();await expect(page.locator('[data-action=prepare]')).toBeVisible();await expect(page.locator('#world')).toHaveAttribute('data-ready','true');
 let snap=await snapshot(page);
 for(const z of ZONES){const response=await page.request.post('/api/campaign/action',{data:{runId:snap.runId,revision:snap.revision,requestId:randomUUID(),action:{type:'craft',item:'trap',zone:z.id}}});expect(response.ok(),await response.text()).toBe(true);snap=await response.json();}
 await page.reload();await expect(page.locator('#world')).toHaveAttribute('data-ready','true');
 await page.locator('[data-action=prepare]').click();await page.locator('[data-action=start-night]').click();
 await page.locator('[data-action=more-night]').click();await page.locator('[data-group=orders][data-value=support]').click();await page.locator('[data-action=auto-pause]').click();await page.locator('[data-action=close-overlay]').click();
 const before=await snapshot(page);await page.locator('[data-action=pause]').click();
 await expect.poll(async()=>(await snapshot(page)).battle?.events.some(e=>e.type==='trap'),{timeout:40000}).toBe(true);
 await page.locator('[data-action=pause]').click();await expect(page.locator('[data-action=pause]')).toHaveText('继续');
 await expect.poll(async()=>(await diagnostics(page)).feedback.effects.some(e=>e.type==='trap')).toBe(true);
 await expect(page.locator('#caption')).toContainText('陷阱 −18');await expect(page.locator('#caption')).toContainText('剩余0');
 const paused=await diagnostics(page);await page.waitForTimeout(350);expect((await diagnostics(page)).feedback).toEqual(paused.feedback);
 const after=await snapshot(page);expect(after.revision).toBe(before.revision);
 const triggered=after.battle.events.find(e=>e.type==='trap');expect(after.battle.zones.find(z=>z.id===triggered.zone).traps).toBe(0);
 await page.screenshot({path:'test-results/interactions-real-trap.png',fullPage:true});expect(errors).toEqual([]);
});

test('defense fixtures distinguish spikes, mesh, interrupted charge and a damp central fire',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const blocked=fixture();blocked.battle.zones[1].spikes=true;blocked.battle.zones[2].mesh=true;blocked.battle.zones[1].bell=true;
 blocked.battle.enemies=[enemy('climber','left'),enemy('burrower','right'),enemy('rammer','gate',{attack:2.8})];stepBattle(blocked.battle);blocked.battle.paused=true;
 const show=await simulatedNight(page,blocked);
 await expect.poll(async()=>(await diagnostics(page)).feedback.enemies.map(e=>e.label)).toEqual(['翻刺挡攀','埋网挡掘','蓄势重撞']);
 const first=await diagnostics(page);expect(first.feedback.defenses.find(z=>z.id==='left').spikes).toBe(true);expect(first.feedback.defenses.find(z=>z.id==='right').mesh).toBe(true);expect(first.feedback.enemies.find(e=>e.id==='rammer').progress).toBeGreaterThan(.6);
 await page.screenshot({path:'test-results/interactions-blocked-and-charge.png',fullPage:true});
 const trapped=fixture();trapped.battle.zones[0].traps=1;trapped.battle.enemies=[enemy('rammer','gate',{attack:8})];stepBattle(trapped.battle);trapped.battle.paused=true;
 await show(trapped);await expect.poll(async()=>(await diagnostics(page)).feedback.effects.some(e=>e.type==='trap')).toBe(true);
 await expect(page.locator('#caption')).toContainText('撞击中断');expect((await diagnostics(page)).feedback.enemies[0].restrained).toBe(true);
 await page.screenshot({path:'test-results/interactions-interrupted-charge.png',fullPage:true});
 const wet=fixture();wet.battle.fires=[{id:'central',x:240,y:390,wood:1,heat:60,wet:0,shade:true}];
 wet.battle.enemies=[enemy('quencher','gate',{progress:8,id:'protected'})];stepBattle(wet.battle);wet.battle.paused=true;
 await show(wet);await expect.poll(async()=>(await diagnostics(page)).feedback.fires.filter(f=>f.wet>0).length).toBe(1);
 const sprayed=await diagnostics(page);expect(sprayed.feedback.effects.filter(e=>e.type==='wet')).toHaveLength(1);expect(sprayed.feedback.fires.map(f=>f.wet)).toEqual([4]);
 expect(sprayed.components.filter(c=>c.kind==='fire')).toHaveLength(1);expect(sprayed.components.find(c=>c.id==='fire-central').state).toBe('wet');
 await page.screenshot({path:'test-results/interactions-protected-and-wet-fire.png',fullPage:true});
 const frozen=await diagnostics(page);await page.waitForTimeout(350);expect((await diagnostics(page)).feedback).toEqual(frozen.feedback);expect(errors).toEqual([]);
});

test('small phone and reduced motion retain readable defenses, telegraphs and paused effects',async({page})=>{
 await page.setViewportSize({width:320,height:568});await page.emulateMedia({reducedMotion:'reduce'});
 const f=fixture();f.battle.zones[1].spikes=true;f.battle.zones[2].mesh=true;f.battle.zones[0].traps=1;
 f.battle.enemies=[enemy('climber','left'),enemy('burrower','right'),enemy('rammer','gate',{attack:8})];stepBattle(f.battle);f.battle.paused=true;
 await simulatedNight(page,f);await expect.poll(async()=>(await diagnostics(page)).feedback.effects.some(e=>e.type==='trap')).toBe(true);
 await expect(page.locator('#caption')).toContainText('撞击中断');
 const layout=await page.evaluate(()=>({w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,caption:document.querySelector('#caption').getBoundingClientRect().toJSON(),world:document.querySelector('.world-wrap').getBoundingClientRect().toJSON()}));
 expect(layout.sw).toBeLessThanOrEqual(layout.w);expect(layout.sh).toBeLessThanOrEqual(layout.h+1);expect(layout.caption.top).toBeGreaterThanOrEqual(layout.world.top);expect(layout.caption.bottom).toBeLessThanOrEqual(layout.world.bottom);
 const frozen=await diagnostics(page);await page.waitForTimeout(300);expect((await diagnostics(page)).feedback).toEqual(frozen.feedback);
 await page.screenshot({path:'test-results/interactions-small-reduced-motion.png',fullPage:true});
});

test('quencher spray leaves its mouth on a Bezier arc from all five zones, splashes at the hearth and freezes when paused',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const makeSpray=zone=>{const f=fixture();f.battle.fires=[{id:'central',x:240,y:390,wood:1,heat:80,wet:0,shade:true}];f.battle.enemies=[enemy('quencher',zone,{progress:8})];stepBattle(f.battle);f.battle.paused=true;f.battle.elapsed+=.18;return f;};
 let f=makeSpray('gate');const show=await simulatedNight(page,f);
 for(const zone of ZONES){
  if(zone.id!=='gate'){f=makeSpray(zone.id);await show(f);}
  const wet=f.battle.events.find(e=>e.type==='wet');
  await expect.poll(async()=>(await diagnostics(page)).feedback.effects.find(e=>e.id===wet.id)?.spray?.phase).toBe('flight');
  const first=await diagnostics(page),spray=first.feedback.effects.find(e=>e.id===wet.id).spray,body=first.tokens.find(t=>t.id==='e-quencher').bodyBounds;
  expect(spray.start.y).toBeGreaterThanOrEqual(body.top);expect(spray.start.y).toBeLessThan(body.top+body.height*.5);
  expect(spray.start.x).toBeGreaterThanOrEqual(body.left);expect(spray.start.x).toBeLessThanOrEqual(body.left+body.width);
  const hearth=artPoint(f.battle.fires[0]);expect(spray.end).toEqual({x:hearth.x,y:hearth.y-8});
  expect(spray.control.y).toBeLessThan(Math.min(spray.start.y,spray.end.y));expect(spray.drops.length).toBeGreaterThan(1);
  f.battle.elapsed=wet.time+spray.duration*.5;await show(f);
  await expect.poll(async()=>(await diagnostics(page)).feedback.effects.find(e=>e.id===wet.id)?.spray?.progress).toBeCloseTo(.5,4);
  const mid=(await diagnostics(page)).feedback.effects.find(e=>e.id===wet.id).spray;
  expect(mid.start).toEqual(spray.start);expect(mid.drops).not.toEqual(spray.drops);
  if(['gate','backLeft'].includes(zone.id))await page.screenshot({path:`.local/validation/quencher-spray/flight-${zone.id}.png`,fullPage:true});
  // An already launched glob still reaches the hearth after its emitter dies.
  f.battle.enemies=[];f.battle.elapsed=wet.time+spray.duration+.2;await show(f);
  await expect.poll(async()=>(await diagnostics(page)).feedback.effects.find(e=>e.id===wet.id)?.spray?.phase).toBe('impact');
  const landed=await diagnostics(page),impact=landed.feedback.effects.find(e=>e.id===wet.id).spray;
  expect(impact.start).toEqual(spray.start);expect(impact.end).toEqual(spray.end);expect(impact.drops).toHaveLength(0);
  if(zone.id==='backLeft')await page.screenshot({path:'.local/validation/quencher-spray/impact.png',fullPage:true});
  await page.waitForTimeout(180);expect((await diagnostics(page)).feedback).toEqual(landed.feedback);
 }
 expect(errors).toEqual([]);
});

test('reduced motion keeps a static spray path and impact readable on a small phone',async({page})=>{
 await page.setViewportSize({width:320,height:568});await page.emulateMedia({reducedMotion:'reduce'});
 const f=fixture();f.battle.fires=[{id:'central',x:240,y:390,wood:1,heat:80,wet:0,shade:true}];f.battle.enemies=[enemy('quencher','left',{progress:8})];stepBattle(f.battle);f.battle.paused=true;
 const show=await simulatedNight(page,f),wet=f.battle.events.find(e=>e.type==='wet');
 await expect.poll(async()=>(await diagnostics(page)).feedback.effects.find(e=>e.id===wet.id)?.spray?.phase).toBe('reduced');
 const first=(await diagnostics(page)).feedback.effects.find(e=>e.id===wet.id).spray;
 f.battle.elapsed+=.4;await show(f);expect((await diagnostics(page)).feedback.effects.find(e=>e.id===wet.id).spray).toEqual(first);
 const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));expect(layout.scroll).toBeLessThanOrEqual(layout.width);
 await page.screenshot({path:'.local/validation/quencher-spray/reduced-320.png',fullPage:true});
});
