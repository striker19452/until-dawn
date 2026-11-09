import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,applyCampaignAction as act,makePerson,settleNight} from '../src/campaign.js';
import {createBattle} from '../src/battle.js';
import {validateClientResult} from '../src/client-result.js';
import {explorationStory,encounterView,EXPLORATION_STORY_RULES as R,EXPLORATION_GOALS,bondStatus,explorationGoalStatus,explorationEnding} from '../src/exploration-story.js';
import {dailyConsumption} from '../src/rules.js';
import {actionResourceFlows} from '../client/resource-feedback.js';

function day(seed=53,number=15){
 const s=act(initialCampaign(seed),{type:'chooseRole',role:'repairman'});s.day=number;s.resources={food:100,water:100,materials:100,fuel:30,medicine:20,parts:20};return s;
}
function encounter(kind,escort=false){
 const site={letter:'alley',medicine:'clinic',seeds:'greenhouse',radio:'shed',landmark:'market',shared:'alley'}[kind];
 for(let seed=1;seed<500;seed++){
  const s=day(seed);if(escort){s.people.push(makePerson('lin','林禾','园艺师','survival'));s.beds=2;}
  const result=act(s,{type:'search',site,escort:escort?'lin':undefined});if(encounterView(result)?.kind===kind)return result;
 }
 throw Error('fixture encounter unavailable');
}
const respond=(s,choice)=>act(s,{type:'explorationChoice',encounter:encounterView(s).id,choice});
function accept(kind,choice,escort=false){return respond(encounter(kind,escort),choice);}
function nextMorning(s){const ready=act(s,{type:'prepare'}),b=createBattle(ready,'story-night');b.finished=true;return act(settleNight(ready,b),{type:'nextDay'});}

test('old saves remain readable, first-day solo search stays unchanged, and first eligible discovery is deterministic',()=>{
 const old=day(53,1),first=act(old,{type:'search',site:'alley'});assert.equal(first.flags.explorationStory,undefined);
 const s=day(53,2),a=act(s,{type:'search',site:'alley'}),b=act(structuredClone(s),{type:'search',site:'alley'});
 assert.ok(encounterView(a));assert.deepEqual(a,b);assert.equal(s.flags.explorationStory,undefined);
 const deep=act(s,{type:'search',site:'alley',deep:true});assert.equal(encounterView(deep).id,encounterView(a).id);
 const second=act(a,{type:'search',site:'shed'});assert.deepEqual(encounterView(second),encounterView(a));assert.equal(explorationStory(second).seen.length,1);
});

test('all discovery kinds have a free exit and actual server-defined choices; forged choices are atomic',()=>{
 for(const kind of ['letter','medicine','seeds','radio','landmark','shared']){
  const s=encounter(kind,kind==='shared'),view=encounterView(s),before=structuredClone(s),flows=[];
  assert.ok(view.choices.some(c=>c.id==='leave'&&c.ap===0&&Object.keys(c.cost).length===0));
  assert.throws(()=>act(s,{type:'explorationChoice',encounter:view.id,choice:'grant-all',gain:{food:999}},{onResourceFlow:f=>flows.push(f)}));
  assert.deepEqual(s,before);assert.deepEqual(flows,[]);
  const left=respond(s,'leave');assert.equal(encounterView(left),null);assert.deepEqual(left.resources,s.resources);assert.equal(left.ap,s.ap);
  assert.throws(()=>respond(left,'leave'));assert.throws(()=>act(left,{type:'explorationChoice',encounter:view.id,choice:'leave'}));
 }
});

test('free narrative decisions do not mark extra work or create an extra meal',()=>{
 const s=encounter('letter');delete s.people[0].workedDay;s.ap=0;const demand=dailyConsumption(s),before=structuredClone(s.resources);
 const after=respond(s,'deliver');assert.equal(after.people[0].workedDay,undefined);assert.equal(after.ap,0);assert.deepEqual(after.resources,before);assert.deepEqual(dailyConsumption(after),demand);
});

test('a promised letter requires a fresh outing, receives its reply after two real mornings, and cannot pay twice',()=>{
 let s=encounter('letter',true);s.visited.contact=3;s=respond(s,'deliver');const goal=explorationStory(s).goals[0];
 assert.equal(explorationGoalStatus(s,goal).ready,false);assert.throws(()=>act(s,{type:'explorationGoal',goal:goal.id}),/搜索/);
 s=act(s,{type:'search',site:'contact'});assert.equal(explorationGoalStatus(s,explorationStory(s).goals[0]).ready,true);
 const before=s.resources.medicine;s=act(s,{type:'explorationGoal',goal:goal.id});assert.equal(explorationStory(s).goals[0].status,'awaiting');assert.equal(bondStatus(s,'lin').value,3);
 assert.throws(()=>act(s,{type:'explorationGoal',goal:goal.id}));s=nextMorning(s);assert.equal(s.memories.includes(EXPLORATION_GOALS.letter.memory),false);
 s=nextMorning(s);assert.ok(s.memories.includes(EXPLORATION_GOALS.letter.memory));assert.equal(explorationStory(s).goals[0].status,'completed');assert.equal(s.resources.medicine,before);
 assert.equal(s.memories.filter(m=>m===EXPLORATION_GOALS.letter.memory).length,1);assert.ok(explorationEnding(s).completed.includes(EXPLORATION_GOALS.letter.title));
});

