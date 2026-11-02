import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,applyCampaignAction as action} from '../src/campaign.js';
import {createBattle} from '../src/battle.js';
import {weather} from '../src/content.js';
function upgraded(type,mode,w){const seed=Array.from({length:11},(_,i)=>i+1).find(seed=>weather(1,seed)===w);let s=action(initialCampaign(seed),{type:'chooseRole',role:'repairman'});s=action(s,{type:'build',building:type});const before=structuredClone(s);s=action(s,{type:'upgradeBuilding',id:s.buildings[0].id,branch:mode});assert.equal(s.ap,before.ap-2);assert.equal(s.resources.materials,before.resources.materials-4);assert.equal(s.resources.parts,before.resources.parts-1);s.buildings[0].age=1;return s;}

test('rain rewards high yield, hot weather rewards steady and normal weather ties for crops and water',()=>{
 for(const [type,resource,expected] of [['garden','food',{clear:[5,5],fog:[5,5],rain:[6,5],hot:[4,5]}],['water','water',{clear:[3,3],fog:[3,3],rain:[4,3],hot:[2,3]}]]){
  for(const [w,amounts] of Object.entries(expected)){
   const outputs=['yield','steady'].map(mode=>{const base=upgraded(type,mode,w),prepared=action(base,{type:'prepare'});return prepared.resources[resource]-base.resources[resource];});
   assert.deepEqual(outputs,amounts,`${type}/${w}`);
  }
 }
});

test('steady watchtower wins in fog while high yield wins in clear weather and scouting still stacks',()=>{
 for(const [w,expected] of [['clear',[45,35]],['fog',[31.5,45]]]){
  const ranges=['yield','steady'].map(mode=>{const base=action(upgraded('watchtower',mode,w),{type:'prepare'});return createBattle(base,'tower').warningLead;});ranges.forEach((range,i)=>assert.ok(Math.abs(range-expected[i])<1e-8,`${w}/${i}: ${range}`));
  const scouted=action(upgraded('watchtower','steady',w),{type:'prepare'});scouted.flags.scouted=1;assert.equal(createBattle(scouted,'scouted').warningLead,expected[1]+12);
 }
});

test('existing steady saves use the new harvest once and replanning cannot duplicate it',()=>{
 for(const [type,resource,amount] of [['garden','food',5],['water','water',3]]){
  const base=upgraded(type,'steady','hot'),saved=JSON.parse(JSON.stringify(base)),prepared=action(saved,{type:'prepare'});
  assert.equal(prepared.resources[resource]-base.resources[resource],amount);
  const day=action(prepared,{type:'backDay'});assert.deepEqual(day.resources,base.resources);assert.equal(action(day,{type:'prepare'}).resources[resource],prepared.resources[resource]);
  assert.deepEqual(saved,base);assert.equal(saved.buildings[0].branch,'steady');
 }
});
