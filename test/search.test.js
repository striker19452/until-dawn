import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,applyCampaignAction as act,makePerson} from '../src/campaign.js';
import {SITES,weather} from '../src/content.js';
import {SEARCH_RULES,searchPlan,searchInjury,searchRiskDescription} from '../src/search.js';

function day(seed=53,rank=0){
 const s=act(initialCampaign(seed),{type:'chooseRole',role:'repairman'});
 s.day=15;s.people.push(makePerson('yuan','阿远','快递员','exploration'));
 s.people[1].skills.exploration=rank;return s;
}
const diff=(s,after)=>Object.fromEntries(Object.keys(s.resources).map(k=>[k,after.resources[k]-s.resources[k]]).filter(([,n])=>n));

test('all eight locations preview exactly the paid rewards for quick/deep, alone/escorted and every exploration rank',()=>{
 for(const [id,site]of Object.entries(SITES))for(const deep of [false,true])for(const rank of [null,0,1,1.99,2,3]){
  const s=day(53,rank??0),escort=rank===null?null:s.people[1],before=structuredClone(s);
  const plan=searchPlan(site,{deep,escort,day:s.day,exposure:s.exposure});
  const after=act(s,{type:'search',site:id,deep,escort:escort?.id});
  assert.deepEqual(diff(s,after),plan.loot);
  assert.equal(after.ap,s.ap-plan.ap);assert.equal(after.exposure,s.exposure+plan.exposure);
  assert.equal(after.people[1].fatigue,escort?10:0);
  assert.deepEqual(s,before,'preview/action do not mutate their inputs');
 }
 const s=day(),escort=s.people[1];
 assert.deepEqual(searchPlan(SITES.shed).loot,{materials:7,parts:1,fuel:1});
 assert.deepEqual(searchPlan(SITES.shed,{deep:true}).loot,{materials:14,parts:2,fuel:2});
 assert.deepEqual(searchPlan(SITES.shed,{escort}).loot,{materials:9,parts:2,fuel:2});
 assert.deepEqual(searchPlan(SITES.shed,{deep:true,escort}).loot,{materials:16,parts:3,fuel:3});
 escort.skills.exploration=2;
 assert.deepEqual(searchPlan(SITES.shed,{deep:true,escort}).loot,{materials:17,parts:3,fuel:3});
});

test('escort fatigue is paid once, cannot claim rest/work or another outing, and dusk rollback/reprepare cannot repeat it',()=>{
 for(const deep of [false,true])for(const fatigue of [0,40,95]){
  const s=day();s.people[1].fatigue=fatigue;
  const searched=act(s,{type:'search',site:'shed',deep,escort:'yuan'}),p=searched.people[1];
  assert.equal(p.fatigue,Math.min(100,fatigue+10));assert.equal(p.job,'escort');
  const snapshot=structuredClone(searched),rank=p.skills.exploration;
  assert.throws(()=>act(searched,{type:'assign',person:'yuan',job:'forage'}),/随行/);
  assert.throws(()=>act(searched,{type:'search',site:'alley',escort:'yuan'}),/随行者/);
  assert.throws(()=>act(searched,{type:'search',site:'shed'}),/已搜索/);
  const ready=act(searched,{type:'prepare'});
  assert.equal(ready.people[1].fatigue,p.fatigue);assert.equal(ready.people[1].job,'rest');
  assert.equal(ready.people[1].skills.exploration,rank);
  assert.deepEqual(ready.resources,searched.resources);
  const back=act(ready,{type:'backDay'});
  assert.equal(back.people[1].job,'escort');assert.equal(back.people[1].fatigue,p.fatigue);
  assert.deepEqual(act(back,{type:'prepare'}).people,ready.people);
  assert.deepEqual(searched,snapshot);
 }
});

test('risk reduction uses one stable roll and is close to the advertised 20/10/5 percent',()=>{
 const s=day(),solo=searchPlan(SITES.shed,{deep:true}),escorted=searchPlan(SITES.shed,{deep:true,escort:s.people[1]});
 s.people[1].skills.exploration=2;const skilled=searchPlan(SITES.shed,{deep:true,escort:s.people[1]});
 const counts=[0,0,0];
 for(let seed=1;seed<=20000;seed++){
  const outcomes=[solo,escorted,skilled].map(plan=>searchInjury(seed,15,'shed',plan));
  outcomes.forEach((hit,i)=>counts[i]+=Number(hit));
  assert.ok(!outcomes[1]||outcomes[0]);assert.ok(!outcomes[2]||outcomes[1]);
 }
 for(const [i,chance]of [20,10,5].entries())assert.ok(Math.abs(counts[i]/200-chance)<1,JSON.stringify(counts));
 for(let seed=1;seed<=100;seed++){
  const s=day(seed),w=weather(s.day,seed),currentSolo=searchPlan(SITES.shed,{deep:true,weather:w}),currentEscorted=searchPlan(SITES.shed,{deep:true,escort:s.people[1],weather:w}),injured=searchInjury(seed,15,'shed',currentSolo),before=structuredClone(s);
  for(const escort of [undefined,'yuan']){
   const result=act(s,{type:'search',site:'shed',deep:true,escort});
   const expected=searchInjury(seed,15,'shed',escort?currentEscorted:currentSolo),target=escort?1:0;
   assert.equal(result.people[target].health,100-(expected?(escort?8:12):0));
   assert.equal(result.people[1-target].health,100);
   assert.equal(result.people[target].wound,expected?'light':'none');
   assert.deepEqual(act(s,{type:'search',site:'shed',deep:true,escort}),result);
   if(escort&&expected)assert.ok(injured);
  }
  assert.deepEqual(s,before);
 }
});

