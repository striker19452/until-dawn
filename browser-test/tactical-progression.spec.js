import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {installStorage,seedSave,readSave} from './support/storage.js';
import {openTab} from './support/ui.js';
import {createTestSession} from '../src/test-mode.js';
import {createBattle,battleCommand} from '../src/battle.js';
import {settleNight} from '../src/campaign.js';
import {tacticalNight} from '../test/support/tactical-night.js';
import {ENEMIES,ZONES} from '../src/content.js';
import {PHASE_CREATURES} from '../src/phase-creatures.js';

const evidence='.local/tactical-progression';mkdirSync(evidence,{recursive:true});
const diagnostics=page=>page.locator('canvas').evaluate(c=>c.getYardDiagnostics());
for(const [width,height]of [[320,568],[390,844],[1280,900]])test(`new creatures have distinct sprites, portraits and readable counters at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const state=createTestSession({day:22}).snapshot.state;state.flags.seenTypes=Object.keys(ENEMIES);
 const b=createBattle(state,'phase-art',{autoPause:false});b.boss=null;b.challenge=null;b.schedule=[{at:9999,type:'walker',zone:'gate'}];
 b.enemies=Object.keys(PHASE_CREATURES).map((type,i)=>({id:'new-'+i,type,zone:ZONES[i].id,x:ZONES[i].x,y:ZONES[i].y,hp:ENEMIES[type].hp,max:ENEMIES[type].hp,mode:'attack',attack:1,progress:2,stun:0,called:false}));
 const publish=()=>page.evaluate(b=>window.__tacticWorker.dispatchEvent(new MessageEvent('message',{data:{type:'state',battle:b,result:null,steps:0}})),b);
 await page.exposeFunction('__tacticMessage',async m=>{if(m.type==='command')battleCommand(b,m.action);if(m.type!=='dispose')await publish();});
 await page.addInitScript(()=>{const Native=window.Worker;window.Worker=class extends EventTarget{constructor(url,options){super();if(!String(url).includes('night-worker'))return new Native(url,options);window.__tacticWorker=this;queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:{type:'ready'}})));}postMessage(m){window.__tacticMessage(m);}terminate(){}};});
 await installStorage(page);await seedSave(page,{state,runId:'phase-art',revision:1});await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await page.locator('[data-action=start-night]').click();
 await expect.poll(()=>diagnostics(page).then(d=>d.tokens.filter(t=>t.texture==='creatures-phase').length)).toBe(4);
 const tokens=(await diagnostics(page)).tokens.filter(t=>t.texture==='creatures-phase');expect(new Set(tokens.map(t=>Math.floor(Number(t.frame)/4))).size).toBe(4);expect(tokens.every(t=>t.visible||t.outlineVisible)).toBe(true);expect(tokens.every(t=>Number.isFinite(t.bodyBounds?.top))).toBe(true);
 await page.locator('#world').screenshot({path:`${evidence}/creatures-${width}.png`});
 await openTab(page,'journal');await page.locator('[data-group=journal][data-value=bestiary]').click();
 for(const [id,def]of Object.entries(PHASE_CREATURES)){
  await page.locator(`[data-action=species][data-species=${id}]`).click();const entry=page.getByTestId('bestiary-entry');await expect(entry).toContainText(def.name);await expect(entry).toContainText(def.counter);await expect(entry.locator('svg image')).toHaveAttribute('href',/atlas-/);
  expect(await page.locator('#sheet-body').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 }
 await page.screenshot({path:`${evidence}/bestiary-${width}.png`,fullPage:true});expect(errors).toEqual([]);
});
test('daily preview exposes the real positioning problem and the required goal',async({page})=>{
 const state=createTestSession({day:13}).dawn;await installStorage(page);await seedSave(page,{state,runId:'tactic-preview',revision:1});await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');
 await openTab(page,'radio');const card=page.getByTestId('night-challenge');await expect(card).toContainText('低疲劳');await expect(card).toContainText('本夜目标必须完成');await expect(card).toContainText('8秒 后左栏');await expect(card).toContainText('10秒 后右栏');
 await page.screenshot({path:`${evidence}/preview-13.png`,fullPage:true});
});
test('missed objective explains the tactical failure and retry restores the real dawn in IndexedDB',async({page})=>{
 const {base,b}=tacticalNight({day:20,policy:'stacked',debug:true}),state=settleNight(base,b),dawn=structuredClone(base);dawn.phase='day';delete dawn.preparationBase;
 await installStorage(page);await seedSave(page,{state,runId:'tactic-retry',revision:1},dawn);await page.goto('/');
 await expect(page.getByTestId('ending-screen')).toBeVisible();await expect(page.getByTestId('ending-reason')).toContainText('喷污');await expect(page.locator('.ending-kicker')).toContainText('本夜目标未完成');
 await page.screenshot({path:`${evidence}/missed-objective.png`,fullPage:true});page.once('dialog',dialog=>dialog.accept());await page.locator('.ending-primary').click();await expect(page.locator('#phase')).toHaveText('白天经营');const saved=await readSave(page);expect(saved.state.day).toBe(20);expect(saved.state.resources).toEqual(dawn.resources);expect(saved.state.people).toEqual(dawn.people);
});
for(const day of [7,28])test(`boss ${day} follower encounter survives final settlement and browser reload`,async({page})=>{
 const {base,b}=tacticalNight({day,debug:true}),runId='follower-'+day,revision=1;b.id=`local-${runId}-${revision}`;
 const result=settleNight(base,b);
 await page.exposeFunction('__completeFollower',()=>({type:'state',battle:b,result,steps:Math.round(b.elapsed*20)}));
 await page.addInitScript(()=>{const Native=window.Worker;window.Worker=class extends EventTarget{constructor(url,options){super();if(!String(url).includes('night-worker'))return new Native(url,options);queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:{type:'ready'}})));}postMessage(m){if(m.type==='init')window.__completeFollower().then(data=>this.dispatchEvent(new MessageEvent('message',{data})));}terminate(){}};});
 await installStorage(page);await seedSave(page,{state:base,runId,revision});await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await page.locator('[data-action=start-night]').click();
 await expect.poll(()=>readSave(page).then(s=>s.revision)).toBe(2);
 const expected=day===7?'bladebeast':'echomantis',saved=await readSave(page);expect(saved.state.flags.seenTypes).toContain(expected);expect(saved.state.report.boss.defeated).toBe(true);expect(saved.state.phase).toBe(day===28?'rescued':'report');
 await page.reload();const reloaded=await readSave(page);expect(reloaded.state.flags.seenTypes).toContain(expected);expect(reloaded.state.resources).toEqual(saved.state.resources);expect(reloaded.revision).toBe(2);
});
