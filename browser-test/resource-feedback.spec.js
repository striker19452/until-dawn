import {openTab} from './support/ui.js';
import {test,expect} from '@playwright/test';
import {initialCampaign,applyCampaignAction,settleNight} from '../src/campaign.js';
import {createBattle,battleCommand,stepBattle} from '../src/battle.js';

async function observeReceipts(page){await page.evaluate(()=>{window.__receiptAdds=0;window.__receiptsSeen=[];new MutationObserver(records=>{for(const r of records)for(const node of r.addedNodes)if(node.matches?.('.resource-receipt')){window.__receiptAdds++;window.__receiptsSeen.push({text:node.textContent,kind:node.dataset.kind,shownAt:performance.now()});}}).observe(document.querySelector('.resource-receipts'),{childList:true});});}
const adds=page=>page.evaluate(()=>window.__receiptAdds);

for(const width of [320,390,1280])test(`resource costs ${width}: building and multi-resource crafting show numbers above the sheet without blocking controls`,async({page})=>{
 await page.setViewportSize({width,height:width===320?568:844});if(width===1280)await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await page.getByRole('button',{name:/修理工/}).click();await expect(page.locator('#phase')).toHaveText('白天经营');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');
 await observeReceipts(page);await openTab(page,'build');await page.locator('[data-action=build][data-building=garden]').click();
 const built=page.locator('.resource-receipt').filter({hasText:'建设异变菜畦'});await expect(built).toContainText('建材 −5');await expect(page.locator('.resource-pop[data-resource=materials]').last()).toHaveText('−5');
 await page.locator('[data-action=close-overlay]').click();await openTab(page,'manage');await page.locator('[data-action=craft][data-item=medicine]').click();
 const crafted=page.locator('.resource-receipt[data-kind=spend]').filter({hasText:'制作护理包'});await expect(crafted).toContainText('建材 −1');await expect(crafted).toContainText('净水 −1');await expect(crafted).toContainText('燃料 −1');
 const output=page.locator('.resource-receipt[data-kind=gain]').filter({hasText:'制作护理包'});await expect(output).toContainText('药品 +1');await expect(output.locator('b')).toHaveCSS('color','rgb(200, 230, 181)');await expect(page.locator('.resource-pop[data-resource=medicine]').last()).toHaveText('+1');expect(await adds(page)).toBe(3);
 await expect(crafted).toHaveCSS('opacity','1');const pop=await page.locator('.resource-pop[data-resource=materials]').last().boundingBox(),bar=await page.locator('#resources').boundingBox();expect(pop.y+pop.height).toBeLessThanOrEqual(bar.y+bar.height);await expect(page.locator('.resource-feedback')).toHaveCSS('pointer-events','none');
 const boxes=await crafted.evaluate(el=>({left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,width:innerWidth,scroll:document.documentElement.scrollWidth}));expect(boxes.left).toBeGreaterThanOrEqual(0);expect(boxes.right).toBeLessThanOrEqual(boxes.width);expect(boxes.scroll).toBeLessThanOrEqual(boxes.width);
 await page.screenshot({path:`.local/validation/resource-feedback/crafting-${width}.png`,fullPage:true});await page.locator('[data-action=close-overlay]').click();await expect(page.locator('#overlay')).toBeHidden();
 await page.route('**/api/campaign/action',route=>route.fulfill({status:422,json:{error:'测试：物资不足'}}));await openTab(page,'manage');await page.locator('[data-action=craft][data-item=fuel]').click();await expect(page.locator('#error')).toContainText('物资不足');expect(await adds(page)).toBe(3);
});

test('search gains show the actual loot and a large harvest keeps every source visible in turn',async({page})=>{
 let state=applyCampaignAction(applyCampaignAction(initialCampaign(53),{type:'chooseRole',role:'repairman'}),{type:'recruit',person:'lin'}),revision=1;
 state.buildings=[{id:'garden',type:'garden',level:1,age:1},{id:'water1',type:'water',level:1},{id:'water2',type:'water',level:1},{id:'gen',type:'generator',level:1,enabled:true}];state=applyCampaignAction(state,{type:'assign',person:'lin',job:'forage'});
 await page.route('**/api/campaign',route=>route.fulfill({json:{state,runId:'harvest-ui',revision}}));await page.route('**/api/campaign/action',route=>{state=applyCampaignAction(state,route.request().postDataJSON().action);return route.fulfill({json:{state,runId:'harvest-ui',revision:++revision}});});
 await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await observeReceipts(page);
 await page.locator('[data-action=tab][data-tab=explore]').click();await page.locator('[data-action=search][data-site=alley]').click();
 const search=page.locator('.resource-receipt[data-kind=gain]').filter({hasText:'搜索居民小巷'});await expect(search).toContainText('食物 +4');await expect(search).toContainText('净水 +3');await expect(search).toContainText('建材 +2');await expect(search.locator('b').first()).toHaveCSS('color','rgb(200, 230, 181)');
 await page.locator('[data-action=close-overlay]').click();await page.locator('[data-action=prepare]').click();
 await expect.poll(()=>adds(page),{timeout:10000}).toBe(8);
 const seen=await page.evaluate(()=>window.__receiptsSeen);expect(seen.map(f=>f.kind)).toEqual(['gain','gain','gain','gain','spend','gain','exposure','gain']);
 expect(seen[1].text).toContain('菜畦收获');expect(seen[2].text).toContain('集水过滤');expect(seen[3].text).toContain('集水过滤');expect(seen[4].text).toContain('燃料 −1');expect(seen[5].text).toContain('零件 +1');expect(seen[5].text).toContain('净水 +2');expect(seen[6].text).toContain('发电噪声');expect(seen[6].text).toContain('暴露 +1');expect(seen[7].text).toContain('林禾 · 搜集燃料');expect(seen[7].text).toContain('燃料 +4');
 for(let i=1;i<seen.length;i++)expect(seen[i].shownAt-seen[i-1].shownAt).toBeGreaterThanOrEqual(800);
 await expect(page.locator('#resources [data-resource=fuel] b')).toHaveText(String(state.resources.fuel));await page.screenshot({path:'.local/validation/resource-feedback/production-gains.png',fullPage:true});
});

