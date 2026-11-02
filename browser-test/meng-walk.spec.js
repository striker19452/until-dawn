import {openTab} from './support/ui.js';
import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {initialCampaign,applyCampaignAction} from '../src/campaign.js';
import {artPoint} from '../client/scene-layout.js';

const registration=JSON.parse(readFileSync(new URL('../client/assets/meng-walk-v5.json',import.meta.url)));
const diagnostics=page=>page.locator('canvas').evaluate(c=>c.getYardDiagnostics());
async function clickArt(page,p){const d=await diagnostics(page),box=await page.locator('canvas').boundingBox();await page.mouse.click(box.x+box.width/2+(p.x-240)*d.metrics.cssScale,box.y+box.height/2+(p.y-d.metrics.centerY)*d.metrics.cssScale);}
function fixture(){
 let s=applyCampaignAction(initialCampaign(53),{type:'chooseRole',role:'repairman'});s.day=13;s.ap=40;s.resources.materials=100;
 for(const a of [{type:'beds'},{type:'beds'},...['lin','zhou','chen','meng'].map(person=>({type:'recruit',person}))])s=applyCampaignAction(s,a);
 s.people=s.people.filter(p=>['hero','meng'].includes(p.id));return s;
}
test('Meng keeps her bucket through all walk and idle frames, including turning around',async({page})=>{
 const errors=[],assets=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('meng-walk-v5')&&r.url().endsWith('.webp'))assets.push(r.url());});
 await page.route('**/api/campaign',route=>route.fulfill({json:{state:fixture(),runId:'meng-walk',revision:1}}));await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');
 await expect.poll(async()=>(await diagnostics(page)).tokens.find(t=>t.id==='p-meng')?.texture).toBe('people-meng');
 expect((await diagnostics(page)).tokens.find(t=>t.id==='p-hero').texture).toBe('people-a');
 const body=(await diagnostics(page)).tokens.find(t=>t.id==='p-meng').bodyBounds;await clickArt(page,{x:body.left+body.width*.6,y:body.top+body.height*.3});
 await expect.poll(async()=>(await diagnostics(page)).movement.actor).toBe('meng');await clickArt(page,artPoint({x:355,y:410}));
 const right=await page.locator('canvas').evaluate(c=>new Promise(resolve=>{const rows=[];function sample(){const p=c.getYardDiagnostics().tokens.find(t=>t.id==='p-meng');if(p?.moving)rows.push(p);if(rows.length<90)requestAnimationFrame(sample);else resolve(rows);}requestAnimationFrame(sample);}));
 expect([...new Set(right.map(p=>p.frame))].sort()).toEqual(['0','1','2','3']);expect(right.every(p=>!p.flipX&&p.texture==='people-meng')).toBe(true);
 await expect.poll(async()=>(await diagnostics(page)).tokens.find(t=>t.id==='p-meng').moving,{timeout:10000}).toBe(false);expect((await diagnostics(page)).tokens.find(t=>t.id==='p-meng').frame).toBe('1');
 await page.screenshot({path:'test-results/meng-bucket-idle.png',fullPage:true});
 await clickArt(page,artPoint({x:105,y:410}));await expect.poll(async()=>(await diagnostics(page)).tokens.find(t=>t.id==='p-meng').flipX).toBe(true);
 await page.screenshot({path:'test-results/meng-bucket-left.png',fullPage:true});
 // Inspect the actual delivered pixels in every cell: the metal pail must be
 // present on the near-hand side, including the passing/idle and third poses.
 const buckets=await page.evaluate(async({url,frames})=>{
  const image=new Image();image.src=url;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
  return frames.map(f=>{const [x0,y0,w,h]=f.rect,data=ctx.getImageData(x0,y0,w,h).data,cx=f.origin[0]*w;let count=0,xsum=0;
   for(let y=Math.floor(h*.5);y<h*.76;y++)for(let x=Math.max(0,Math.floor(cx-w*.4));x<cx-w*.1;x++){
    const i=(y*w+x)*4,r=data[i],g=data[i+1],b=data[i+2],value=(r+g+b)/3;
    if(data[i+3]>200&&value>80&&value<210&&Math.max(r,g,b)-Math.min(r,g,b)<36){count++;xsum+=x;}
   }return {count,offset:(xsum/count-cx)/w};
  });
 },{url:assets[0],frames:registration.frames});
 for(const bucket of buckets){expect(bucket.count).toBeGreaterThan(500);expect(bucket.offset).toBeLessThan(-.15);}
 expect(Math.max(...buckets.map(b=>b.offset))-Math.min(...buckets.map(b=>b.offset))).toBeLessThan(.08);expect(errors).toEqual([]);
});

test('the repaired Meng atlas loads when she joins without adding a download to an empty yard',async({page})=>{
 let state=fixture();state.people=state.people.filter(p=>p.id==='hero');const assets=[];
 page.on('request',r=>{if(r.url().includes('meng-walk-v5')&&r.url().endsWith('.webp'))assets.push(r.url());});
 await page.route('**/api/campaign',route=>route.fulfill({json:{state,runId:'meng-lazy',revision:1}}));
 await page.route('**/api/campaign/action',route=>{state=applyCampaignAction(state,route.request().postDataJSON().action);return route.fulfill({json:{state,runId:'meng-lazy',revision:2}});});
 await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');expect(assets).toEqual([]);
 await openTab(page,'members');await page.locator('[data-action=member-view][data-person=visitors]').click();await page.locator('#candidate-view').selectOption('meng');
 await page.locator('[data-action=recruit][data-person=meng]').click();await page.locator('[data-action=close-overlay]').click();
 await expect.poll(async()=>(await diagnostics(page)).tokens.find(t=>t.id==='p-meng')?.texture).toBe('people-meng');expect(assets).toHaveLength(1);
});
