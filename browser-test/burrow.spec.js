import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {initialCampaign,applyCampaignAction as act} from '../src/campaign.js';
import {createBattle,stepBattle} from '../src/battle.js';
import {ENEMIES,ZONES} from '../src/content.js';
import {installStorage,seedSave} from './support/storage.js';

const evidence='.local/burrow-animation';mkdirSync(evidence,{recursive:true});
const diag=page=>page.locator('canvas').evaluate(c=>c.getYardDiagnostics());
function fixture(zone){
 let s=act(initialCampaign(53),{type:'chooseRole',role:'watchman'});s.day=16;s.people[0].nightRole='sleep';s.flags.seenTypes=Object.keys(ENEMIES);s=act(s,{type:'prepare'});
 const b=createBattle(s,`burrow-${zone}`,{autoPause:false}),z=ZONES.find(z=>z.id===zone);
 Object.assign(b,{paused:true,challenge:null,boss:null,schedule:[{at:9999,type:'walker',zone:'gate'}],events:[]});
 b.enemies=[{id:'digger',type:'burrower',zone,x:z.x,y:z.y,hp:1000,max:1000,mode:'attack',stun:0,attack:0,progress:0}];
 return {s,b};
}
async function mount(page,f){
 const publish=()=>page.evaluate(b=>window.__burrowWorker.dispatchEvent(new MessageEvent('message',{data:{type:'state',battle:b,result:null,steps:0}})),f.b);
 await page.exposeFunction('__burrowMessage',async m=>{if(m.type!=='dispose')await publish();});
 await page.addInitScript(()=>{const Native=window.Worker;window.Worker=class extends EventTarget{constructor(url,options){super();if(!String(url).includes('night-worker'))return new Native(url,options);window.__burrowWorker=this;queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:{type:'ready'}})));}postMessage(m){window.__burrowMessage(m);}terminate(){}};});
 await installStorage(page);await seedSave(page,{state:f.s,runId:'burrow-ui',revision:1});
 await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await page.locator('[data-action=start-night]').click();
 await expect.poll(()=>diag(page).then(d=>d.tokens.some(t=>t.id==='e-digger'))).toBe(true);
 return publish;
}
for(const [width,reduced] of [[390,false],[1280,false],[320,true]])test(`burrow crossing remains legible and pause-safe at ${width}px${reduced?' with reduced motion':''}`,async({page})=>{
 await page.setViewportSize({width,height:width===1280?900:844});if(reduced)await page.emulateMedia({reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));const f=fixture('backLeft'),publish=await mount(page,f);
 for(const zone of ['backLeft','backRight']){
  if(zone==='backRight'){const next=fixture(zone);f.s=next.s;f.b=next.b;await publish();}
  let at=0;
  for(const [time,phase] of [[1.95,null],[2.15,'sink'],[2.5,'tunnel'],[2.85,'emerge'],[3,null]]){
   f.b.paused=false;for(let i=0;i<Math.round((time-at)*20);i++)stepBattle(f.b,.05);f.b.paused=true;at=time;await publish();
   await expect.poll(()=>diag(page).then(d=>d.tokens.find(t=>t.id==='e-digger')?.burrowVisual?.phase||null)).toBe(phase);
   if(time===3)await expect.poll(()=>diag(page).then(d=>d.feedback.effects.some(e=>e.type==='dig'))).toBe(true);
   const d=await diag(page),body=d.tokens.find(t=>t.id==='e-digger');
   if(phase){
    expect(d.feedback.effects.some(e=>e.type==='burrow'&&e.phase===phase)).toBe(true);
    if(phase==='tunnel'){expect(body.alpha).toBe(0);expect(body.burrowVisual.visible).toBe(0);}
    else{expect(body.burrowVisual.visible).toBeGreaterThan(0);expect(body.burrowVisual.visible).toBeLessThan(1);}
    if(reduced){expect(body.burrowCrop).toBeUndefined();expect(body.spriteY).toBe(body.y);}
    else expect(body.burrowCrop).toBeLessThan(1);
    await page.waitForTimeout(100);expect((await diag(page)).tokens.find(t=>t.id==='e-digger')).toEqual(body);
   }else{expect(body.alpha).toBe(1);expect(body.burrowCrop).toBeUndefined();}
   await page.locator('#world').screenshot({path:`${evidence}/${width}-${zone}-${phase||time}.png`});
  }
 }
 expect(errors).toEqual([]);
});
