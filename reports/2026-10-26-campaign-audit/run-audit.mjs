import {writeFileSync,appendFileSync,readFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';
import {run} from '../../.local/campaign-state-audit-20261026/test/support/campaign-route.js';
const output=fileURLToPath(new URL('.',import.meta.url));
const seeds=[11,53,97],sizes=[1,3,5],roles=['repairman','medic','watchman'];
const labels={active:'主动指挥',idle:'仅自动布防',rotate:'主动指挥＋同伴轮休'},roleNames={repairman:'修理工',medic:'医护人员',watchman:'夜班保安'};
const configs=[];
for(const role of roles)for(const size of sizes)for(const seed of seeds)configs.push({group:'active',role,size,seed,options:{policy:'active'}});
for(const group of ['idle','rotate'])for(const size of sizes)for(const seed of seeds)configs.push({group,role:'repairman',size,seed,options:group==='idle'?{policy:'idle'}:{policy:'active',rotate:true}});
const managedOnly=process.argv.includes('--care');
const careRun=managedOnly?(await import('../../.local/campaign-state-audit-20261026/test/support/care-route.js')).run:null;
const midOnly=process.argv.includes('--mid');
const pilot=process.argv.includes('--pilot'),selected=midOnly?[2,4].flatMap(size=>seeds.map(seed=>({group:'active',role:'repairman',size,seed,options:{policy:'active'}}))):managedOnly?configs.filter(c=>c.group==='active'&&c.role==='repairman').map(c=>({...c,group:'care'})):pilot?configs.filter(c=>c.role==='repairman'&&c.seed===53&&c.group==='active'):configs;
const suffix=midOnly?'mid':managedOnly?'care':pilot?'pilot':'audit',rows=[];
writeFileSync(output+suffix+'-progress.jsonl','');
function person(p){return {id:p.id,name:p.name,dead:!!p.dead,departed:!!p.departed,deathCause:p.deathCause||p.deathReason||null,health:p.health,wound:p.wound,deadline:p.deadline,fear:p.fear,fatigue:p.fatigue,stamina:p.stamina,nightRole:p.nightRole,job:p.job,skills:p.skills};}
for(const c of selected){
 const nights=[],rejections=[],started=performance.now();let result,error=null;
 try{result=(managedOnly?careRun:run)(c.role,c.size,c.seed,{...c.options,onActionFailure:e=>rejections.push(e),onNight:({state:s,battle:b})=>nights.push({day:s.day,phase:s.phase,elapsed:s.report.elapsed,resources:{...s.resources},house:s.house,people:s.people.map(person),hungry:s.report.hungry,thirsty:s.report.thirsty,deaths:s.report.deaths,boss:s.report.boss||null,challenge:{title:b.challenge.title,status:b.challenge.status,feedback:b.challenge.feedback},breaches:b.breaches,reinforcements:b.reinforcements,facilities:s.buildings.map(x=>({...x})),remaining:b.enemies.length+b.schedule.length,automaticUsed:{...b.supportUsed},logs:s.logs.slice(-12),battleLogs:b.log.slice(-15)})});}
 catch(e){error={message:e.message,stack:e.stack};}
 const s=result?.s,last=nights.at(-1),row={id:`${c.group}-${c.role}-${c.size}-${c.seed}`,...c,seconds:(performance.now()-started)/1000,error,phase:s?.phase||'test-error',day:s?.day||last?.day||0,resources:s?.resources||last?.resources||null,house:s?.house??last?.house??null,people:s?.people.map(person)||last?.people||[],buildings:s?.buildings||[],flags:s?.flags||{},ending:s?.ending||null,failures:result?.failures||[],nights,searches:result?.searches||[],rejections};
 rows.push(row);appendFileSync(output+suffix+'-progress.jsonl',JSON.stringify({id:row.id,phase:row.phase,day:row.day,seconds:row.seconds,error:row.error?.message})+'\n');
 writeFileSync(output+suffix+'-results.json',JSON.stringify({date:'2026-10-26',configs:selected,rows},null,2));
 console.log(`${rows.length}/${selected.length} ${row.id}: ${row.phase} D${row.day} ${row.seconds.toFixed(1)}s`);
}
if(pilot||managedOnly||midOnly)process.exit(0);
const round=n=>Math.round(n*10)/10,avg=ns=>ns.length?round(ns.reduce((a,b)=>a+b,0)/ns.length):null;
const csv=(name,header,data)=>writeFileSync(output+name,[header,...data].map(row=>row.map(v=>JSON.stringify(v??'')).join(',')).join('\n')+'\n');
const resources=['food','water','materials','fuel','medicine','parts'];
csv('runs.csv',['id','group','role','targetPeople','seed','phase','lastDay','surviving','house',...resources,'livingHealth','livingFear','livingFatigue','dead','severe','actionRejections'],rows.map(r=>{const living=r.people.filter(p=>!p.dead);return [r.id,labels[r.group],roleNames[r.role],r.size,r.seed,r.phase,r.day,living.length,round(r.house),...resources.map(k=>r.resources?.[k]),avg(living.map(p=>p.health)),avg(living.map(p=>p.fear)),avg(living.map(p=>p.fatigue)),r.people.filter(p=>p.dead).length,living.filter(p=>p.wound==='severe').length,r.rejections.length];}));
csv('people.csv',['run','phase','lastDay','person','dead','health','wound','fear','fatigue','nightRole','job'],rows.flatMap(r=>r.people.map(p=>[r.id,r.phase,r.day,p.name,p.dead,round(p.health),p.wound,round(p.fear),round(p.fatigue),p.nightRole,p.job])));
csv('nights.csv',['run','day','phase','elapsed','house','living','dead','health','fear','fatigue',...resources,'hungry','thirsty','breaches','challenge','challengeStatus'],rows.flatMap(r=>r.nights.map(n=>{const living=n.people.filter(p=>!p.dead);return [r.id,n.day,n.phase,round(n.elapsed),round(n.house),living.length,n.people.filter(p=>p.dead).length,avg(living.map(p=>p.health)),avg(living.map(p=>p.fear)),avg(living.map(p=>p.fatigue)),...resources.map(k=>n.resources[k]),n.hungry,n.thirsty,n.breaches,n.challenge.title,n.challenge.status];})));
const summary={runs:rows.length,success:rows.filter(r=>r.phase==='rescued').length,fail:rows.filter(r=>r.phase==='failed').length,errors:rows.filter(r=>r.error).length,nights:rows.reduce((sum,r)=>sum+r.nights.length,0),sourceUnchanged:null,groups:[]};
for(const group of Object.keys(labels))for(const size of sizes){const set=rows.filter(r=>r.group===group&&r.size===size),wins=set.filter(r=>r.phase==='rescued'),people=wins.flatMap(r=>r.people.filter(p=>!p.dead));summary.groups.push({group,size,runs:set.length,wins:wins.length,averageEndDay:avg(set.map(r=>r.day)),winnerLiving:avg(wins.map(r=>r.people.filter(p=>!p.dead).length)),winnerHealth:avg(people.map(p=>p.health)),winnerFear:avg(people.map(p=>p.fear)),winnerFatigue:avg(people.map(p=>p.fatigue)),winnerResources:Object.fromEntries(resources.map(k=>[k,avg(wins.map(r=>r.resources[k]))]))});}
writeFileSync(output+'summary.json',JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
