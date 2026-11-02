import test from 'node:test';import assert from 'node:assert/strict';
import {initialCampaign,applyCampaignAction as act,makePerson,settleNight,normalizeCampaign} from '../src/campaign.js';
import {dailyConsumption,needs,personFoodConsumption} from '../src/rules.js';
import {createBattle,battleCommand,stepBattle} from '../src/battle.js';import {validateClientResult} from '../src/client-result.js';
import {rationsPanel,rationState} from '../client/rations.js';
const day=()=>act(initialCampaign(53),{type:'chooseRole',role:'repairman'});
const meals=(s,id='hero')=>dailyConsumption(s).personMeals.find(p=>p.id===id);
function night(s){const base=act(s,{type:'prepare'}),b=createBattle(base,'rations',{autoPause:false});b.challenge=null;b.schedule=[{at:9999,type:'walker',zone:'gate'}];return {base,b};}

test('each person costs one base meal, one daytime meal and one night-duty meal at most',()=>{
 for(const work of [false,true])for(const duty of ['sleep','guard','support']){
  let s=day();s=act(s,{type:'nightRole',person:'hero',role:duty});if(work)s=act(s,{type:'search',site:'shed'});
  const expected=1+Number(work)+Number(duty!=='sleep');assert.equal(needs(s).food,expected);assert.deepEqual(meals(s),{id:'hero',name:'你',base:1,work:Number(work),night:Number(duty!=='sleep'),food:expected});
  const {base,b}=night(s),before=b.resources.food,done=settleNight(base,b);assert.equal(done.report.foodUsed,expected);assert.equal(done.resources.food,before-expected);validateClientResult(base,done);
 }
});

test('hero multiple actions, later rest, failed actions and free switches do not multiply the daily work meal',()=>{
 let s=day();s=act(s,{type:'nightRole',person:'hero',role:'sleep'});assert.equal(needs(act(s,{type:'rest'})).food,1);
 const before=structuredClone(s);assert.throws(()=>act(s,{type:'build',building:'bad'}));assert.deepEqual(s,before);
 s=act(s,{type:'repair',zone:'gate'});assert.equal(needs(s).food,2);s=act(s,{type:'search',site:'shed'});s=act(s,{type:'rest'});assert.equal(needs(s).food,2);assert.equal(s.people[0].workedDay,1);
 s=act(s,{type:'toggleFire',target:'central'});assert.equal(needs(s).food,2);
});

test('planned companion jobs add one meal, cancellation removes it, and all completed one-shot jobs retain it',()=>{
 for(const job of ['water','forage','scout','care','repair','craft']){
  let s=act(day(),{type:'recruit',person:'lin'});s.resources.materials=20;s=act(s,{type:'assign',person:'lin',job});assert.equal(meals(s,'lin').food,3,job);
  const rest=act(s,{type:'assign',person:'lin',job:'rest'});assert.equal(meals(rest,'lin').food,2);assert.equal(meals(rest,'lin').work,0);
  const ready=act(s,{type:'prepare'});assert.equal(meals(ready,'lin').work,1);assert.equal(ready.people[1].workedDay,1);assert.equal(needs(ready).food,5);if(['repair','craft'].includes(job))assert.equal(ready.people[1].job,'rest');
  const backed=act(ready,{type:'backDay'});assert.equal(backed.people[1].workedDay,undefined);assert.equal(meals(backed,'lin').work,1);assert.equal(needs(act(backed,{type:'prepare'})).food,5);
 }
});

test('escort charges both participants once and marks survive dusk while unavailable and severe jobs do not charge',()=>{
 let s=act(day(),{type:'recruit',person:'lin'});s=act(s,{type:'search',site:'shed',escort:'lin'});assert.equal(needs(s).food,6);const ready=act(s,{type:'prepare'});assert.equal(ready.people[1].job,'rest');assert.equal(needs(ready).food,6);
 s=day();s.people.push(makePerson('lin','林禾','园艺师','survival'));s.people[1].job='farm';s.buildings=[{id:'g',type:'garden',hp:0,level:1}];assert.equal(meals(s,'lin').work,0);assert.equal(meals(act(s,{type:'prepare'}),'lin').work,0);
 Object.assign(s.people[1],{job:'water',wound:'severe',health:10,deadline:3});assert.equal(meals(s,'lin').food,1);assert.equal(meals(act(s,{type:'prepare'}),'lin').food,1);
});

test('night duty persists through injury and retreat, but an uninterrupted severe patient or sleeper costs no night meal',()=>{
 let s=day();const {base,b}=night(s);assert.equal(meals(b).night,1);Object.assign(b.people[0],{wound:'severe',health:19,deadline:3});assert.equal(needs(b).food,2);assert.equal(settleNight(base,b).report.foodUsed,2);
 for(const severe of [false,true]){s=day();s.people[0].nightRole='sleep';if(severe)Object.assign(s.people[0],{wound:'severe',health:19,deadline:3});const f=night(s);assert.equal(needs(f.b).food,1);assert.equal(settleNight(f.base,f.b).report.foodUsed,1);}
});