test('medical delivery costs medicine now and returns exactly the displayed amount later',()=>{
 let s=accept('medicine','promise');const id=explorationStory(s).goals[0].id;s=act(s,{type:'search',site:'market'});
 const before=structuredClone(s),action={type:'explorationGoal',goal:id};s=act(s,action);assert.equal(s.resources.medicine,before.resources.medicine-1);
 assert.deepEqual(actionResourceFlows(before,action,s).flatMap(f=>f.changes),[{resource:'medicine',amount:-1}]);
 s=nextMorning(s);const medicine=s.resources.medicine;s=nextMorning(s);assert.equal(s.resources.medicine,medicine+2);
 const settled=nextMorning(s);assert.equal(settled.resources.medicine,s.resources.medicine);
});

test('seed goal needs an operational garden, honest resource/AP costs and delayed food',()=>{
 let s=accept('seeds','plant');const id=explorationStory(s).goals[0].id;s=act(s,{type:'search',site:'pump'});
 assert.throws(()=>act(s,{type:'explorationGoal',goal:id}),/菜畦/);
 s.buildings=[{id:'garden',type:'garden',plot:0,level:1,branch:'normal',hp:0,age:0}];assert.throws(()=>act(s,{type:'explorationGoal',goal:id}),/菜畦/);
 s.buildings[0].hp=10;const before=structuredClone(s);s=act(s,{type:'explorationGoal',goal:id});assert.equal(s.ap,before.ap-1);assert.equal(s.resources.water,before.resources.water-1);assert.equal(s.people[0].fatigue,before.people[0].fatigue+5);
});

test('different landmark branches lead to different real destinations and immediate rewards',()=>{
 const start=encounter('landmark');
 for(const [choice,site,resource] of [['tools','shed','materials'],['garden','greenhouse','food']]){
  let s=respond(start,choice),g=explorationStory(s).goals[0];assert.equal(EXPLORATION_GOALS[g.type].site,site);
  s=act(s,{type:'search',site});const before=s.resources[resource];s=act(s,{type:'explorationGoal',goal:g.id});assert.equal(s.resources[resource],before+2);assert.equal(explorationStory(s).goals[0].status,'completed');
 }
});

test('goal capacity and abandonment never block ordinary gameplay or charge a penalty',()=>{
 let s=accept('letter','deliver');const state=explorationStory(s);state.goals.push({...state.goals[0],id:'second',type:'medicine'});
 const other=encounter('radio');s.flags.explorationStory.pending=explorationStory(other).pending;
 const before=structuredClone(s);assert.throws(()=>respond(s,'restore'),/最多/);assert.deepEqual(s,before);
 s=act(s,{type:'explorationGoal',goal:state.goals[0].id,abandon:true});assert.deepEqual(s.resources,before.resources);s=respond(s,'restore');assert.equal(explorationStory(s).goals.filter(g=>g.status==='active').length,R.maxActive);
 assert.equal(act(s,{type:'prepare'}).phase,'ready');
});

test('shared outings build a bounded relationship and unlock a distinct trusting response',()=>{
 let s=encounter('shared',true),view=encounterView(s);assert.equal(bondStatus(s,'lin').value,1);
 assert.throws(()=>respond(s,'trust'),/共同经历/);const before=structuredClone(s);s=respond(s,'listen');assert.equal(bondStatus(s,'lin').value,3);assert.equal(s.ap,before.ap-1);assert.equal(s.people[0].fear,Math.max(0,before.people[0].fear-4));
 const fresh=encounter('shared',true);fresh.flags.explorationStory.bonds.lin=2;const trusted=respond(fresh,'trust');assert.equal(bondStatus(trusted,'lin').value,3);assert.ok(trusted.memories.includes('与林禾说过的牵挂'));assert.deepEqual(trusted.resources,fresh.resources);assert.equal(trusted.ap,fresh.ap);
 fresh.flags.explorationStory.bonds.lin=6;assert.equal(bondStatus(respond(fresh,'listen'),'lin').value,6);
});

test('missing or deceased companions can leave their encounter safely; nothing creates posthumous relationship gains',()=>{
 const s=encounter('shared',true);s.people[1].dead=true;assert.deepEqual(encounterView(s).choices.map(c=>c.id),['leave']);assert.equal(encounterView(respond(s,'leave')),null);
});

test('a prepared night and back-day restore the exact narrative decisions; night result cannot forge them',()=>{
 const s=accept('letter','deliver',true),ready=act(s,{type:'prepare'}),back=act(ready,{type:'backDay'});assert.deepEqual(back.flags.explorationStory,s.flags.explorationStory);
 const b=createBattle(ready,'story-integrity');b.finished=true;const result=settleNight(ready,b);assert.deepEqual(result.flags.explorationStory,ready.flags.explorationStory);assert.doesNotThrow(()=>validateClientResult(ready,result));
 const forged=structuredClone(result);forged.flags.explorationStory.bonds.lin=6;assert.throws(()=>validateClientResult(ready,forged),/剧情/);
});

test('ignoring an encounter has a recorded outcome next morning and late replies are preserved as waiting at rescue',()=>{
 const ignored=nextMorning(encounter('letter'));assert.equal(encounterView(ignored),null);assert.ok(explorationStory(ignored).journal.some(e=>e.text.includes('没有在')));
 let late=accept('medicine','promise');late=act(late,{type:'search',site:'market'});late.day=28;late=act(late,{type:'explorationGoal',goal:explorationStory(late).goals[0].id});
 const g=explorationStory(late).goals[0];assert.equal(g.dueDay,30);assert.match(explorationGoalStatus(late,g).text,/晚于救援/);
 const ready=act(late,{type:'prepare'}),b=createBattle(ready,'ending-story');b.finished=true;const result=settleNight(ready,b);assert.equal(result.phase,'rescued');assert.ok(result.ending.exploration.waiting.includes(EXPLORATION_GOALS.medicine.title));
});