test('first-day searches and non-fog quick searches have no injury; capped exposure and rejected orders stay atomic',()=>{
 for(let seed=1;seed<=100;seed++){
  const s=day(seed);s.day=1;s.exposure=6;
  const first=act(s,{type:'search',site:'shed',deep:true,escort:'yuan'});
  assert.ok(first.people.every(p=>p.health===100));assert.equal(first.exposure,6);
  s.day=15;if(weather(s.day,s.seed)!=='fog'){
   const quick=act(s,{type:'search',site:'shed',escort:'yuan'});
   assert.ok(quick.people.every(p=>p.health===100));assert.equal(quick.exposure,6);
  }
 }
 for(const mode of ['hero','busy','dead','severe','missing','ap','locked']){
  const s=day();let escort='yuan',site='shed';
  if(mode==='hero')escort='hero';if(mode==='busy')s.people[1].job='forage';
  if(mode==='dead')s.people[1].dead=true;if(mode==='severe')s.people[1].wound='severe';
  if(mode==='missing')escort='unknown';if(mode==='ap')s.ap=2;
  if(mode==='locked'){s.day=1;site='rescue';}
  const before=structuredClone(s),flows=[];
  assert.throws(()=>act(s,{type:'search',site,deep:true,escort},{onResourceFlow:f=>flows.push(f)}));
  assert.deepEqual(s,before);assert.deepEqual(flows,[]);
 }
});

test('fog adds 30 percentage points to quick and deep searches while preserving first-day safety and escort benefits',()=>{
 for(const w of ['clear','rain','hot','fog'])for(const deep of [false,true])for(const rank of [null,0,1.99,2,3]){
  const s=day(53,rank??0),escort=rank===null?null:s.people[1],base=deep?(rank===null?20:rank<2?10:5):0;
  const plan=searchPlan(SITES.shed,{deep,escort,day:15,weather:w});
  assert.equal(plan.injuryChance,base+(w==='fog'?30:0));
  assert.equal(plan.injuryDamage,deep||w==='fog'?(escort?8:12):0);
  assert.deepEqual(plan.loot,searchPlan(SITES.shed,{deep,escort}).loot);
  const first=searchPlan(SITES.shed,{deep,escort,day:1,weather:w});assert.equal(first.injuryChance,0);assert.equal(first.fogInjuryBonus,0);
 }
 assert.match(searchRiskDescription(),/快搜30%，深搜独行50%、普通随行40%、探索2级及以上随行35%/);
 const original=SEARCH_RULES.fogInjuryBonus;
 try{SEARCH_RULES.fogInjuryBonus=95;assert.equal(searchPlan(SITES.shed,{deep:true,weather:'fog'}).injuryChance,100);}
 finally{SEARCH_RULES.fogInjuryBonus=original;}
});

test('actual fog outings use the displayed odds, damage the correct person, retain loot and cannot reroll',()=>{
 const counts=[0,0,0,0],plans=[searchPlan(SITES.shed,{weather:'fog'}),... [null,0,2].map(rank=>searchPlan(SITES.shed,{deep:true,weather:'fog',escort:rank===null?null:day(53,rank).people[1]}))];
 for(let seed=1;seed<=20000;seed++){
  const outcomes=plans.map(plan=>searchInjury(seed,15,'shed',plan));
  outcomes.forEach((hit,i)=>counts[i]+=Number(hit));
  assert.ok(!outcomes[0]||outcomes[1]);assert.ok(!outcomes[2]||outcomes[1]);assert.ok(!outcomes[3]||outcomes[2]);
 }
 for(const [i,chance]of [30,50,40,35].entries())assert.ok(Math.abs(counts[i]/200-chance)<1,JSON.stringify(counts));
 for(let seed=1;seed<=200;seed++)if(weather(15,seed)==='fog')for(const deep of [false,true])for(const rank of [null,0,2]){
  const s=day(seed,rank??0),escort=rank===null?null:s.people[1],plan=searchPlan(SITES.shed,{deep,escort,day:15,weather:'fog'}),target=escort?1:0;
  const injured=searchInjury(seed,15,'shed',plan),action={type:'search',site:'shed',deep,escort:escort?.id},result=act(s,action);
  assert.equal(result.people[target].health,100-(injured?plan.injuryDamage:0));assert.equal(result.people[1-target].health,100);
  assert.deepEqual(diff(s,result),plan.loot);assert.deepEqual(act(s,action),result);
  if(injured)assert.ok(result.logs.some(log=>log.includes(`${deep?'深搜':'快搜'}时擦伤（雾天出行风险增加）`)));
 }
});

test('a lethal fog quick search keeps its loot, records a search death and cannot continue the day',()=>{
 let seed=1;
 while(weather(15,seed)!=='fog'||!searchInjury(seed,15,'shed',searchPlan(SITES.shed,{weather:'fog',day:15})))seed++;
 const s=day(seed);s.people=s.people.slice(0,1);s.people[0].health=12;
 const after=act(s,{type:'search',site:'shed'});
 assert.equal(after.people[0].health,0);assert.equal(after.people[0].dead,true);assert.equal(after.people[0].deathCause,'search');assert.equal(after.phase,'failed');
 assert.deepEqual(diff(s,after),searchPlan(SITES.shed).loot);assert.throws(()=>act(after,{type:'rest'}));
});