test('queued then cancelled sleeper orders do not charge; actual temporary orders add exactly one permanent nightly meal',()=>{
 let s=day();s.flags.centralFire=false;s.people[0].nightRole='sleep';const {base,b}=night(s);
 battleCommand(b,{type:'move',person:'hero',target:{x:315,y:365}});assert.equal(needs(b).food,2);battleCommand(b,{type:'cancel',person:'hero'});assert.equal(needs(b).food,1);
 const before=structuredClone(b);assert.throws(()=>battleCommand(b,{type:'move',person:'hero',target:{x:NaN,y:0}}));assert.deepEqual(b,before);
 battleCommand(b,{type:'move',person:'hero',target:{x:315,y:365}});battleCommand(b,{type:'resume'});stepBattle(b);battleCommand(b,{type:'cancel',person:'hero'});assert.equal(b.people[0].nightDutyDay,1);assert.equal(needs(b).food,2);
 battleCommand(b,{type:'retreat',person:'hero'});stepBattle(b);battleCommand(b,{type:'cancel',person:'hero'});assert.equal(needs(b).food,2);
 const result=settleNight(base,b);assert.equal(result.report.foodUsed,2);validateClientResult(base,result);assert.deepEqual(settleNight(base,b),result);
 const next=act(result,{type:'nextDay'});assert.equal(needs(next).food,1);assert.equal(meals(next).night,0);assert.equal(meals(next).work,0);
});

test('stove and cooking reductions apply after activity meals, keep the group minimum and exclude dead or departed people',()=>{
 let s=day();s.day=13;s.flags.cookedDay=13;s.buildings=[{id:'stove',type:'stove',level:2,branch:'yield',hp:10}];s.people[0].nightRole='sleep';assert.equal(needs(s).food,1);
 s.people.push(makePerson('lin','林禾','园艺师','survival'));s.people[1].job='water';const d=dailyConsumption(s);assert.equal(d.food,1);assert.equal(d.workExtra,1);assert.equal(d.nightExtra,1);
 s.people[1].dead=true;assert.equal(dailyConsumption(s).personMeals.length,1);assert.equal(needs(s).food,1);s.people[0].dead=true;assert.deepEqual(needs(s),{food:0,water:0});
});

test('live details use actual duty records and show every member without mutating saves; water stays unchanged',()=>{
 const s=act(day(),{type:'search',site:'shed'}),{b}=night(s),before=structuredClone(s);const d=dailyConsumption(rationState(s,b));assert.equal(d.food,3);assert.equal(d.water,1);const html=rationsPanel(s,b,'food');assert.match(html,/白天工作（1人）/);assert.match(html,/参与夜战（1人）/);assert.match(html,/1＋1＋1＝3食物/);assert.match(html,/每项每天只加一次/);assert.deepEqual(s,before);
 const fake=structuredClone(b.people[0]);fake.name='<img onerror=alert(1)>';assert.ok(!rationsPanel(s,{...b,people:[fake]},'food').includes('<img onerror='));
 const hot={...s,weather:'hot'};assert.equal(needs(hot).water,2);assert.equal(personFoodConsumption(hot,hot.people[0]).food,3);
});

test('new work markers survive JSON reload and old-page omission but forged daytime and future duty markers are rejected',()=>{
 const {base,b}=night(act(day(),{type:'search',site:'shed'})),done=settleNight(base,b);const loaded=JSON.parse(JSON.stringify(done));assert.equal(needs(loaded).food,3);assert.equal(loaded.report.foodUsed,3);
 const old=structuredClone(done);delete old.people[0].workedDay;validateClientResult(base,old);assert.equal(old.people[0].workedDay,1);
 const forged=structuredClone(done);forged.people[0].workedDay=2;assert.throws(()=>validateClientResult(base,forged),/白天工作/);
 const future=structuredClone(done);future.people[0].nightDutyDay=2;assert.throws(()=>validateClientResult(base,future),/参与记录/);
});


test('already-prepared legacy saves recover completed one-shot jobs from the saved daytime plan',()=>{
 let s=act(day(),{type:'recruit',person:'lin'});s=act(s,{type:'assign',person:'lin',job:'repair'});const ready=act(s,{type:'prepare'});delete ready.people[1].workedDay;assert.equal(ready.people[1].job,'rest');normalizeCampaign(ready);assert.equal(ready.people[1].workedDay,1);assert.equal(needs(ready).food,5);
});
