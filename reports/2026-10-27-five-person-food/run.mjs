import {writeFileSync,appendFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {run as baseline} from './snapshot/test/support/campaign-route.js';
import {needs} from './snapshot/src/rules.js';
const output=fileURLToPath(new URL('.',import.meta.url));
const mode=process.argv[2]||'baseline';
const runner=mode==='baseline'?baseline:(await import(`./snapshot/test/support/${mode}-route.js`)).run;
const rows=[];
for(const role of (['demand','search'].includes(mode)?['repairman']:['repairman','medic','watchman']))for(const seed of [11,53,97]){
 const nights=[],actions=[],rejected=[];let result,error=null;
 try{result=runner(role,5,seed,{onReject:r=>rejected.push(r),onAction:({before,after,request,flows})=>actions.push({day:after.day,request,apBefore:before.ap,apAfter:after.ap,resourcesBefore:before.resources,resourcesAfter:after.resources,flows,people:request.type==='prepare'?after.people:null}),onNight:({state:s,battle:b})=>nights.push({day:s.day,phase:s.phase,resources:s.resources,foodDemand:needs(b).food,foodBeforeMeal:b.resources.food,waterDemand:needs(b).water,foodUsed:s.report.foodUsed,waterUsed:s.report.waterUsed,hungry:s.report.hungry,thirsty:s.report.thirsty,people:s.people,house:s.house,elapsed:b.elapsed,report:s.report,events:b.log,flows:b.resourceFlows,buildings:s.buildings})});}
 catch(e){error={message:e.message,stack:e.stack};}
 const r={mode,role,seed,error,phase:result?.s.phase||'test-error',day:result?.s.day||nights.at(-1)?.day,final:result?.s,nights,actions,rejected};rows.push(r);
 writeFileSync(output+mode+'-results.json',JSON.stringify(rows,null,2));
 console.log(JSON.stringify({mode,role,seed,phase:r.phase,day:r.day,nights:nights.length,hungry:nights.filter(n=>n.hungry).map(n=>n.day),thirsty:nights.filter(n=>n.thirsty).map(n=>n.day),food:r.final?.resources.food,alive:r.final?.people.filter(p=>!p.dead).length,error:error?.message}));
}
