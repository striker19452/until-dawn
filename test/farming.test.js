import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,applyCampaignAction as act} from '../src/campaign.js';
import {skillInfo} from '../client/skills.js';

test('plant care pays 2 below survival rank 2 and 3 from rank 2 before growth, without duplicating on replanning',()=>{
 for(const [rank,amount] of [[0,2],[.99,2],[1,2],[1.92,2],[1.99,2],[2,3],[2.99,3],[3,3]]){
  let s=act(initialCampaign(5),{type:'chooseRole',role:'repairman'});
  s=act(s,{type:'recruit',person:'lin'});s=act(s,{type:'build',building:'garden'});
  s.people[1].skills.survival=rank;s=act(s,{type:'assign',person:'lin',job:'farm'});
  const before=structuredClone(s),ready=act(s,{type:'prepare'});
  assert.equal(ready.resources.food-s.resources.food,amount);
  assert.equal(ready.people[1].skills.survival,Math.min(3,rank+.08));
  assert.ok(ready.jobGains.includes(`林禾照料增收${amount}食物`));
  assert.equal(ready.people[1].fatigue,s.people[1].fatigue+10);
  assert.equal(act(act(ready,{type:'backDay'}),{type:'prepare'}).resources.food,ready.resources.food);
  assert.deepEqual(s,before);
 }
});

test('survival lookup shows both production tiers and only the next actual production increase',()=>{
 const person={id:'lin',skills:{survival:0}};
 for(const rank of [0,1,1.99,2,2.99]){
  person.skills.survival=rank;const info=skillInfo(person,'survival');
  assert.deepEqual(info.levels.map(l=>l.effect),[2,2,3,3].map(n=>`同伴照料种植：额外${n}食物／日`));
  if(rank<2)assert.match(info.next,/达到2级/);
  else assert.equal(info.next,'下一个上限为3级；2级以上暂无额外数值收益。');
  assert.match(info.note,/低于2级产2，2级及以上产3/);
  assert.match(info.note,/掌灶每人再省1食物/);
 }
 person.skills.survival=3;assert.equal(skillInfo(person,'survival').next,'已达上限3级。');
});
