import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {createTestSession} from '../src/test-mode.js';
import {createBattle,battleCommand,stepBattle,inner} from '../src/battle.js';
import {ZONES} from '../src/content.js';
import {defaultRobotPlan} from '../src/robots.js';
import {leaveHouse} from '../src/shelter.js';
import {artPoint} from '../src/yard-geometry.js';
import {installStorage,seedSave} from './support/storage.js';
const snapshot=page=>page.locator('#world').evaluate(el=>el.getNightSnapshot());
async function mount(page,{materials=0,available=true,robot=false,stamina=null,ordinary=false,selectedStamina=100,priorMove=false,responseDelay=0}={}){
 const state=createTestSession({day:8}).snapshot.state;state.people.forEach(p=>p.nightRole='sleep');
 if(robot)state.robots=[{id:'robot-test',name:'测试防卫机',type:'defense',hp:100,enabled:true,poweredDay:8,plan:defaultRobotPlan()}];
 const b=createBattle(state,'tap-interrupt',{autoPause:false});Object.assign(b,{paused:false,boss:null,challenge:null,schedule:[{at:9999,type:'walker',zone:'gate'}]});
 if(robot)b.robots[0].powered=false;
 b.enemies=[{id:'leaper',type:'bladebeast',zone:'gate',x:ZONES[0].x,y:ZONES[0].y,hp:1000,max:1000,mode:'attack',progress:0,attack:0,stun:0}];
 for(let i=0;i<81;i++)stepBattle(b);b.paused=true;b.resources.materials=materials;
 if(robot)Object.assign(b.robots[0],inner(ZONES[0]),{powered:true});
 if(available&&!robot){const p=b.people[1];leaveHouse(b,p);Object.assign(p,inner(ZONES[0]),{nightRole:'guard',fatigue:0,...(stamina===null?{}:{stamina})});}
 if(ordinary){
  Object.assign(b.enemies[0],{type:'walker',mode:'inside',x:240,y:440,progress:0,stun:1000});delete b.enemies[0].leap;
  const p=b.people[0];leaveHouse(b,p);Object.assign(p,{x:120,y:350,nightRole:'guard',fatigue:0,stamina:selectedStamina});
  if(priorMove)battleCommand(b,{type:'move',person:p.id,target:{x:130,y:360}});
 }
 await page.exposeFunction('__interruptMessage',async m=>{try{if(m.action?.type==='interrupt'&&responseDelay)await new Promise(resolve=>setTimeout(resolve,responseDelay));if(m.type==='command')battleCommand(b,m.action);return {type:'state',battle:b,result:null,steps:81};}catch(error){return {type:'error',message:error.message,commandId:m.commandId};}});
 await page.addInitScript(()=>{const Native=window.Worker;window.Worker=class extends EventTarget{constructor(url,options){super();if(!String(url).includes('night-worker'))return new Native(url,options);window.__interruptWorker=this;queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:{type:'ready'}})));}postMessage(m){if(m.type!=='dispose')window.__interruptMessage(m).then(data=>this.dispatchEvent(new MessageEvent('message',{data})));}terminate(){}};});
 await installStorage(page);await seedSave(page,{state,runId:'tap-interrupt',revision:1});await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true',{timeout:20000});await page.locator('[data-action=start-night]').click();await expect(page.locator('#battle-person')).toBeVisible();
 await expect.poll(()=>page.locator('canvas').evaluate(c=>c.getYardDiagnostics().tokens.some(t=>t.id==='e-leaper'))).toBe(true);
 return b;
}
async function tapEnemy(page){
 const at=await page.locator('#world').evaluate(root=>{const d=root.querySelector('canvas').getYardDiagnostics(),r=root.getBoundingClientRect(),m=d.metrics,body=d.tokens.find(t=>t.id==='e-leaper').bodyBounds;return {x:r.x+m.width/2+(body.left+body.width/2-240)*m.cssScale,y:r.y+m.height/2+(body.top+body.height/2-m.centerY)*m.cssScale};});
 await page.mouse.click(at.x,at.y);
}
for(const [width,height] of [[320,568],[390,844],[1280,900]])test(`one tap on an airborne winding creature dispatches a stamina-based heavy strike at ${width}px`,async({page})=>{
 mkdirSync('.local/interrupt',{recursive:true});await page.setViewportSize({width,height});const errors=[];page.on('pageerror',e=>errors.push(e.message));await mount(page);
 await expect(page.locator('#battle-person')).toHaveValue('hero');await tapEnemy(page);
 await expect.poll(async()=>(await snapshot(page)).people.find(p=>p.id==='lin').task?.type).toBe('heavy');let b=await snapshot(page);
 expect(b.resources.materials).toBe(0);expect(b.paused).toBe(true);expect(b.people[1].task.target).toBe('gate');await expect(page.locator('#battle-person')).toHaveValue('lin');await expect(page.locator('#overlay')).toBeHidden();await expect(page.locator('.combat-message')).toContainText('林禾重击');await expect(page.locator('.combat-message')).toContainText('可能赶不上');
 expect(await page.locator('canvas').evaluate(c=>c.getYardDiagnostics().movement.armed)).toBe(true);
 await tapEnemy(page);await expect(page.locator('#error')).toContainText('已有成员');expect((await snapshot(page)).resources.materials).toBe(0);
 await page.locator('[data-action=dismiss-error]').click();await page.screenshot({path:`.local/interrupt/dispatch-${width}.png`});expect(errors).toEqual([]);
});
for(const [options,message] of [[{stamina:0},'暂无可派成员'],[{available:false},'暂无可派成员']])test(`failed enemy tap reports ${message} (${JSON.stringify(options)}) without spending or waking sleepers`,async({page})=>{
 await mount(page,options);const before=await snapshot(page);await tapEnemy(page);await expect(page.locator('#error')).toContainText(message);expect(await snapshot(page)).toEqual(before);
});

