import test from 'node:test';
import assert from 'node:assert/strict';
import { initialCampaign, applyCampaignAction, settleNight } from '../src/campaign.js';
import { createBattle } from '../src/battle.js';
import { dailyConsumption, needs } from '../src/rules.js';

const act=(s,type,extra={})=>applyCampaignAction(s,{type,...extra});
function crew(stove=true){
 let s=act(initialCampaign(314),'chooseRole',{role:'repairman'});
 s.day=13;s.ap=50;s.resources={food:100,water:100,materials:100,fuel:100,medicine:10,parts:10};
 s=act(s,'beds');s=act(s,'beds');
 for(const person of ['lin','zhou','chen','meng'])s=act(s,'recruit',{person});
 if(stove)s=act(s,'build',{building:'stove'});
 for(const p of s.people){p.fear=50;p.fatigue=30;}
 return s;
}
function settle(s){const b=createBattle(s,'cooking-test');b.finished=true;b.challenge=null;return settleNight(s,b);}

test('Meng cooking stacks with every stove branch and the preview matches actual nightly food use',()=>{
 for(const [mode,expected] of [['normal',6],['yield',5],['steady',6]]){
  let s=crew();if(mode!=='normal')s=act(s,'upgradeBuilding',{id:s.buildings[0].id,branch:mode});
  const ap=s.ap,food=s.resources.food,fuel=s.resources.fuel,meng=s.people.find(p=>p.id==='meng');
  s=act(s,'assign',{person:'meng',job:'cook'});
  assert.equal(s.ap,ap);assert.equal(needs(s).food,expected);
  s=act(s,'prepare');assert.equal(s.flags.cookedDay,13);assert.equal(needs(s).food,expected);
  assert.equal(s.resources.food,food);assert.equal(s.resources.fuel,fuel);
  assert.equal(s.people.find(p=>p.id==='meng').fatigue,meng.fatigue+10);
  assert.equal(s.people.find(p=>p.id==='meng').skills.survival,meng.skills.survival+.08);
  const done=settle(s);assert.equal(done.report.foodUsed,expected);assert.equal(done.resources.food,food-expected);
 }
 let s=crew();s.people=s.people.filter(p=>['hero','meng'].includes(p.id));
 s=act(s,'assign',{person:'meng',job:'cook'});assert.equal(needs(s).food,3);
 s=act(s,'prepare');assert.equal(settle(s).report.foodUsed,3);
});

test('cooking saves one meal per living member regardless of skill and follows night deaths',()=>{
 for(const count of [2,3,4,5])for(const skill of [0,1.99,2,3]){
  let s=crew();s.people=[s.people[0],s.people.find(p=>p.id==='meng'),...s.people.filter(p=>!['hero','meng'].includes(p.id)).slice(0,count-2)];
  s.people[1].skills.survival=skill;s=act(s,'assign',{person:'meng',job:'cook'});
  assert.equal(dailyConsumption(s).cookingSaving,count);
  const ready=act(s,'prepare'),b=createBattle(ready,'cooking-headcount');
  assert.equal(dailyConsumption(b).cookingSaving,count);
  b.people.find(p=>p.id==='meng').dead=true;
  assert.equal(dailyConsumption(b).cookingSaving,count-1,'prepared meals remain available after the cook dies');
  assert.equal(settleNight(ready,b).report.foodUsed,needs(b).food);
 }
 let s=act(act(crew(),'assign',{person:'meng',job:'cook'}),'prepare');
 for(const p of s.people){delete p.workedDay;p.nightRole='sleep';}
 assert.equal(needs(s).food,1,'stacked discounts retain the one-food team minimum');
 s.people.forEach(p=>p.dead=true);assert.equal(dailyConsumption(s).cookingSaving,0);assert.equal(needs(s).food,0);
});

test('cooking requires Meng, an existing stove, and a free non-severe worker',()=>{
 let s=crew(false);assert.throws(()=>act(s,'assign',{person:'meng',job:'cook'}),/公共灶/);
 s=act(s,'build',{building:'stove'});assert.throws(()=>act(s,'assign',{person:'lin',job:'cook'}),/专属/);
 const wounded=structuredClone(s);wounded.people.find(p=>p.id==='meng').wound='severe';
 assert.throws(()=>act(wounded,'assign',{person:'meng',job:'cook'}),/重伤/);
 s=act(s,'search',{site:'shed',escort:'meng'});assert.throws(()=>act(s,'assign',{person:'meng',job:'cook'}),/随行/);
});

test('replanning cannot duplicate or retain cancelled cooking; removed stove or cook produces no meal',()=>{
 let s=act(crew(),'assign',{person:'meng',job:'cook'}),ready=act(s,'prepare');
 const backed=act(ready,'backDay');assert.equal(backed.flags.cookedDay,undefined);
 const again=act(backed,'prepare');assert.equal(needs(again).food,6);
 assert.equal(again.people.find(p=>p.id==='meng').fatigue,ready.people.find(p=>p.id==='meng').fatigue);
 const cancelled=act(act(backed,'assign',{person:'meng',job:'rest'}),'prepare');
 assert.equal(cancelled.flags.cookedDay,undefined);assert.equal(needs(cancelled).food,10);
 const demolished=act(act(s,'demolish',{id:s.buildings[0].id}),'prepare');
 assert.equal(demolished.flags.cookedDay,undefined);assert.equal(needs(demolished).food,11);
 const departed=structuredClone(s);departed.flags.neighborKnown=true;
 const moved=act(act(departed,'dismiss',{person:'meng',confirm:true}),'prepare');
 assert.equal(moved.flags.cookedDay,undefined);assert.equal(needs(moved).food,8);
 const next=act(settle(ready),'nextDay');
 assert.equal(needs(next).food,5,'retained cooking job previews the next day meal');
 const rested=act(next,'assign',{person:'meng',job:'rest'});
 assert.equal(needs(rested).food,9,'yesterday meal does not apply after changing job');
 assert.equal(needs(act(rested,'prepare')).food,9);
 const injuryBattle=createBattle(ready,'injury-after-duty');injuryBattle.people.find(p=>p.id==='meng').wound='severe';
 assert.equal(settleNight(ready,injuryBattle).report.foodUsed,6,'already prepared meal and completed duty survive a night injury');
});

test('Meng adds exactly two nightly fear reduction with a stove, even when not cooking',()=>{
 for(const stove of [false,true])for(const present of [false,true]){
  let s=crew(stove);if(!present)s.people=s.people.filter(p=>p.id!=='meng');
  const done=settle(act(s,'prepare'));
  assert.equal(done.people[0].fear,50-8-(stove?6+(present?2:0):0));
 }
});
