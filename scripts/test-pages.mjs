import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,stat,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium,expect} from '@playwright/test';

// Serve only the production files under the same subpath as GitHub Pages.
// No API, Vite fallback or Node game server can hide deployment problems.
const root=resolve('dist'),prefix='/until-dawn/';
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.wav':'audio/wav','.mp4':'video/mp4'};
let server,browser;
try{
 let url=process.env.PAGES_URL;
 if(!url){
  server=createServer(async(req,res)=>{
   try{
    const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(!path.startsWith(prefix)){res.writeHead(404).end();return;}
    const file=resolve(root,path.slice(prefix.length)||'index.html');
    if(!file.startsWith(root+'/')||!(await stat(file)).isFile()){res.writeHead(404).end();return;}
    res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});
    res.end(await readFile(file));
   }catch{res.writeHead(404).end();}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  url=`http://127.0.0.1:${server.address().port}${prefix}`;
 }
 browser=await chromium.launch({channel:process.env.CI?undefined:'chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:1280,height:800}});
 const page=await context.newPage(),errors=[],missing=[],apis=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('request',req=>{if(new URL(req.url()).pathname.includes('/api/'))apis.push(req.url());});
 page.on('response',res=>{if(res.status()>=400)missing.push(`${res.status()} ${res.url()}`);});
 const readSave=()=>page.evaluate(()=>new Promise((resolve,reject)=>{
  const request=indexedDB.open('dawn-browser-saves',1);
  request.onerror=()=>reject(request.error);
  request.onsuccess=()=>{const db=request.result,tx=db.transaction('campaign'),get=tx.objectStore('campaign').get('current');get.onsuccess=()=>resolve(get.result);tx.oncomplete=()=>db.close();};
 }));
 await page.goto(url);
 await expect(page.locator('#phase')).toHaveText('选择角色');
 await page.locator('[data-action=role][data-role=watchman]').click();
 await expect(page.locator('#phase')).toHaveText('白天经营');
 await expect(page.locator('#world')).toHaveAttribute('data-ready','true',{timeout:30000});
 const day=await readSave();
 await page.reload();
 await expect(page.locator('#phase')).toHaveText('白天经营');
 assert.deepEqual(await readSave(),day);
 await expect(page.locator('#world')).toHaveAttribute('data-ready','true',{timeout:30000});
 await page.locator('[data-action=prepare]').click();
 await expect(page.locator('#phase')).toHaveText('黄昏准备');
 const ready=await readSave();
 await page.locator('[data-action=start-night]').click();
 await expect(page.locator('#phase')).toHaveText('实时守夜');
 await expect(page.locator('[data-action=pause]')).toHaveText('继续');
 await context.setOffline(true);
 await page.locator('[data-action=pause]').click();
 await expect.poll(()=>page.locator('#world').evaluate(el=>el.getNightSnapshot()?.elapsed)).toBeGreaterThan(1);
 assert.deepEqual(await readSave(),ready);
 await context.setOffline(false);
 await page.reload();
 await expect(page.locator('#phase')).toHaveText('黄昏准备');
 assert.deepEqual(await readSave(),ready);
 await page.goto(`${url}?test=7`);
 await expect(page.locator('#phase')).toHaveText('测试 · 实时守夜',{timeout:30000});
 assert.equal(await page.locator('#world').evaluate(el=>el.getNightSnapshot().day),7);
 assert.deepEqual(await readSave(),ready);
 assert.deepEqual(apis,[],'Static hosting must never request server migration APIs');
 assert.deepEqual(missing,[],'All JavaScript, worker and art assets must load');
 assert.deepEqual(errors,[],'Browser must have no uncaught errors');
 await mkdir('test-results',{recursive:true});
 await page.screenshot({path:'test-results/pages-smoke.png'});
 console.log(`Pages smoke test passed: ${url}\nOnboarding, persistent saves, subpath assets, offline worker night, refresh recovery and night 7 verified.`);
}finally{
 await browser?.close();
 if(server)await new Promise(resolve=>server.close(resolve));
}
