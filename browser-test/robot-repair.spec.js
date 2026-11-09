import {test,expect} from '@playwright/test';
import {createTestSession} from '../src/test-mode.js';
import {createBattle,battleCommand,stepBattle} from '../src/battle.js';
import {defaultRobotPlan} from '../src/robots.js';
import {nearestWalkablePoint} from '../src/movement.js';
import {artPoint} from '../src/yard-geometry.js';
import {installStorage,seedSave} from './support/storage.js';

const diagnostics=page=>page.locator('canvas').evaluate(c=>c.getYardDiagnostics());
for(const [width,reduced,dispatched]of [[1280,false,false],[390,false,false],[390,true,false],[1280,false,true],[390,false,true]])test(`machine repair shows real tool contact, progress, healing and frozen pause ${width}${reduced?' reduced':''}${dispatched?' dispatched':''}`,async({page})=>{
 await page.setViewportSize({width,height:width===390?844:900});if(reduced)await page.emulateMedia({reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base=createTestSession({day:1,preset:'robots'}).snapshot.state;base.zones.forEach(z=>z.hp=100);base.robots=base.robots.slice(0,dispatched?3:2);
 base.robots.forEach(r=>r.plan={...defaultRobotPlan(),route:['gate'],materials:0,parts:1});base.robots[1].hp=40;if(dispatched)base.robots[0].plan.route=['gate','left'];
 const b=createBattle(base,'robot-service-visual',{autoPause:false});Object.assign(b,{boss:null,challenge:null,schedule:[{at:9999,type:'walker',zone:'gate'}]});
 const [worker,target]=b.robots;Object.assign(worker,nearestWalkablePoint({x:175,y:430},b.walkMap));Object.assign(target,nearestWalkablePoint({x:240,y:430},b.walkMap));
 if(dispatched){worker.index=1;Object.assign(worker,nearestWalkablePoint({x:70,y:310},b.walkMap));Object.assign(b.robots[2],nearestWalkablePoint({x:275,y:430},b.walkMap));}
 const publish=()=>page.evaluate(b=>window.__repairWorker.dispatchEvent(new MessageEvent('message',{data:{type:'state',battle:b,result:null,steps:Math.round(b.elapsed*20)}})),b);
 await page.exposeFunction('__repairMessage',async m=>{if(m.type==='command')battleCommand(b,m.action);if(m.type==='init'||m.type==='command')await publish();});
 await page.addInitScript(()=>{const Native=window.Worker;window.Worker=class extends EventTarget{constructor(url,options){super();if(!String(url).includes('night-worker'))return new Native(url,options);window.__repairWorker=this;queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:{type:'ready'}})));}postMessage(m){window.__repairMessage(m);}terminate(){}};});
 await installStorage(page);await seedSave(page,{state:base,runId:'robot-service-visual',revision:1});await page.goto('/');
 await expect(page.locator('#world')).toHaveAttribute('data-ready','true',{timeout:20000});await page.locator('[data-action=start-night]').click();
 await expect.poll(()=>diagnostics(page).then(d=>d.tokens.filter(t=>t.id.startsWith('r-')).length)).toBe(dispatched?3:2);
 if(dispatched){
  expect(Math.hypot(worker.x-target.x,worker.y-target.y)).toBeGreaterThan(95);b.paused=false;stepBattle(b);b.paused=true;await publish();
  expect(worker.task.dispatcher).toBe(b.robots[2].id);expect(worker.task.robotId).toBe(target.id);
  await expect.poll(()=>diagnostics(page).then(d=>d.robots.some(r=>r.robotId===b.robots[2].id&&r.effects.includes('dispatch-link')&&r.receiver===worker.id))).toBe(true);
  await page.screenshot({path:`.local/robot-repair-dispatch-${width}.png`});
 }
 const materials=b.resources.materials,parts=b.resources.parts;b.paused=false;
 for(let tick=0;tick<400&&!(worker.task?.type==='robot-repair'&&worker.task.progress>=.1);tick++)stepBattle(b);
 expect(worker.task.type).toBe('robot-repair');expect(target.hp).toBe(40);expect(b.resources.materials).toBe(materials);expect(b.resources.parts).toBe(parts);await publish();
 const machine=()=>diagnostics(page).then(d=>d.tokens.find(t=>t.id==='r-'+worker.id));
 // Let the renderer follow the completed journey before freezing the work pose.
 const destination=artPoint(worker);await expect.poll(()=>machine().then(t=>Math.hypot(t.x-destination.x,t.y-destination.y)),{timeout:10000}).toBeLessThan(.04);
 await expect.poll(()=>machine().then(t=>t.moving),{timeout:10000}).toBe(false);b.paused=true;await publish();
 await expect.poll(()=>machine().then(t=>t.robotVisual?.phase)).toBe('repair');
 if(!reduced)expect((await machine()).robotVisual.joints.tool.angle).toBeLessThan(0);
 b.paused=false;for(let tick=0;tick<6;tick++)stepBattle(b);b.paused=true;await publish();
 await expect.poll(()=>diagnostics(page).then(d=>d.robots.find(r=>r.robotId===worker.id)?.effects.includes('robot-repair-contact'))).toBe(true);
 const working=await diagnostics(page),actor=working.tokens.find(t=>t.id==='r-'+worker.id),recipient=working.tokens.find(t=>t.id==='r-'+target.id),fx=working.robots.find(r=>r.robotId===worker.id);
 expect(actor.robotVisual.targetRobotId).toBe(target.id);expect(actor.robotVisual.work).toBeGreaterThan(0);expect(fx.targetRobotId).toBe(target.id);expect(Math.abs(fx.contact.x-recipient.x)).toBeLessThan(12);
 if(reduced){expect(actor.robotVisual.angle).toBe(0);expect(fx.effects).not.toContain('repair-sparks');}else{expect(actor.robotVisual.joints.tool.angle).toBeGreaterThan(25);expect(fx.effects).toContain('repair-sparks');}
 await page.screenshot({path:`.local/robot-repair-working-${width}-${reduced}${dispatched?'-dispatched':''}.png`});
 await page.waitForTimeout(150);const frozen=await machine();expect(frozen.robotVisual).toEqual(actor.robotVisual);expect(frozen.spriteX).toBe(actor.spriteX);expect(frozen.spriteY).toBe(actor.spriteY);
 b.paused=false;for(let tick=0;tick<160&&!b.robotRepairs?.length;tick++)stepBattle(b);b.paused=true;await publish();
 expect(target.hp).toBe(84);expect(b.resources.materials).toBe(materials);expect(b.resources.parts).toBe(parts-1);expect(b.robotRepairs).toHaveLength(1);
 await expect.poll(()=>diagnostics(page).then(d=>d.feedback.effects.some(e=>e.type==='robot-repair'&&e.text.includes('+44')))).toBe(true);
 await page.screenshot({path:`.local/robot-repair-complete-${width}-${reduced}${dispatched?'-dispatched':''}.png`});expect(errors).toEqual([]);
});
