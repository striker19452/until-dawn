import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {createTestSession} from '../src/test-mode.js';
import {createBattle,battleCommand,stepBattle} from '../src/battle.js';
import {installStorage,seedSave,readSave} from './support/storage.js';

const evidence='.local/crew-health';
const hud=(page,id)=>page.locator(`#crew-hud [data-person=${id}]`);
const snapshot=page=>page.locator('#world').evaluate(el=>el.getNightSnapshot());

async function controlled(page){
 const state=createTestSession({day:8}).snapshot.state;
 const b=createBattle(state,'crew-health',{autoPause:false});b.challenge=null;b.schedule=[{at:9999,type:'walker',zone:'gate'}];
 Object.assign(b.people[1],{health:52.6,x:315,y:400});Object.assign(b.people[2],{health:.03,wound:'severe',deadline:9});
 Object.assign(b.people[3],{dead:true,health:0,stamina:0,deathCause:'attack'});b.people[4].nightRole='sleep';b.indoorPeople.xu=true;
 const publish=()=>page.evaluate(b=>window.__crewWorker.dispatchEvent(new MessageEvent('message',{data:{type:'state',battle:b,result:null,steps:Math.round(b.elapsed*20)}})),b);
 await page.exposeFunction('__crewMessage',async message=>{if(message.type==='command')battleCommand(b,message.action);if(message.type!=='dispose')await publish();});
 await page.addInitScript(()=>{const Native=window.Worker;window.Worker=class extends EventTarget{
  constructor(url,options){super();if(!String(url).includes('night-worker'))return new Native(url,options);window.__crewWorker=this;queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:{type:'ready'}})));}
  postMessage(message){window.__crewMessage(message);}terminate(){}
 };});
 await installStorage(page);await seedSave(page,{state,runId:'crew-health',revision:1});
 await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await page.locator('[data-action=start-night]').click();await expect(page.locator('#battle-person')).toBeVisible();
 return {b,publish};
}

for(const [width,height] of [[320,568],[390,844],[1280,900],[844,390]])test(`all five health readouts remain visible and actionable at ${width}×${height}`,async({page})=>{
 mkdirSync(evidence,{recursive:true});await page.setViewportSize({width,height});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const {b,publish}=await controlled(page);
 await expect(page.locator('#crew-hud button')).toHaveCount(5);
 await expect(hud(page,'lin').locator('strong')).toHaveText('53');await expect(hud(page,'zhou')).toContainText('重伤');await expect(hud(page,'zhou').locator('strong')).toHaveText('1');
 await expect(hud(page,'chen')).toContainText('已死亡');await expect(hud(page,'xu')).toContainText('屋内');
 const geometry=await page.locator('#crew-hud').evaluate(root=>({buttons:[...root.children].map(el=>{const r=el.getBoundingClientRect();return {inside:r.x>=0&&r.right<=innerWidth&&r.y>=0&&r.bottom<=innerHeight,height:r.height,overflow:el.scrollWidth>el.clientWidth+1};}),width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,world:document.querySelector('#world').getBoundingClientRect().height}));
 expect(geometry.buttons.every(b=>b.inside&&b.height>=44&&!b.overflow)).toBe(true);expect(geometry.width).toBeLessThanOrEqual(width);expect(geometry.height).toBeLessThanOrEqual(height+1);expect(geometry.world).toBeGreaterThan(width===844?300:height*.5);
 await page.screenshot({path:`${evidence}/night-${width}.png`,fullPage:true});
 // A real simulation hit updates the existing button without destroying focus.
 await hud(page,'lin').focus();b.enemies=[{id:'hit',type:'walker',zone:'gate',x:315,y:400,hp:100,max:100,mode:'inside',attack:0,progress:0,stun:0}];b.paused=false;stepBattle(b,.1);b.paused=true;await publish();
 await expect(hud(page,'lin')).toHaveAttribute('aria-label',/健康52.5\/100/);await expect(hud(page,'lin')).toBeFocused();
 await hud(page,'lin').click();await expect(page.locator('#overlay')).toBeHidden();await page.locator('[data-action=more-night]').click();await page.locator('[data-action=actor-details]').click();await expect(page.getByTestId('crew-health-panel')).toBeVisible();await expect(page.locator('#battle-person')).toHaveValue('lin');expect((await snapshot(page)).paused).toBe(true);
 await expect(page.locator('.health-person-heading')).toContainText('林禾');await page.screenshot({path:`${evidence}/care-${width}.png`,fullPage:true});
 await page.locator('[data-tactic-command=retreat]').click();await expect.poll(async()=>(await snapshot(page)).people.find(p=>p.id==='lin').task?.type).toBe('retreat');
 expect(b.people[1].nightRole).toBe('guard');
 await page.locator('.health-row[data-person=chen]').click();await expect(page.getByTestId('crew-health-panel')).toContainText('无法再执行任务或治疗');await expect(page.locator('[data-tactic-command]')).toHaveCount(0);
  // A transfer uses the historical dead flag internally, but the person is
  // alive elsewhere and must not appear among this yard's casualties.
  b.people[4].dead=true;b.people[4].departed=true;await publish();await expect(hud(page,'xu')).toHaveCount(0);await expect(hud(page,'chen')).toContainText('已死亡');
 expect(errors).toEqual([]);
});

test('contextual alternatives queue the chosen actor, target and cost once while preserving their assignment',async({page})=>{
 const {b,publish}=await controlled(page);b.enemies=[{id:'rammer',type:'rammer',zone:'gate',x:240,y:475,hp:100,max:100,mode:'attack',attack:1,progress:0,stun:0}];await publish();
 await page.locator('[data-action=tactics-open]').click();const opportunity=page.locator('[data-tactic=gate-rammer]');await expect(opportunity).toContainText('重撞兽');
 await page.selectOption('#tactics-person','lin');const actor=b.people.find(p=>p.id==='lin'),assignment=[actor.nightRole,actor.zone],materials=b.resources.materials;
 await opportunity.locator('[data-tactic-command=heavy]').click();
 await expect.poll(async()=>(await snapshot(page)).people.find(p=>p.id==='lin').task?.type).toBe('heavy');expect(b.people[1].task.target).toBe('gate');expect(b.resources.materials).toBe(materials);expect([b.people[1].nightRole,b.people[1].zone]).toEqual(assignment);
 await expect(opportunity.locator('[data-tactic-command=heavy]')).toBeDisabled();await expect(opportunity).toContainText('已在执行这项任务');
 await page.screenshot({path:`${evidence}/tactics-390.png`,fullPage:true});
});

test('day health care uses browser persistence and shows the saved treatment on reload',async({page})=>{
 const state=createTestSession({day:8}).dawn;state.people[1].health=45;
 await installStorage(page);await seedSave(page,{state,runId:'crew-day',revision:1});await page.goto('/');await expect(hud(page,'lin').locator('strong')).toHaveText('45');
 await hud(page,'lin').click();await page.locator('[data-action=treat]').click();await expect(hud(page,'lin').locator('strong')).toHaveText('75');
 const saved=await readSave(page);expect(saved.state.resources.medicine).toBe(state.resources.medicine-1);expect(saved.state.ap).toBe(state.ap-1);
 await page.reload();await expect(hud(page,'lin').locator('strong')).toHaveText('75');await expect(hud(page,'lin')).toContainText('恢复中');
});
