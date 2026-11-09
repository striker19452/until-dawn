import {test,expect} from '@playwright/test';
import {createTestSession} from '../src/test-mode.js';
import {createBattle,battleCommand} from '../src/battle.js';
import {installStorage,seedSave} from './support/storage.js';

const geometry=page=>page.locator('#world').evaluate(el=>{
 const d=el.querySelector('canvas').getYardDiagnostics(),r=el.getBoundingClientRect(),p=document.querySelector('#panel');
 return {x:r.x,y:r.y,width:r.width,height:r.height,paintWidth:d.metrics.width,paintHeight:d.metrics.height,scale:d.metrics.cssScale,center:d.metrics.centerY,dock:p.getBoundingClientRect().height,
  viewport:[innerWidth,innerHeight],page:[document.documentElement.scrollWidth,document.documentElement.scrollHeight]};
});
async function mount(page,day){
 const state=createTestSession({day}).snapshot.state,b=createBattle(state,'stable-scene',{autoPause:false});
 b.challenge=null;b.paused=true;b.schedule=[{at:9999,type:'walker',zone:'gate'}];b.zones[0].hp=40;
 b.enemies=[{id:'target',type:'caller',zone:'gate',x:240,y:475,hp:1000,max:1000,mode:'attack',progress:1,attack:0,stun:1000}];
 await page.exposeFunction('__stableMessage',m=>{try{if(m.type==='command')battleCommand(b,m.action);return {type:'state',battle:b,result:null,steps:0};}catch(error){return {type:'error',message:error.message,commandId:m.commandId};}});
 await page.addInitScript(()=>{const Native=window.Worker;window.Worker=class extends EventTarget{
  constructor(url,options){super();if(!String(url).includes('night-worker'))return new Native(url,options);window.__stableWorker=this;queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:{type:'ready'}})));}
  postMessage(m){if(m.type!=='dispose')window.__stableMessage(m).then(data=>this.dispatchEvent(new MessageEvent('message',{data})));}terminate(){}
 };});
 await installStorage(page);await seedSave(page,{state,runId:'stable-scene',revision:1});await page.goto('/');
 await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await page.locator('[data-action=start-night]').click();await expect(page.locator('#battle-person')).toBeVisible();
 return {b,publish:()=>page.evaluate(b=>window.__stableWorker.dispatchEvent(new MessageEvent('message',{data:{type:'state',battle:b,result:null,steps:0}})),b)};
}

for(const [width,height,day]of [[320,568,8],[390,844,8],[844,390,8],[1280,900,8],[320,568,14],[390,844,14],[1280,600,8],[960,540,8]])test(`courtyard size stays steady through orders, extra controls and alarms at ${width}x${height}, day ${day}`,async({page})=>{
 await page.setViewportSize({width,height});const errors=[];page.on('pageerror',e=>errors.push(e.message));const {b,publish}=await mount(page,day);
 await expect.poll(()=>geometry(page).then(g=>g.height)).toBeGreaterThan(100);
 await expect.poll(()=>geometry(page).then(g=>Math.max(Math.abs(g.paintWidth-g.width),Math.abs(g.paintHeight-g.height)))).toBeLessThan(1);
 const before=await geometry(page);
 const stable=async()=>{
  await expect.poll(()=>geometry(page).then(g=>Math.max(Math.abs(g.width-before.width),Math.abs(g.height-before.height),Math.abs(g.x-before.x),Math.abs(g.y-before.y)))).toBeLessThan(1);
  const after=await geometry(page);expect(after.scale).toBeCloseTo(before.scale,5);expect(after.center).toBe(before.center);
  expect(after.page[0]).toBeLessThanOrEqual(width);expect(after.page[1]).toBeLessThanOrEqual(height+1);
 };
 await page.locator('#panel [data-command=heavy]').click();await expect(page.locator('#panel .quick-current')).toContainText('蓄力重击');await stable();
 await page.locator('#crew-hud [data-person=lin]').click();await stable();await page.locator('#crew-hud [data-person=hero]').click();await stable();
 for(let i=0;i<2;i++){await page.locator('[data-action=more-night]').click();await stable();await page.locator('[data-action=more-night]').click();await stable();}
 b.reason='首次发现啼叫者：它正在蓄势召援。请安排重击打断；也可以先检查防线和同伴体力。';b.pauseReason=b.reason;await publish();
 await expect(page.locator('#notice .notice')).toBeVisible();await stable();
 if(width<960){const alert=await page.locator('#notice').boundingBox();expect(alert.y).toBeGreaterThanOrEqual(before.y);expect(alert.y+alert.height).toBeLessThanOrEqual(before.y+before.height);}
 if(width<960||height<640){
  const at=await page.locator('#world').evaluate(el=>{const d=el.querySelector('canvas').getYardDiagnostics(),r=el.getBoundingClientRect(),m=d.metrics,t=d.tokens.find(t=>t.id==='e-target').bodyBounds;return {x:r.x+m.width/2+(t.left+t.width/2-240)*m.cssScale,y:r.y+m.height/2+(t.top+t.height/2-m.centerY)*m.cssScale};});
  await page.mouse.click(at.x,at.y);await expect(page.locator('#enemy-tap-feedback')).toContainText('已点中：啼叫者');await expect(page.locator('#error')).toContainText('已有成员');await page.locator('[data-action=dismiss-error]').click();await stable();
 }
 await page.screenshot({path:`.local/stable-scene/alert-${width}-${day}.png`});
 b.reason='已暂停，可以安排命令。';b.pauseReason='';await publish();await expect(page.locator('#notice')).toHaveAttribute('data-routine','true');if(width<960||height<640)await expect(page.locator('#notice')).toBeHidden();await stable();
 await page.locator('#panel [data-command=cancel]').scrollIntoViewIfNeeded();await page.locator('#panel [data-command=cancel]').click();await expect(page.locator('#panel .quick-current')).toHaveCount(0);await stable();
 await page.screenshot({path:`.local/stable-scene/idle-${width}-${day}.png`});expect(errors).toEqual([]);
});
