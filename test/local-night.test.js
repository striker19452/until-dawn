import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalNight,localNightId } from '../src/local-night.js';
import { initialCampaign,applyCampaignAction,settleNight } from '../src/campaign.js';
import { createBattle,stepBattle } from '../src/battle.js';
import { validateClientResult } from '../src/client-result.js';
import { createRenderBudget } from '../client/presentation.js';
function fixture(){let state=applyCampaignAction(initialCampaign(53),{type:'chooseRole',role:'watchman'});state=applyCampaignAction(state,{type:'prepare'});return {runId:'test-run',revision:2,state};}

test('local clock and commands advance the night without network or storage and match the shared deterministic rules',()=>{
 const base=fixture();let time=0;const sent=[],copy=structuredClone(base),runner=createLocalNight(base,{now:()=>time,emit:m=>sent.push(structuredClone(m))});runner.command({type:'autoPause',enabled:false});runner.command({type:'resume'});
 const reference=createBattle(base.state,localNightId(base),{autoPause:false});reference.paused=false;
 while(!runner.battle.finished){time+=50;runner.tick();if(!reference.finished)stepBattle(reference,.05);}
 assert.deepEqual(runner.result,settleNight(base.state,reference));assert.deepEqual(base,copy);assert.ok(sent.at(-1).result);assert.ok(runner.steps>0);assert.equal(runner.steps,Math.round(runner.battle.elapsed/.05));assert.ok(sent.length<runner.steps/1.5);validateClientResult(base.state,runner.result);
});

test('pause, background gaps and duplicate commands cannot consume time or reserve twice',()=>{
 const base=fixture();let time=0;const runner=createLocalNight(base,{now:()=>time});const before=structuredClone(runner.battle);time=10000;runner.tick();assert.deepEqual(runner.battle,before);
 const materials=runner.battle.resources.materials;runner.command({type:'repair',person:'hero',target:'gate'},'same');runner.command({type:'repair',person:'hero',target:'gate'},'same');assert.equal(runner.battle.resources.materials,materials-1);assert.throws(()=>runner.command({type:'cancel',person:'hero'},'same'));
 runner.command({type:'autoPause',enabled:false});runner.command({type:'resume'});time+=30000;runner.tick();assert.ok(runner.battle.elapsed<=.25);runner.command({type:'pause'});const frozen=structuredClone(runner.battle);time+=60000;runner.tick();assert.deepEqual(runner.battle,frozen);
});

test('client result validation rejects corrupt resources, identities and daytime edits',()=>{
 const base=fixture();let time=0;const runner=createLocalNight(base,{now:()=>time});runner.command({type:'autoPause',enabled:false});runner.command({type:'resume'});while(!runner.battle.finished){time+=50;runner.tick();}
 for(const mutate of [s=>s.resources.food=-1,s=>s.resources.materials+=100,s=>s.people[0].name='Changed',s=>s.people[0].health=null,s=>s.day++,s=>s.buildings.push({type:'garden'}),s=>s.zones[0].spikes=true]){const state=structuredClone(runner.result);mutate(state);assert.throws(()=>validateClientResult(base.state,state));}
});

test('new campfire remainder saves without allowing unknown flags or daytime story changes',()=>{
 const base=fixture(),battle=createBattle(base.state,localNightId(base),{autoPause:false});battle.paused=false;
 while(!battle.finished)stepBattle(battle);
 const result=settleNight(base.state,battle);
 assert.equal(Object.hasOwn(base.state.flags,'campfireWood'),false);
 assert.ok(result.flags.campfireWood>0&&result.flags.campfireWood<1);
 assert.equal(validateClientResult(base.state,result),result);
 for(const [mutate,message]of [
  [s=>s.flags.unknownStory=true,/未知剧情字段/],
  [s=>s.flags.centralFire=false,/未知剧情字段/],
  [s=>s.flags.routeWork++,/不能修改日间剧情/],
  [s=>s.flags.campfireWood=-1,/篝火柴料无效/],
  [s=>s.flags.campfireWood=100,/篝火柴料无效/]
 ]){const changed=structuredClone(result);mutate(changed);assert.throws(()=>validateClientResult(base.state,changed),message);}
});

test('sustained slow frames lower GPU resolution without changing the initial native Retina target',()=>{
 const budget=createRenderBudget(3);assert.equal(budget.ratio,3);for(let i=0;i<60;i++)budget.observe(16.67,true);assert.equal(budget.ratio,3);for(let i=0;i<340;i++)budget.observe(45,true);assert.equal(budget.ratio,1.5);const idle=createRenderBudget(3);for(let i=0;i<400;i++)idle.observe(100,false);assert.equal(idle.ratio,3);
});
