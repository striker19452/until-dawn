import {test,expect} from '@playwright/test';
import {createTestSession} from '../src/test-mode.js';
import {installStorage,seedSave,readSave} from './support/storage.js';
const diagnostics=page=>page.locator('canvas').evaluate(el=>el.getYardDiagnostics());
const state=page=>page.locator('#world').evaluate(el=>el.getNightSnapshot?.());
const machine=(page,id)=>diagnostics(page).then(d=>d.tokens.find(t=>t.id==='r-'+id));
async function waitForRobotPhase(page,id,phase,timeout){
 let robot;
 await expect.poll(async()=>{robot=await machine(page,id);return robot?.robotVisual?.phase;},{timeout,intervals:[50,100]}).toBe(phase);
 return robot;
}

for(const [width,reduced] of [[390,false],[1280,false],[390,true]])test(`daytime robots patrol without changing the save at ${width}px${reduced?' reduced':''}`,async({page})=>{
 await page.setViewportSize({width,height:width===390?844:900});
 if(reduced)await page.emulateMedia({reducedMotion:'reduce'});
 const {dawn}=createTestSession({day:1,preset:'solo-robots'});
 if(reduced)dawn.robots[2].hp=0;
 else dawn.robots[2].enabled=false;
 await installStorage(page);
 await seedSave(page,{state:dawn,runId:'robot-day-motion',revision:1});
 await page.goto('/');
 await expect(page.locator('#world')).toHaveAttribute('data-ready','true',{timeout:20000});
 const robots=()=>diagnostics(page).then(d=>d.tokens.filter(t=>t.id.startsWith('r-')));
 await expect.poll(async()=>(await robots()).length).toBe(4);
 const save=await readSave(page),initial=await robots();
 const travelled=(robot,start)=>Math.hypot(robot.x-start.x,robot.y-start.y);
 if(reduced){
  await page.waitForTimeout(400);
  expect((await robots()).map((r,i)=>travelled(r,initial[i]))).toEqual([0,0,0,0]);
  expect((await machine(page,'robot-3')).robotVisual.phase).toBe('broken');
 }else{
  await expect.poll(async()=>(await robots()).filter((r,i)=>i!==2&&travelled(r,initial[i])>12&&r.robotVisual.phase==='travel').length).toBe(3);
  const offline=await machine(page,'robot-3');
  expect(travelled(offline,initial[2])).toBe(0);
  expect(offline.robotVisual.phase).toBe('offline');
 }
 expect(await readSave(page)).toEqual(save);
 await page.locator('[data-action=prepare]').click();
 await expect(page.locator('#phase')).toHaveText('黄昏准备');
 if(!reduced){
  const dusk=await machine(page,'robot-4');
  await expect.poll(async()=>travelled(await machine(page,'robot-4'),dusk)).toBeGreaterThan(12);
 }
 await page.locator('[data-action=start-night]').click();
 await expect.poll(async()=>(await state(page))?.paused).toBe(true);
 expect((await state(page)).robots.map(r=>r.powered)).toEqual([true,true,false,true]);
});

for(const [width,reduced]of [[1280,false],[390,false],[390,true]])test(`robot poses, real effects and frozen pause ${width}${reduced?' reduced':''}`,async({page})=>{
 test.setTimeout(65000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width,height:width===390?844:900});if(reduced)await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/?test=1&testPreset=robots');await expect(page.locator('#world')).toHaveAttribute('data-ready','true',{timeout:20000});await expect.poll(async()=>(await state(page))?.robots.length,{timeout:10000}).toBe(3);
 expect((await state(page)).paused).toBe(true);await page.locator('[data-action="pause"]:visible').first().click();
 const [walked,repair]=await Promise.all([
  waitForRobotPhase(page,'robot-3','travel',8000),
  waitForRobotPhase(page,'robot-1','repair',15000),
 ]);
 expect(walked.texture).toBe('robots-rig');if(reduced){expect(walked.robotVisual.angle).toBe(0);expect(walked.robotVisual.frame).toBe(8);}else expect(walked.robotVisual.angle).not.toBe(0);
 expect(repair.robotVisual.work).toBeGreaterThan(0);expect([2,3]).toContain(Number(repair.frame));
 await expect.poll(()=>diagnostics(page).then(d=>d.robots?.some(r=>r.effects.includes('dispatch-link')&&r.receiver==='robot-2')),{timeout:8000,intervals:[50,100]}).toBe(true);
 await page.screenshot({path:`.local/robot-motion-radio-${width}-${reduced}.png`});
 expect((await waitForRobotPhase(page,'robot-2','strike',16000)).frame).toBe('7');await page.locator('[data-action="pause"]:visible').first().click();await expect.poll(async()=>(await state(page)).paused).toBe(true);
 await expect.poll(()=>diagnostics(page).then(d=>d.paused)).toBe(true);await page.waitForTimeout(80);const before=await diagnostics(page);await page.waitForTimeout(180);const after=await diagnostics(page);
 expect(after.tokens.filter(t=>t.id.startsWith('r-')).map(t=>[t.frame,t.spriteX,t.spriteY,t.angle,t.robotVisual])).toEqual(before.tokens.filter(t=>t.id.startsWith('r-')).map(t=>[t.frame,t.spriteX,t.spriteY,t.angle,t.robotVisual]));expect(after.robots).toEqual(before.robots);
 if(reduced)expect(after.robots.some(r=>r.effects.includes('foot-dust')||r.effects.includes('repair-sparks'))).toBe(false);
 await page.screenshot({path:`.local/robot-motion-strike-${width}-${reduced}.png`});expect(errors).toEqual([]);
});
