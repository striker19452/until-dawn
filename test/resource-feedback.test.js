import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,applyCampaignAction,settleNight} from '../src/campaign.js';
import {createBattle,battleCommand,stepBattle} from '../src/battle.js';
import {actionResourceFlows,createResourceTracker} from '../client/resource-feedback.js';

const day=()=>applyCampaignAction(initialCampaign(53),{type:'chooseRole',role:'repairman'});
test('crafting shows both ingredients and output, and production income cannot hide a generator charge',()=>{
 let s=applyCampaignAction(day(),{type:'build',building:'garden'});const before=structuredClone(s),action={type:'craft',item:'medicine'},after=applyCampaignAction(s,action);
 const flows=actionResourceFlows(s,action,after);assert.deepEqual(flows.flatMap(f=>f.changes),[{resource:'materials',amount:-1},{resource:'water',amount:-1},{resource:'fuel',amount:-1},{resource:'medicine',amount:1}]);assert.deepEqual(flows.map(f=>f.kind),['spend','gain']);assert.deepEqual(s,before);
 s=applyCampaignAction(day(),{type:'recruit',person:'lin'});s.buildings=[{type:'generator',level:1,enabled:true}];s=applyCampaignAction(s,{type:'assign',person:'lin',job:'forage'});
 const prepared=applyCampaignAction(s,{type:'prepare'});assert.equal(prepared.resources.fuel-s.resources.fuel,3);
 assert.deepEqual(actionResourceFlows(s,{type:'prepare'},prepared).map(f=>[f.reason,f.changes]),[['发电设施运转',[{resource:'fuel',amount:-1}]],['发电设施产出',[{resource:'parts',amount:1}]],['发电噪声',[{resource:'exposure',amount:1}]],['林禾 · 搜集燃料',[{resource:'fuel',amount:4}]]]);
});

test('search, exchange, recycling and harvest receipts account for the actual stock changes',()=>{
 const cases=[
  [day(),{type:'search',site:'alley',deep:true},[{resource:'exposure',amount:1},{resource:'food',amount:8},{resource:'water',amount:4},{resource:'materials',amount:3}]],
  [{...day(),buildings:[{type:'exchange',level:1}]},{type:'trade',offer:'food'},[{resource:'parts',amount:-1},{resource:'food',amount:4},{resource:'water',amount:2}]],
  [{...day(),day:19,resources:{...day().resources,parts:2}},{type:'event',choice:'salvage'},[{resource:'parts',amount:-2},{resource:'materials',amount:4},{resource:'fuel',amount:3}]],
  [{...day(),buildings:[{id:'garden',type:'garden',level:1}]},{type:'demolish',id:'garden'},[{resource:'materials',amount:2}]]
 ];
 for(const [before,action,changes]of cases){const after=applyCampaignAction(before,action);assert.deepEqual(actionResourceFlows(before,action,after).flatMap(f=>f.changes),changes);}
 let s=applyCampaignAction(day(),{type:'recruit',person:'lin'});s.buildings=[{type:'garden',level:1,age:1},{type:'water',level:1}];s=applyCampaignAction(s,{type:'assign',person:'lin',job:'water'});
 const after=applyCampaignAction(s,{type:'prepare'}),flows=actionResourceFlows(s,{type:'prepare'},after);assert.deepEqual(flows.map(f=>f.reason),['菜畦收获','集水过滤','林禾 · 过滤取水']);assert.ok(flows.every(f=>f.kind==='gain'));
 for(const key of Object.keys(s.resources))assert.equal(flows.flatMap(f=>f.changes).filter(c=>c.resource===key).reduce((sum,c)=>sum+c.amount,0),after.resources[key]-s.resources[key]);
});

test('challenge income appears once at settlement, and failed challenges grant no receipt',()=>{
 const base=applyCampaignAction(day(),{type:'prepare'}),b=createBattle(base,'challenge-income',{autoPause:false});b.challenge={title:'守住院子',status:'cleared'};
 const shown=[],tracker=createResourceTracker(f=>shown.push(f)),result=settleNight(base,b);tracker.night(b,result,base.resources);tracker.night(b,result,base.resources);
 const rewards=shown.filter(f=>f.kind==='gain');assert.equal(rewards.length,1);assert.match(rewards[0].reason,/天亮.*挑战奖励/);assert.deepEqual(rewards[0].changes,[{resource:'materials',amount:1}]);
 b.house=0;const failed=settleNight(base,b),failedShown=[];createResourceTracker(f=>failedShown.push(f)).night(b,failed,base.resources);assert.ok(failedShown.every(f=>f.kind!=='gain'));
});

test('working reservations distinguish refunds from new costs even when inventory stays the same',()=>{
 let s=applyCampaignAction(day(),{type:'recruit',person:'lin'});const action={type:'assign',person:'lin',job:'repair'};s=applyCampaignAction(s,action);
 const after=applyCampaignAction(s,action);assert.deepEqual(after.resources,s.resources);
 assert.deepEqual(actionResourceFlows(s,action,after).map(f=>[f.kind,f.changes[0].amount]),[['refund',1],['spend',-1]]);
 const prepared=applyCampaignAction(after,{type:'prepare'});assert.deepEqual(actionResourceFlows(prepared,{type:'backDay'},applyCampaignAction(prepared,{type:'backDay'})),[]);
 const failed=[];assert.throws(()=>applyCampaignAction(day(),{type:'build',building:'missing'},{onResourceFlow:f=>failed.push(f)}));assert.deepEqual(failed,[]);
});

