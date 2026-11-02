import {test,expect} from '@playwright/test';
import {initialCampaign,applyCampaignAction} from '../src/campaign.js';
import {createBattle} from '../src/battle.js';
import {openTab} from './support/ui.js';
const diagnostics=page=>page.locator('canvas').evaluate(c=>c.getYardDiagnostics());
const puppy=async page=>(await diagnostics(page)).dog;
const home=(seed=53)=>applyCampaignAction(applyCampaignAction(initialCampaign(seed),{type:'chooseRole',role:'repairman'}),{type:'adoptDog'});
async function boot(page,state){await page.route('**/api/campaign',route=>route.fulfill({json:{state,runId:'dog-art',revision:1}}));await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await expect.poll(async()=>!!await puppy(page)).toBe(true);}

test('adoption saves on refresh, appears in the yard and adds a food breakdown',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.locator('[data-action=role][data-role=repairman]').click();await expect(page.locator('.shell')).toHaveAttribute('data-phase','day');await expect(page.locator('[data-action=close-overlay]')).not.toBeVisible();
 await openTab(page,'dog');await page.locator('[data-action=adopt-dog]').click();await expect(page.getByTestId('dog-card')).toContainText('小麦有家了');
 await page.reload();await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await expect.poll(async()=>!!await puppy(page)).toBe(true);
 await page.locator('[data-action=rations][data-resource=food]').click();await expect(page.getByTestId('dog-rations')).toContainText('+1食物');expect(errors).toEqual([]);
});

for(const width of [390,1280])test(`puppy ${width}: random poses and affectionate interaction render without input`,async({page})=>{
 await page.setViewportSize({width,height:width===390?844:900});const errors=[];page.on('pageerror',e=>errors.push(e.message));await boot(page,home());
 const actions=new Set(),walkFrames=new Set();let hugged=false;
 for(let i=0;i<160;i++){const dog=await puppy(page);actions.add(dog.action);if(dog.moving&&dog.texture==='puppy-walk')walkFrames.add(dog.frame);if(dog.cuddling){hugged=true;break;}await page.waitForTimeout(250);}
 expect(actions.size).toBeGreaterThan(1);expect(hugged).toBe(true);
 expect(walkFrames.size).toBeGreaterThanOrEqual(3);
 await page.screenshot({path:`test-results/puppy-cuddle-${width}.png`,fullPage:true});const d=await diagnostics(page),person=d.tokens.find(p=>p.id==='p-'+d.dog.personId);expect(d.dog.frame).toBeGreaterThanOrEqual(14);expect(person.facing).toBe(Math.sign(d.dog.screenX-person.x));expect(person.flipX).toBe(person.facing<0);expect(errors).toEqual([]);
});

test('when the puppy approaches from the left, the person turns left to greet it',async({page})=>{
 await boot(page,home(5));await expect.poll(async()=>{const d=await diagnostics(page),p=d.tokens.find(t=>t.id==='p-hero');return !!d.dog?.cuddling&&d.dog.screenX<p.x&&p.facing===-1&&p.flipX;},{timeout:40000}).toBe(true);
 await page.screenshot({path:'test-results/puppy-greeting-left.png',fullPage:true});
});

test('walking uses all four distance-driven poses on the ground',async({browser})=>{
 const context=await browser.newContext({viewport:{width:1280,height:900},deviceScaleFactor:2}),page=await context.newPage();await boot(page,home(3));
 const frames=new Set(),distances=[];
 await expect.poll(async()=>{const d=await diagnostics(page),dog=d.dog;if(dog.moving&&dog.texture==='puppy-walk'){frames.add(dog.frame);distances.push(dog.walkDistance);}return frames.size;},{timeout:30000,intervals:[40]}).toBe(4);
 expect(distances.at(-1)).toBeGreaterThan(distances[0]);await page.screenshot({path:'test-results/puppy-walking.png',fullPage:true});await context.close();
});

test('night bark pose and its target freeze with the paused battle',async({page})=>{
 const s=applyCampaignAction(home(),{type:'prepare'}),b=createBattle(s,'dog-frozen');Object.assign(b.dog,{barkUntil:20,barkTarget:{x:240,y:475}});
 await page.exposeFunction('__dogMessage',async m=>{if(m.type==='init')await page.evaluate(b=>window.__dogWorker.dispatchEvent(new MessageEvent('message',{data:{type:'state',battle:b}})),b);});
 await page.addInitScript(()=>{const RealWorker=window.Worker;window.Worker=class extends EventTarget{constructor(url,options){super();if(!String(url).includes('night-worker'))return new RealWorker(url,options);window.__dogWorker=this;queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:{type:'ready'}})));}postMessage(m){window.__dogMessage(m);}terminate(){}};});
 await boot(page,s);await page.locator('[data-action=start-night]').click();await expect.poll(async()=>(await puppy(page)).barking).toBe(true);
 const frozen=await puppy(page);await page.waitForTimeout(400);expect(await puppy(page)).toEqual(frozen);await page.screenshot({path:'test-results/puppy-night-bark.png',fullPage:true});
 const walking=structuredClone(b);walking.dog.barkUntil=0;walking.dog.moving=true;
 await page.evaluate(state=>window.__dogWorker.dispatchEvent(new MessageEvent('message',{data:{type:'state',battle:state}})),walking);
 await expect.poll(async()=>(await puppy(page)).texture).toBe('puppy-walk');const frozenWalk=await puppy(page);await page.waitForTimeout(400);expect(await puppy(page)).toEqual(frozenWalk);
});
