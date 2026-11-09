import {mkdirSync,writeFileSync} from 'node:fs';
import {tacticalNight} from '../test/support/tactical-night.js';

const quick=process.argv.includes('--quick'),round=process.argv.find(v=>v.startsWith('--round='))?.split('=')[1]||'final';
const results=[];
for(const seed of quick?[53]:[11,53,97])for(let day=1;day<=28;day++)for(const policy of ['prepared','stacked','random']){
 const r=tacticalNight({day,seed,policy});results.push(r);
 if(!r.finished)console.error('DID NOT CONVERGE',day,seed,policy);
}
const fatigue=[];for(const seed of quick?[53]:[11,53,97])for(const day of [5,8,12,13,16,17,18,20,22,24,25,27])for(const value of [0,90])fatigue.push(tacticalNight({day,seed,fatigue:value}));
const careers=[...results.filter(r=>r.policy==='prepared')];
for(const role of ['repairman','medic'])for(const seed of quick?[53]:[11,53,97])for(let day=1;day<=28;day++)careers.push(tacticalNight({day,seed,role}));
const summary=Object.fromEntries(['prepared','stacked','random'].map(policy=>{const rows=results.filter(r=>r.policy===policy);return [policy,{clears:rows.filter(r=>r.cleared).length,total:rows.length,misses:rows.filter(r=>!r.cleared).map(r=>({day:r.day,seed:r.seed,feedback:r.feedback}))}];}));
summary.fatigue=Object.fromEntries([0,90].map(value=>{const rows=fatigue.filter(r=>r.fatigue===value);return [value,{clears:rows.filter(r=>r.cleared).length,total:rows.length,entries:rows.reduce((n,r)=>n+r.entered,0),reinforcements:rows.reduce((n,r)=>n+r.reinforcements,0)}];}));
summary.careers=Object.fromEntries(['watchman','repairman','medic'].map(role=>{const rows=careers.filter(r=>r.role===role);return [role,{clears:rows.filter(r=>r.cleared).length,total:rows.length,misses:rows.filter(r=>!r.cleared).map(r=>({day:r.day,seed:r.seed,feedback:r.feedback}))}];}));
const dir=new URL('../reports/2026-11-04-tactics/',import.meta.url);mkdirSync(dir,{recursive:true});writeFileSync(new URL(`round-${round}.json`,dir),JSON.stringify({summary,results,fatigue,careers},null,2));console.log(JSON.stringify(summary,null,2));