test('night receipts reflect initial firewood, reservation and cancellation once, never completion again',()=>{
 const base=applyCampaignAction(day(),{type:'prepare'}),b=createBattle(base,'receipts',{autoPause:false});b.schedule=[{at:9999,type:'walker',zone:'gate'}];b.challenge=null;
 const shown=[],tracker=createResourceTracker(f=>shown.push(f));tracker.night(b,null,base.resources);tracker.night(structuredClone(b),null,base.resources);assert.equal(shown.length,1);assert.deepEqual(shown[0].changes,[{resource:'materials',amount:-1}]);
 battleCommand(b,{type:'repair',person:'hero',target:'gate'});tracker.night(b,null,base.resources);assert.equal(shown.at(-1).kind,'reserve');
 battleCommand(b,{type:'resume'});for(let i=0;i<200&&b.people[0].task;i++)stepBattle(b);assert.equal(b.people[0].task,null);tracker.night(b,null,base.resources);assert.equal(shown.length,2);
 b.fires[0].wood=.2;const stock=b.resources.materials;battleCommand(b,{type:'addWood',person:'hero',target:'central'});battleCommand(b,{type:'cancel',person:'hero'});assert.equal(b.resources.materials,stock);
 tracker.night(b,null,base.resources);assert.deepEqual(shown.slice(-2).map(f=>[f.kind,f.changes[0].amount]),[['reserve',-1],['refund',1]]);
 const copy=structuredClone(b);assert.throws(()=>battleCommand(b,{type:'aid',person:'missing'}));assert.deepEqual(b,copy);
 const result=settleNight(base,b);tracker.night(b,result,base.resources);const count=shown.length;tracker.night(b,result,base.resources);assert.equal(shown.length,count);assert.match(shown.at(-1).reason,/口粮结算/);assert.deepEqual(shown.at(-1).changes,[{resource:'food',amount:-2},{resource:'water',amount:-1}]);
 assert.equal('resourceFlows' in result,false);assert.equal('resourceFlowSeq' in result,false);
 const restart=createBattle(base,'receipts',{autoPause:false});tracker.beginNight();tracker.night(restart,null,base.resources);assert.equal(shown.length,count+1);assert.match(shown.at(-1).reason,/入夜添柴/);
});

test('automatic work has a timed purpose and request replay never repeats its receipt',()=>{
 const base=applyCampaignAction(day(),{type:'prepare'}),b=createBattle(base,'auto-cost',{autoPause:false});b.schedule=[{at:9999,type:'walker',zone:'gate'}];b.challenge=null;b.paused=false;b.people[0].nightRole='support';b.fires[0].heat=20;b.fires[0].wood=.2;stepBattle(b);
 assert.match(b.resourceFlows.at(-1).reason,/自动添柴预留/);assert.equal(b.resourceFlows.at(-1).time,.05);
 const shown=[],tracker=createResourceTracker(flow=>shown.push(flow)),action={type:'build',building:'garden'},s=day(),after=applyCampaignAction(s,action);tracker.action(s,action,after,'same-request');tracker.action(s,action,after,'same-request');assert.equal(shown.length,1);
});

test('exposure feedback uses actual limits, includes each source and labels morning with the new day',()=>{
 for(const [before,action,amount,reason]of [
  [day(),{type:'search',site:'alley',deep:true},1,'深搜居民小巷'],
  [{...day(),exposure:6},{type:'search',site:'alley',deep:true},0,null],
  [{...day(),day:24,exposure:5},{type:'event',choice:'signal'},1,'扩大接应信号'],
  [{...day(),day:18},{type:'help'},1,'邻里接应补给'],
  [{...day(),phase:'report',exposure:2},{type:'nextDay'},-1,'清晨自然消退'],
  [{...day(),phase:'report',exposure:0},{type:'nextDay'},0,null]
 ]){
  const after=applyCampaignAction(before,action),flows=actionResourceFlows(before,action,after).filter(f=>f.kind==='exposure');assert.equal(flows.length,amount?1:0);
  if(amount){assert.equal(flows[0].reason,reason);assert.deepEqual(flows[0].changes,[{resource:'exposure',amount}]);}
 }
 const shown=[],tracker=createResourceTracker(f=>shown.push(f)),before={...day(),phase:'report',exposure:2},action={type:'nextDay'},after=applyCampaignAction(before,action);tracker.action(before,action,after,'morning');tracker.action(before,action,after,'morning');assert.equal(shown.length,1);assert.equal(shown[0].reason,'第2天 · 清晨自然消退');
});

test('generator noise and scouting are both visible when net exposure is unchanged; rollback and failure emit no false changes',()=>{
 let s=applyCampaignAction(day(),{type:'recruit',person:'lin'});s.buildings=[{id:'gen',type:'generator',level:1,enabled:true}];s=applyCampaignAction(s,{type:'assign',person:'lin',job:'scout'});
 const before=structuredClone(s),action={type:'prepare'},after=applyCampaignAction(s,action),observed=[];assert.equal(after.exposure,0);assert.deepEqual(s,before);
 assert.deepEqual(actionResourceFlows(s,action,after).filter(f=>f.kind==='exposure').map(f=>[f.reason,f.changes[0].amount]),[['发电噪声',1],['林禾 · 侦察巡查',-1]]);
 assert.deepEqual(applyCampaignAction(s,action,{onResourceFlow:f=>observed.push(f)}),after);assert.equal('resourceFlows' in after,false);
 assert.deepEqual(actionResourceFlows(after,{type:'backDay'},applyCampaignAction(after,{type:'backDay'})),[]);
 const steady=structuredClone(s);steady.buildings[0].branch='steady';assert.ok(actionResourceFlows(steady,action,applyCampaignAction(steady,action)).every(f=>f.kind!=='exposure'));
 const failed=[];assert.throws(()=>applyCampaignAction({...day(),ap:0},{type:'search',site:'alley',deep:true},{onResourceFlow:f=>failed.push(f)}));assert.deepEqual(failed,[]);
});
