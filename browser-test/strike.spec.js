import {test,expect} from '@playwright/test';

for(const [width,day] of [[320,1],[390,7]])test(`real offline worker respects short strikes and boss immunity on night ${day} at ${width}px`,async({page,context})=>{
 test.setTimeout(60000);await page.setViewportSize({width,height:width===320?568:844});const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/api/'))requests.push(r.url());});
 await page.addInitScript(()=>{
  window.__strikeSamples=[];const Native=window.Worker;window.Worker=class extends Native{
   constructor(url,options){super(url,options);if(!String(url).includes('night-worker'))return;window.__strikeWorker=this;let seq=0;
    this.addEventListener('message',({data})=>{if(data.type!=='state')return;const b=data.battle;
     for(const hit of b.events.filter(e=>e.id>seq&&e.type==='attack')){const enemy=b.enemies.find(e=>e.id===hit.enemyId);window.__strikeSamples.push({distance:Math.hypot(hit.x-hit.source.x,hit.y-hit.source.y),boss:!!enemy?.boss,stun:enemy?.stun,phase:b.boss?.phase,age:b.elapsed-hit.time});}seq=b.eventSeq;
    });
   }
  };
 });
 await page.goto(`/?test=${day}&testPreset=crew`);await expect(page.locator('#phase')).toHaveText('测试 · 实时守夜');
 await context.setOffline(true);await page.evaluate(()=>{for(const action of [{type:'autoPause',enabled:false},{type:'speed',value:2},{type:'resume'}])window.__strikeWorker.postMessage({type:'command',action});});
 await expect.poll(()=>page.evaluate(day=>day===1?window.__strikeSamples.some(s=>!s.boss&&s.stun>0):window.__strikeSamples.some(s=>s.boss&&s.phase==='charge'&&s.age<=.11),day),{timeout:40000,intervals:[100]}).toBe(true);
 await page.evaluate(()=>window.__strikeWorker.postMessage({type:'command',action:{type:'pause'}}));await expect.poll(()=>page.locator('#world').evaluate(el=>el.getNightSnapshot().paused)).toBe(true);
 const samples=await page.evaluate(()=>window.__strikeSamples);expect(samples.length).toBeGreaterThan(0);expect(samples.every(s=>s.distance<=50)).toBe(true);
 const ordinary=samples.filter(s=>!s.boss&&s.stun!==undefined);expect(ordinary.every(s=>s.stun<=.15)).toBe(true);if(day===1)expect(ordinary.some(s=>s.stun>0)).toBe(true);
 if(day===7){const bossHits=samples.filter(s=>s.boss&&s.phase==='charge'&&s.age<=.11);expect(bossHits.length).toBeGreaterThan(0);expect(bossHits.every(s=>s.stun===0)).toBe(true);}
 await page.getByRole('button',{name:'打开游戏菜单'}).click();await page.locator('[data-action=drawer][data-panel=members]').click();await page.getByRole('button',{name:'技能',exact:true}).click();await page.locator('[data-group=skill][data-value=guard]').click();
 await expect(page.getByTestId('skill-guide')).toContainText('攻击距离50');await expect(page.getByTestId('skill-guide')).toContainText('0.15秒');await expect(page.getByTestId('skill-guide')).toContainText('首领及双脉分裂体免疫');
 const layout=await page.locator('#sheet-body').evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth,page:document.documentElement.scrollWidth,width:innerWidth}));expect(layout.scroll).toBeLessThanOrEqual(layout.client);expect(layout.page).toBeLessThanOrEqual(layout.width);
 await page.screenshot({path:`.local/attack-tuning/guard-${width}.png`,fullPage:true});expect(errors).toEqual([]);expect(requests).toEqual([]);
});

test('desktop boss help explains ordinary-attack immunity while preserving specific counters',async({page})=>{
 await page.setViewportSize({width:1280,height:900});await page.goto('/?test=28');await expect(page.locator('#phase')).toHaveText('测试 · 实时守夜');
 await page.getByRole('button',{name:'打开游戏菜单'}).click();await page.getByRole('button',{name:'本夜情报',exact:true}).click();await expect(page.getByTestId('boss-preview')).toContainText('首领及双脉分裂体免疫普通攻击眩晕');await expect(page.getByTestId('boss-preview')).toContainText('投掷、陷阱与机制控制仍有效');
});