test('one tap can dispatch a defense robot while every human stays asleep',async({page})=>{
 await page.setViewportSize({width:390,height:844});await mount(page,{robot:true});await tapEnemy(page);
 await expect.poll(async()=>(await snapshot(page)).robots[0].task?.type).toBe('heavy');
 const b=await snapshot(page);expect(b.resources.materials).toBe(0);expect(b.people.every(p=>p.nightRole==='sleep'&&!p.task)).toBe(true);await expect(page.locator('.combat-message')).toContainText('测试防卫机重击');await expect(page.locator('#overlay')).toBeHidden();
 await page.screenshot({path:'.local/interrupt/robot-heavy.png'});
});

for(const [width,height]of [[320,568],[390,844],[1280,900]])test(`selecting a member then an ordinary creature queues their heavy, shows approach and charge at ${width}px`,async({page})=>{
 mkdirSync('.local/selected-heavy',{recursive:true});await page.setViewportSize({width,height});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const b=await mount(page,{ordinary:true,priorMove:true});
 await page.locator('#crew-hud [data-person=hero]').click();await expect(page.locator('#map-help')).toContainText('点生物重击，点空地移动');await tapEnemy(page);
 await expect.poll(async()=>(await snapshot(page)).people[0].task?.type).toBe('heavy');
 expect((await snapshot(page)).people[0].task.enemyId).toBe('leaper');expect((await snapshot(page)).people[1].task).toBeNull();
 await expect(page.locator('#battle-person')).toHaveValue('hero');await expect(page.locator('#map-help')).toContainText('靠近灰行者');await expect(page.locator('#map-help')).toContainText('继续后执行');await expect(page.locator('#map-help')).toBeVisible();
 await expect(page.locator('#enemy-tap-feedback')).toContainText('已点中：灰行者');await expect(page.locator('#enemy-tap-feedback')).toContainText('已下令：你重击');await expect(page.locator('#enemy-tap-feedback')).toBeVisible();
 expect(await page.locator('canvas').evaluate(c=>c.getYardDiagnostics().clickedEnemy)).toBe('leaper');
 const target=await page.locator('canvas').evaluate(c=>c.getYardDiagnostics().tokens.find(t=>t.id==='e-leaper'));expect(target.selected).toBe(true);expect(target.highlighted).toBe(true);
 expect((await snapshot(page)).paused).toBe(true);await page.screenshot({path:`.local/selected-heavy/approach-${width}.png`});
 const publish=()=>page.evaluate(b=>window.__interruptWorker.dispatchEvent(new MessageEvent('message',{data:{type:'state',battle:b,result:null,steps:100}})),b);
 b.paused=false;for(let i=0;i<300&&b.people[0].task?.stage!=='work';i++)stepBattle(b);await publish();
 const expected=artPoint(b.people[0]);
 await expect.poll(()=>page.locator('canvas').evaluate((c,point)=>{const p=c.getYardDiagnostics().tokens.find(t=>t.id==='p-hero');return Math.hypot(p.x-point.x,p.y-point.y);},expected)).toBeLessThan(1.5);
 b.paused=true;
 await publish();await expect(page.locator('#map-help')).toContainText('正在蓄力重击灰行者');expect(b.events.some(e=>e.type==='heavy')).toBe(false);
 await page.screenshot({path:`.local/selected-heavy/charging-${width}.png`});
 b.paused=false;for(let i=0;i<60&&!b.events.some(e=>e.type==='heavy');i++)stepBattle(b);b.paused=true;await publish();
 expect(b.events.some(e=>e.type==='heavy'&&e.personId==='hero')).toBe(true);expect(b.resources.materials).toBe(0);expect(errors).toEqual([]);
});

test('selected member without stamina keeps the move and selection, without moving to the creature or switching actors',async({page})=>{
 await mount(page,{ordinary:true,selectedStamina:0,priorMove:true});await page.locator('#crew-hud [data-person=hero]').click();const before=await snapshot(page);
 await tapEnemy(page);await expect(page.locator('#error')).toContainText('你体力不足');expect(await snapshot(page)).toEqual(before);
 await expect(page.locator('#enemy-tap-feedback')).toContainText('已点中：灰行者');await expect(page.locator('#enemy-tap-feedback')).toContainText('未下令重击：你体力不足');
 await expect(page.locator('#battle-person')).toHaveValue('hero');expect(await page.locator('canvas').evaluate(c=>c.getYardDiagnostics().movement.armed)).toBe(true);
 await page.screenshot({path:'.local/selected-heavy/click-recognized-rejected.png'});
 await page.locator('[data-action=dismiss-error]').click();await page.locator('#crew-hud [data-person=lin]').click();await expect(page.locator('#enemy-tap-feedback')).toBeHidden();
});

test('recognition is visible before a slow order reply, and is distinct from command acceptance',async({page})=>{
 await mount(page,{ordinary:true,responseDelay:700});await page.locator('#crew-hud [data-person=hero]').click();await tapEnemy(page);
 await expect(page.locator('#enemy-tap-feedback')).toContainText('已点中：灰行者');await expect(page.locator('#enemy-tap-feedback')).toHaveAttribute('data-state','pending',{timeout:300});
 expect((await snapshot(page)).people[0].task).toBeNull();await expect(page.locator('#enemy-tap-feedback')).toHaveAttribute('data-state','accepted');
});

test('clicking an ordinary creature without selecting anyone explains how to target it and does not issue movement',async({page})=>{
 await mount(page,{ordinary:true});const before=await snapshot(page);await tapEnemy(page);await expect(page.locator('#error')).toContainText('先选中成员');expect(await snapshot(page)).toEqual(before);
});