test('night charges show at reservation, refunds and final rations; repeated snapshots and save retries do not repeat costs',async({page})=>{
 const state=applyCampaignAction(applyCampaignAction(initialCampaign(53),{type:'chooseRole',role:'repairman'}),{type:'prepare'}),b=createBattle(state,'resource-ui',{autoPause:false});b.schedule=[{at:9999,type:'walker',zone:'gate'}];b.challenge=null;let result=null;
 const publish=()=>page.evaluate(data=>window.__resourceWorker.dispatchEvent(new MessageEvent('message',{data})),{type:'state',battle:b,result,steps:0});
 await page.exposeFunction('__resourceMessage',async message=>{if(message.type==='command')battleCommand(b,message.action);if(message.type!=='dispose')await publish();});
 await page.addInitScript(()=>{const RealWorker=window.Worker;window.Worker=class extends EventTarget{constructor(url,options){super();if(!String(url).includes('night-worker'))return new RealWorker(url,options);window.__resourceWorker=this;queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:{type:'ready'}})));}postMessage(message){window.__resourceMessage(message);}terminate(){}};});
 await page.route('**/api/campaign',route=>route.fulfill({json:{state,runId:'resource-ui',revision:1}}));await page.route('**/api/campaign/night-result',route=>route.fulfill({status:503,json:{error:'测试：稍后保存'}}));
 await page.goto('/');await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await observeReceipts(page);await page.locator('[data-action=start-night]').click();
 await expect(page.locator('.resource-receipt')).toContainText('00:00 · 入夜添柴');expect(await adds(page)).toBe(1);
 await page.locator('[data-command=repair]').click();await expect(page.locator('.resource-receipt').last()).toContainText('修补预留');expect(await adds(page)).toBe(2);
 b.paused=false;for(let i=0;i<200&&b.people[0].task;i++)stepBattle(b);b.paused=true;await publish();await publish();expect(await adds(page)).toBe(2);
 b.fires[0].wood=.2;battleCommand(b,{type:'addWood',person:'hero',target:'central'});battleCommand(b,{type:'cancel',person:'hero'});await publish();await expect.poll(()=>adds(page)).toBe(4);
 await expect(page.locator('.resource-receipt').last()).toContainText('返还预留');await expect(page.locator('.resource-receipt').last()).toContainText('建材 +1');
 b.people[0].nightRole='support';b.fires[0].heat=20;b.paused=false;stepBattle(b);b.paused=true;await publish();await expect(page.locator('.resource-receipt').last()).toContainText('自动添柴预留');await page.screenshot({path:'.local/validation/resource-feedback/night-reserve-refund.png',fullPage:true});
 battleCommand(b,{type:'cancel',person:'hero'});b.people[0].nightRole='guard';b.finished=true;b.paused=true;b.challenge={title:'守住院子',status:'cleared'};result=settleNight(state,b);await publish();
 const rations=page.locator('.resource-receipt').filter({hasText:'夜间口粮结算'});await expect(rations).toContainText('食物 −2');await expect(rations).toContainText('净水 −1');const reward=page.locator('.resource-receipt[data-kind=gain]').filter({hasText:'挑战奖励'});await expect(reward).toContainText('建材 +1');await expect(reward.locator('b')).toHaveCSS('color','rgb(200, 230, 181)');const count=await adds(page);await publish();expect(await adds(page)).toBe(count);
 await expect(page.locator('#resources [data-resource=food] b')).toHaveText(String(result.resources.food));await expect(page.locator('#resources [data-resource=water] b')).toHaveText(String(result.resources.water));
 await page.screenshot({path:'.local/validation/resource-feedback/rations.png',fullPage:true});
});
