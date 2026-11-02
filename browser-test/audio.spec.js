import {test,expect} from '@playwright/test';
import {writeFileSync,mkdirSync} from 'node:fs';
mkdirSync('.local/validation/audio',{recursive:true});

const audio=page=>page.locator('canvas').evaluate(c=>c.getYardDiagnostics().audio);
async function signal(page,duration=500){return page.evaluate(duration=>new Promise(resolve=>{
 const data=new Float32Array(2048);let peak=0,sum=0,count=0;const until=performance.now()+duration;
 function sample(){if(window.__audioProbe){window.__audioProbe.getFloatTimeDomainData(data);for(const v of data){peak=Math.max(peak,Math.abs(v));sum+=v*v;count++;}}if(performance.now()<until)requestAnimationFrame(sample);else resolve({peak,rms:count?Math.sqrt(sum/count):0});}sample();
}),duration);}

test('opt-in audio keeps alerts audible while a burning campfire stays silent, including after pause and resume',async({page})=>{
 const requests=[],errors=[];page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  window.__audioStarts=[];const start=AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start=function(...args){window.__audioStarts.push({loop:this.loop,duration:this.buffer?.duration||0});return start.apply(this,args);};
  const connect=AudioNode.prototype.connect;
  AudioNode.prototype.connect=function(destination,...args){
   if(destination instanceof AudioDestinationNode){const analyser=this.context.createAnalyser();analyser.fftSize=2048;window.__audioProbe=analyser;connect.call(this,analyser);return connect.call(analyser,destination,...args);}
   return connect.call(this,destination,...args);
  };
 });
 await page.goto('/');await page.getByRole('button',{name:/修理工/}).click();await expect(page.locator('#world')).toHaveAttribute('data-ready','true');
 expect((await audio(page)).enabled).toBe(false);expect(requests.some(url=>url.endsWith('.wav'))).toBe(false);
 await page.waitForTimeout(350);await page.locator('#audio-toggle').click();
 await expect.poll(async()=>(await audio(page)).ready).toBe(true);
 await expect.poll(async()=>(await audio(page)).context).toBe('running');
 const confirmation=await signal(page,200);expect(confirmation.peak).toBeGreaterThan(.005);
 await expect(page.locator('#audio-toggle')).toHaveAttribute('aria-pressed','true');
 expect(requests.filter(url=>url.endsWith('.wav'))).toHaveLength(2);expect(requests.some(url=>/\/fire-[^/]+\.wav$/.test(url))).toBe(false);
 await page.locator('[data-action=prepare]').click();await page.locator('[data-action=start-night]').click();await expect(page.locator('[data-action=pause]')).toHaveText('继续');
 expect(await page.locator('#world').evaluate(el=>el.getNightSnapshot().fires[0].heat)).toBeGreaterThan(15);
 await page.waitForTimeout(500);const before=await signal(page);expect(before.rms).toBeLessThan(.00001);
 await page.locator('[data-action=pause]').click();
 await expect(page.locator('[data-action=pause]')).toHaveText('暂停');
 const playing=await signal(page);expect(playing.rms).toBeLessThan(.00001);
 await page.locator('[data-action=pause]').click();await expect(page.locator('[data-action=pause]')).toHaveText('继续');
 await page.waitForTimeout(500);const paused=await signal(page);expect(paused.rms).toBeLessThan(.00001);
 await page.locator('[data-command=repair]').click();await page.locator('[data-action=pause]').click();
 await expect.poll(()=>page.evaluate(()=>window.__audioStarts.some(s=>s.duration>.17&&s.duration<.19)),{timeout:10000}).toBe(true);
 const starts=await page.evaluate(()=>window.__audioStarts);expect(starts.some(s=>s.loop)).toBe(false);expect(starts.some(s=>s.duration>.47&&s.duration<.49)).toBe(true);
 await page.locator('#audio-toggle').click();
 const muted=await signal(page);writeFileSync('.local/validation/audio/no-fire-mute-state.json',JSON.stringify({audio:await audio(page),errors,muted},null,2));
 expect((await audio(page)).enabled).toBe(false);expect(muted.rms).toBeLessThan(.00001);expect(errors).toEqual([]);
 expect(requests.some(url=>/\/fire-[^/]+\.wav$/.test(url))).toBe(false);
 writeFileSync('.local/validation/audio/no-fire-output.json',JSON.stringify({confirmation,before,playing,paused,muted,starts,diagnostics:await audio(page)},null,2));
});

test('turning sound off during its deferred download cannot play a late confirmation',async({page})=>{
 let unblock;const gate=new Promise(resolve=>{unblock=resolve;});const requests=[];page.on('request',r=>{if(r.url().endsWith('.wav'))requests.push(r.url());});
 await page.route('**/*.wav',async route=>{await gate;await route.continue();});
 try{
  await page.goto('/');await page.getByRole('button',{name:/修理工/}).click();await expect(page.locator('#world')).toHaveAttribute('data-ready','true');
  await page.locator('#audio-toggle').click();await expect.poll(()=>requests.length).toBe(2);
  await page.locator('#audio-toggle').click();await expect(page.locator('#audio-toggle')).toHaveAttribute('aria-pressed','false');
 }finally{unblock();}
 await expect.poll(async()=>(await audio(page)).ready).toBe(true);
 const state=await audio(page);expect(state.enabled).toBe(false);expect(state.muted).toBe(true);
 await page.locator('#audio-toggle').click();await expect.poll(async()=>(await audio(page)).muted).toBe(false);expect(requests).toHaveLength(2);expect(requests.some(url=>/\/fire-[^/]+\.wav$/.test(url))).toBe(false);
});
