import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {initialCampaign,applyCampaignAction as act,makePerson} from '../../src/campaign.js';
import {dailyConsumption,facilityOutput,farmingYield} from '../../src/rules.js';
import {SITES,weather} from '../../src/content.js';
import {searchPlan} from '../../src/search.js';
const result={date:'2026-10-27',consumption:[],gardens:[],searches:[],jobs:[]};
for(let n=1;n<=5;n++)for(const stove of [null,'normal','yield','steady']){
 const s=act(initialCampaign(53),{type:'chooseRole',role:'repairman'});
 s.people=Array.from({length:n},(_,i)=>({...makePerson(i?'p'+i:'hero','test','test','survival'),workedDay:s.day,job:i?'care':'rest',nightRole:'guard'}));
 if(stove)s.buildings=[{id:'stove',type:'stove',level:stove==='normal'?1:2,branch:stove,hp:10}];
 const d=dailyConsumption(s);result.consumption.push({people:n,stove,food:d.food,workExtra:d.workExtra,nightExtra:d.nightExtra});
 assert.equal(d.food,Math.max(1,3*n-(stove?(stove==='yield'?2:1):0)));
}
for(const branch of ['normal','yield','steady']){
 const b={type:'garden',level:branch==='normal'?1:2,branch,hp:10};
 const perWeather=Object.fromEntries(['clear','rain','hot'].map(w=>[w,facilityOutput(b,w)]));
 const cycles=[11,53,97].map(seed=>({seed,total28:Array.from({length:14},(_,i)=>facilityOutput(b,weather(2*i+2,seed))).reduce((a,b)=>a+b,0)}));
 result.gardens.push({branch,perWeather,averageClearPerDay:perWeather.clear/2,cycles});
}
for(const site of ['alley','greenhouse','market'])for(const deep of [false,true])for(const escortSkill of [null,0,2]){
 const escort=escortSkill===null?null:{skills:{exploration:escortSkill}},plan=searchPlan(SITES[site],{deep,escort,day:15});
 result.searches.push({site,deep,escortSkill,ap:plan.ap,food:plan.loot.food,loot:plan.loot});
}
for(const job of ['rest','cook','farm']){
 let s=act(initialCampaign(53),{type:'chooseRole',role:'repairman'});
 s.day=15;s.people.push(makePerson('meng','孟姐','食堂厨师','survival'));s.people[1].job=job;
 s.buildings=[{id:'stove',type:'stove',level:1,branch:'normal',hp:10},{id:'garden',type:'garden',age:0,level:1,branch:'normal',hp:10}];
 const before=s.resources.food;s=act(s,{type:'prepare'});const d=dailyConsumption(s);
 result.jobs.push({job,grossGain:s.resources.food-before,foodNeed:d.food,net:(s.resources.food-before)-d.food});
}
assert.equal(result.jobs.find(x=>x.job==='cook').net,result.jobs.find(x=>x.job==='rest').net);
for(const skill of [0,1,2,3])result.jobs.push({job:'farm',skill,gross:farmingYield(skill),netOverRest:farmingYield(skill)-1});
writeFileSync(new URL('./results.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
