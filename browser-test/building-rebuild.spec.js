import {test,expect} from '@playwright/test';
import {initialCampaign,applyCampaignAction} from '../src/campaign.js';
import {BUILDINGS} from '../src/content.js';
import {mkdirSync} from 'node:fs';
const evidence='.local/building-states-v8/screens';
const diagnostics=page=>page.locator('canvas').evaluate(c=>c.getYardDiagnostics());
function fixture(types=Object.keys(BUILDINGS).slice(0,6)){
 const s=applyCampaignAction(initialCampaign(53),{type:'chooseRole',role:'repairman'});s.resources.materials=50;
 s.buildings=types.map((type,i)=>({id:'b'+i,type,plot:i,hp:10,level:1,branch:'normal',age:0,enabled:true}));return s;
}
test('all eight facilities have distinct actual damaged and destroyed sprite frames with stable feet',async({page})=>{
 mkdirSync(evidence,{recursive:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));const seen=new Set();
 let s=fixture();await page.route('**/api/campaign',route=>route.fulfill({json:{state:s,runId:'eight-facility-art',revision:1}}));
 for(const types of [Object.keys(BUILDINGS).slice(0,6),Object.keys(BUILDINGS).slice(6)]){
  s=fixture(types);
  for(const [hp,state]of [[10,'intact'],[5,'damaged'],[0,'destroyed']]){
   s.buildings.forEach(b=>b.hp=hp);await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');
   const d=await diagnostics(page);
   for(const building of s.buildings){const component=d.components.find(c=>c.id==='building-'+building.id);expect(component.state).toBe(state);expect(component.plot).toBe(building.plot);expect(component.hp).toBe(hp);expect(component.occludes).toBe(hp>0);
    if(state!=='intact'){expect(component.texture).toBe('building-states');expect(component.frame).toBe(building.type+'-'+state);seen.add(component.frame);}
    expect(component.bounds.bottom).toBeGreaterThan(component.depth-5);expect(component.bounds.bottom).toBeLessThan(component.depth+5);
   }
   await page.screenshot({path:`${evidence}/facilities-${types[0]}-${state}.png`,fullPage:true});
  }
 }
 expect(seen.size).toBe(16);expect(errors).toEqual([]);
});

for(const width of [320,390])test(`a ruin can rebuild into a different new facility in place at ${width}px`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width,height:width===320?568:844});let s=fixture(),revision=1;Object.assign(s.buildings[0],{hp:0,level:2,branch:'steady',age:1});const original=structuredClone(s);
 await page.route('**/api/campaign',route=>route.fulfill({json:{state:s,runId:'rebuild-ui',revision}}));
 await page.route('**/api/campaign/action',async route=>{const request=route.request().postDataJSON();s=applyCampaignAction(s,request.action);await route.fulfill({json:{state:s,runId:'rebuild-ui',revision:++revision}});});
 await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');const originalComponents=(await diagnostics(page)).components;
 await page.locator('[data-action=drawer][data-panel=build]').click();await expect(page.getByTestId('building-card')).toContainText('已损毁');await expect(page.locator('.building-state-preview')).toBeVisible();await expect(page.locator('[data-action=repair-building]')).toHaveCount(0);
 const select=page.locator('[data-rebuild-id=b0]');expect(await select.locator('option[value=generator]').count()).toBe(0,'existing unique facility cannot be duplicated');await select.selectOption('water');await expect(page.locator('[data-action=rebuild-building]')).toContainText('2行动5建材');await page.screenshot({path:`${evidence}/rebuild-choice-${width}.png`,fullPage:true});
 await page.locator('[data-action=rebuild-building]').click();await expect(page.getByTestId('building-health')).toContainText('10/10');const fresh=s.buildings[0];expect(fresh.type).toBe('water');expect(fresh.plot).toBe(0);expect(fresh.level).toBe(1);expect(fresh.branch).toBe('normal');expect(fresh.age).toBe(0);expect(fresh.id).not.toBe('b0');expect(s.ap).toBe(original.ap-2);expect(s.resources.materials).toBe(original.resources.materials-5);expect(s.buildings.slice(1)).toEqual(original.buildings.slice(1));
 await page.locator('[data-action=close-overlay]').click();await expect.poll(async()=>(await diagnostics(page)).components.some(c=>c.id==='building-'+fresh.id&&c.state==='intact')).toBe(true);const components=(await diagnostics(page)).components;for(const old of originalComponents.filter(c=>c.id.startsWith('building-')&&c.id!=='building-b0')){const next=components.find(c=>c.id===old.id);expect(next.depth).toBe(old.depth);expect(next.bounds).toEqual(old.bounds);}
 await page.screenshot({path:`${evidence}/rebuilt-water-${width}.png`,fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
