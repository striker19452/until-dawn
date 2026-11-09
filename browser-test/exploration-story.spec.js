import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {initialCampaign,applyCampaignAction as act,makePerson,settleNight} from '../src/campaign.js';
import {createBattle} from '../src/battle.js';
import {localNightId} from '../src/local-night.js';
import {encounterView,explorationStory} from '../src/exploration-story.js';
import {installStorage,seedSave,readSave} from './support/storage.js';
import {openTab} from './support/ui.js';

const evidence='.local/exploration-story';
function day(seed){const s=act(initialCampaign(seed),{type:'chooseRole',role:'repairman'});s.day=15;s.resources={food:80,water:80,materials:80,fuel:20,medicine:10,parts:10};return s;}
function find(kind,crew=false){
 const site={letter:'alley',medicine:'clinic',shared:'alley'}[kind];
 for(let seed=1;seed<500;seed++){
  const base=day(seed);if(crew){base.people.push(makePerson('lin','林禾','园艺师','survival'));base.beds=2;}
  const found=act(base,{type:'search',site,escort:crew?'lin':undefined});if(encounterView(found)?.kind===kind)return {base,found,site};
 }throw Error('No encounter fixture');
}
async function boot(page,state){await installStorage(page);await seedSave(page,{state,revision:1,runId:'story-ui'});await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');}
const stories=page=>page.locator('[data-action=explore-stories]').click();
const searchTab=page=>page.locator('[data-group=explore][data-value=search]').click();

for(const [width,height] of [[320,568],[390,844],[1280,900]])test(`exploration ${width}: discover, persist, promise, travel and deliver with a visible follow-up`,async({page})=>{
 mkdirSync(evidence,{recursive:true});await page.setViewportSize({width,height});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const {base,found}=find('letter');await boot(page,base);await openTab(page,'explore');await page.locator('#site-view').selectOption('alley');await page.locator('[data-action=search]').click();
 await expect(page.getByTestId('exploration-encounter')).toContainText('门缝里的一封家书');const discovered=await readSave(page);expect(encounterView(discovered.state).id).toBe(encounterView(found).id);
 await expect(page.locator('.exploration-story>h2')).toBeInViewport();await expect(page.locator('.resource-receipt')).toHaveCount(0);await page.screenshot({path:`${evidence}/encounter-${width}.png`,fullPage:true});await page.reload();await openTab(page,'explore');await stories(page);await expect(page.getByTestId('exploration-encounter')).toContainText('门缝里的一封家书');
 await page.locator('[data-action=explore-choice][data-choice=deliver]').click();const promised=await readSave(page);expect(promised.state.ap).toBe(discovered.state.ap);expect(promised.state.resources).toEqual(discovered.state.resources);
 await expect(page.getByTestId('exploration-goals')).toContainText('社区联络点');await expect(page.locator('[data-action=explore-goal]')).toBeDisabled();
 await searchTab(page);await page.locator('#site-view').selectOption('contact');await page.locator('[data-action=search]').click();await stories(page);await expect(page.locator('[data-action=explore-goal]')).toBeEnabled();await page.locator('[data-action=explore-goal]').click();
 await expect(page.getByTestId('exploration-replies')).toContainText('第17天');const fulfilled=await readSave(page);expect(explorationStory(fulfilled.state).goals[0].status).toBe('awaiting');await expect(page.locator('[data-action=explore-goal]')).toHaveCount(0);
 expect(await page.locator('#sheet-body').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);await expect(page.locator('.resource-receipt')).toHaveCount(0);await page.screenshot({path:`${evidence}/promise-${width}.png`,fullPage:true});expect(errors).toEqual([]);
});

test('a trusting response creates its unique memory, updates the relationship view and survives reload',async({page})=>{
 const {found}=find('shared',true);found.flags.explorationStory.bonds.lin=2;await boot(page,found);await openTab(page,'explore');await stories(page);
 await expect(page.locator('[data-choice=trust]')).toBeEnabled();const before=await readSave(page);await page.locator('[data-choice=trust]').click();
 const after=await readSave(page);expect(after.state.memories).toContain('与林禾说过的牵挂');expect(after.state.resources).toEqual(before.state.resources);expect(after.state.ap).toBe(before.state.ap);
 await openTab(page,'members');await page.locator('[data-action=member-view][data-person=lin]').click();await page.locator('[data-group=member][data-value=story]').click();await expect(page.getByTestId('relationship-panel')).toContainText('相互信赖');await expect(page.getByTestId('relationship-panel')).toContainText('3/6');
 await page.screenshot({path:`${evidence}/relationship-390.png`,fullPage:true});await page.reload();expect((await readSave(page)).state.memories).toContain('与林禾说过的牵挂');
});

test('real browser saves receive a delayed reply once after two morning transitions',async({page})=>{
 let {found}=find('medicine');const e=encounterView(found);found=act(found,{type:'explorationChoice',encounter:e.id,choice:'promise'});found=act(found,{type:'search',site:'market'});found=act(found,{type:'explorationGoal',goal:explorationStory(found).goals[0].id});
 await page.exposeFunction('__storyNight',base=>{const b=createBattle(base.state,localNightId(base));b.finished=true;return {type:'state',battle:b,result:settleNight(base.state,b),steps:0};});
 await page.addInitScript(()=>{const Native=window.Worker;window.Worker=class extends EventTarget{constructor(url,options){super();if(!String(url).includes('night-worker'))return new Native(url,options);queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:{type:'ready'}})));}postMessage(message){if(message.type==='init')window.__storyNight(message.base).then(data=>this.dispatchEvent(new MessageEvent('message',{data})));}terminate(){}};});
 await boot(page,found);const medicine=found.resources.medicine;
 for(let i=0;i<2;i++){
  await page.locator('[data-action=prepare]').click();await page.locator('[data-action=start-night]').click();await expect(page.locator('#phase')).toHaveText('天亮战报');await page.locator('[data-action=close-overlay]').click();await page.locator('[data-action=next]').click();await expect(page.locator('#phase')).toHaveText('白天经营');
  const saved=await readSave(page);expect(saved.state.resources.medicine).toBe(medicine+(i===1?2:0));
 }
 await openTab(page,'journal');await page.locator('[data-group=journal][data-value=journeys]').click();await expect(page.getByTestId('exploration-journal')).toContainText('邻居已稳定下来');await expect(page.getByTestId('exploration-replies')).toHaveCount(0);
 await page.reload();expect((await readSave(page)).state.resources.medicine).toBe(medicine+2);
});

test('night journal is readable and all narrative actions are disabled during defense',async({page})=>{
 const {found}=find('letter');const ready=act(found,{type:'prepare'});await boot(page,ready);await page.locator('[data-action=start-night]').click();await expect(page.locator('#battle-person')).toBeVisible();
 await openTab(page,'journal');await page.locator('[data-group=journal][data-value=journeys]').click();await expect(page.getByTestId('exploration-encounter')).toBeVisible();
 for(const button of await page.locator('[data-action=explore-choice]').all())await expect(button).toBeDisabled();expect((await readSave(page)).state.flags.explorationStory).toEqual(ready.flags.explorationStory);
});

test('leaving a discovery pending does not interrupt a later search or replace that discovery',async({page})=>{
 const {found}=find('letter'),pendingId=encounterView(found).id;await boot(page,found);await openTab(page,'explore');
 await expect(page.locator('#site-view')).toBeVisible();await page.locator('#site-view').selectOption('clinic');await page.locator('[data-action=search]').click();
 await expect(page.locator('#site-view')).toBeVisible();await expect(page.getByTestId('exploration-encounter')).toHaveCount(0);expect(encounterView((await readSave(page)).state).id).toBe(pendingId);
});
