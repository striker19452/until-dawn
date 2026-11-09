import test from 'node:test';
import assert from 'node:assert/strict';
import { initialCampaign, applyCampaignAction as action, settleNight } from '../src/campaign.js';
import { createBattle, stepBattle, battleCommand } from '../src/battle.js';
import { ENEMIES, ZONES, weather } from '../src/content.js';
import { dailyChallenge, resolveChallenge } from '../src/challenges.js';
import { needs, tradeRules } from '../src/rules.js';
import {leaveHouse,enterHouse} from '../src/shelter.js';

function day(d=1){const s=action(initialCampaign(53),{type:'chooseRole',role:'repairman'});s.day=d;s.ap=100;s.resources={food:100,water:100,materials:100,fuel:100,medicine:100,parts:100};return s;}
function fixture(d=1){const b=createBattle(action(day(d),{type:'prepare'}),'fixture',{autoPause:false});b.schedule=[{at:9999,type:'walker',zone:'gate'}];b.paused=false;b.people[0].nightRole='sleep';b.people[0].x=240;b.people[0].y=350;return b;}
function enemy(type,zone='gate'){const z=ZONES.find(z=>z.id===zone);return {id:type,type,zone,x:z.x,y:z.y,hp:ENEMIES[type].hp,max:ENEMIES[type].hp,mode:'attack',attack:0,progress:0,stun:0,called:false};}
function advance(b,seconds){for(let i=0;i<seconds*20&&!b.finished;i++)stepBattle(b,.05);}
function facilityDay(type,mode){let s=day();s.people[0].health=40;s.people[0].fear=30;s.buildings=[{id:'f',type,level:mode==='normal'?1:2,branch:mode,age:1,enabled:true}];return action(s,{type:'prepare'});}

test('all 28 daily problems are deterministic, announced and respect the invasion and species budgets',()=>{
 const titles=new Set();for(let d=1;d<=28;d++){const s=action(day(d),{type:'prepare'}),a=createBattle(s,'a'),b=createBattle(s,'b');titles.add(a.challenge.title);assert.deepEqual(a.schedule,b.schedule);assert.deepEqual(a.challenge,dailyChallengeState(s));const expected=3+Math.floor((d-1)/3)+([7,14,21,28].includes(d)?3:0);assert.equal(a.schedule.length,expected-(a.challenge.replacementSlots||a.challenge.count)+a.challenge.count);assert.equal(a.schedule.filter(x=>x.challenge).length,a.challenge.count);assert.ok(a.challenge.hint.length>10);for(const wave of a.schedule)assert.ok(ENEMIES[wave.type].day<=d);assert.ok(a.schedule.every((x,i,arr)=>!i||arr[i-1].at<=x.at));}
 assert.equal(titles.size,28);
});
function dailyChallengeState(s){return {...dailyChallenge(s),spawned:0,defeated:0,entered:0,broken:[],newSevere:0,status:'pending',feedback:''};}

test('challenge success and failure follow actual breach, entry, summoning and health outcomes',()=>{
 for(const d of [1,2,3,12]){const b=fixture(d);b.challenge.spawned=1;resolveChallenge(b);assert.equal(b.challenge.status,'cleared');if(d===3)b.challenge.entered=1;else if(d===12)b.reinforcements=1;else b.challenge.broken=[b.challenge.zone];resolveChallenge(b);assert.equal(b.challenge.status,'missed');assert.ok(b.challenge.feedback.length>10);}
 const b=fixture();b.challenge.spawned=1;b.challenge.newSevere=1;resolveChallenge(b);assert.equal(b.challenge.status,'missed');
});

test('challenge earns a concrete reward only on success and seen species persist into the next night',()=>{
 const base=action(day(),{type:'prepare'}),b=createBattle(base,'reward',{autoPause:false});b.schedule=[];b.paused=false;b.elapsed=42;b.seen=['walker'];stepBattle(b);assert.equal(b.finished,true);const s=settleNight(base,b);assert.equal(s.resources.materials,base.resources.materials);assert.equal(s.achievements.length,1);assert.equal(s.report.materialsUsed,.0003);assert.equal(s.report.challenge.status,'cleared');assert.deepEqual(s.flags.seenTypes,['walker']);const next=action(s,{type:'nextDay'});assert.deepEqual(createBattle(action(next,{type:'prepare'}),'next').seen,['walker']);
 b.challenge.status='missed';const missed=settleNight(base,b);assert.equal(missed.resources.materials,base.resources.materials-1);assert.equal(missed.achievements,undefined);
});

test('challenge warning pauses before the encounter and pause freezes all timers',()=>{
 const s=action(day(9),{type:'prepare'});s.flags.seenTypes=Object.keys(ENEMIES);const b=createBattle(s,'warning');battleCommand(b,{type:'resume'});for(let i=0;i<400&&!b.paused;i++)stepBattle(b);assert.match(b.reason,/挑战预警/);assert.ok(b.elapsed<24);const frozen=structuredClone(b);advance(b,2);assert.deepEqual(b,frozen);
});

test('six previously inert building upgrades now change production, consumption or warning',()=>{
 const normal=facilityDay('workshop','normal');assert.equal(tradeRules(facilityDay('exchange','yield')).limit,3);assert.equal(tradeRules(facilityDay('exchange','steady')).offers.medicine.pay.materials,3);
 for(const mode of ['normal','yield','steady']){let s=day();s=action(s,{type:'recruit',person:'lin'});s.buildings=normal.buildings.map(b=>({...b,level:mode==='normal'?1:2,branch:mode}));const before=s.resources.materials;s=action(s,{type:'assign',person:'lin',job:'craft'});assert.equal(before-s.resources.materials,mode==='steady'?1:2);s=action(s,{type:'prepare'});assert.equal(s.zones[1].traps,mode==='yield'?3:2);}
 assert.equal(facilityDay('generator','yield').resources.parts,102);assert.equal(facilityDay('generator','yield').resources.fuel,98);assert.equal(facilityDay('generator','steady').exposure,0);
 assert.equal(facilityDay('infirmary','normal').people[0].health,43);assert.equal(facilityDay('infirmary','yield').people[0].health,46);assert.equal(facilityDay('infirmary','steady').people[0].fear,26);
 const high=createBattle(facilityDay('watchtower','yield'),'high'),steady=createBattle(facilityDay('watchtower','steady'),'steady');assert.equal(high.warningLead,weather(1,53)==='fog'?31.5:45);assert.equal(steady.warningLead,weather(1,53)==='fog'?45:35);
 let s=day();s.day=15;s.beds=5;for(const person of ['lin','zhou','chen','xu'])s=action(s,{type:'recruit',person});s.buildings=[{type:'stove',level:2,branch:'yield'}];assert.equal(needs({...s,weather:'hot'}).food,8);assert.equal(needs({...s,weather:'hot'}).water,7);
});

test('sun, rain and two upgraded crop/filter branches match published yields',()=>{
 for(const type of ['garden','water'])for(const mode of ['normal','yield','steady'])for(let seed=1;seed<=11;seed++){let s=day();s.seed=seed;s.buildings=[{id:'f',type,level:mode==='normal'?1:2,branch:mode,age:1}];const w=weather(1,seed),p=action(s,{type:'prepare'}),key=type==='garden'?'food':'water';const expected=type==='garden'?(mode==='normal'?3:5)+(mode==='steady'?0:w==='rain'?1:w==='hot'?-1:0):(mode==='normal'?(w==='rain'?3:w==='hot'?1:2):mode==='yield'?(w==='rain'?4:w==='hot'?2:3):3);assert.equal(p.resources[key]-s.resources[key],expected);}
});

test('all six species deal their specified fence damage and fire/brace multiply it',()=>{
 for(const [type,def]of Object.entries(ENEMIES))for(const protection of ['none','fire','brace','both']){const b=fixture(28),e=enemy(type);b.enemies=[e];b.zones[0].hp=100;e.attack=def.interval;b.fires=[];let factor=1;if(['fire','both'].includes(protection)){b.fires=[{id:'central',x:240,y:390,wood:1,heat:60,wet:0,shade:true}];factor*=type==='rammer'?.85:.7;}if(['brace','both'].includes(protection)){const p=b.people[0],z=ZONES[0];p.x=z.x+(240-z.x)*.15;p.y=z.y+(350-z.y)*.15;p.task={type:'brace',target:'gate',progress:0,reserved:{}};factor*=.45;}stepBattle(b);assert.ok(Math.abs(b.zones[0].hp-(100-def.damage*factor))<1e-8,`${type}/${protection}`);}
});

test('inside damage is continuous, stacks, and sleeping characters remain vulnerable while retreating outside shelter',()=>{
 const b=fixture(28);b.fires=[];const p=b.people[0];enterHouse(b,p);b.enemies=[{...enemy('walker'),x:240,y:350,mode:'inside'},{...enemy('caller'),x:240,y:350,mode:'inside'}];advance(b,1);assert.ok(Math.abs(b.house-96.4)<1e-7);assert.equal(p.health,100);const e=b.enemies[0];leaveHouse(b,p);p.x=e.x=400;p.y=e.y=400;stepBattle(b);assert.ok(p.health<100);
});

test('lure continuously attracts later arrivals once each; compaction persists for the night',()=>{
 const b=fixture(16),p=b.people[0];p.x=240;p.y=456.25;battleCommand(b,{type:'bait',person:p.id,target:'gate'});advance(b,3.1);assert.equal(b.lures.length,1);const e={...enemy('walker','right'),x:300,y:450,mode:'approach'};b.enemies=[e];stepBattle(b);assert.equal(e.zone,'gate');assert.equal(b.lures[0].affected.length,1);e.zone='right';stepBattle(b);assert.equal(e.zone,'right');advance(b,12);assert.equal(b.lures.length,0);
 const c=fixture(16),q=c.people[0],z=ZONES[3];q.x=z.x+(240-z.x)*.15;q.y=z.y+(350-z.y)*.15;battleCommand(c,{type:'compact',person:q.id,target:'backLeft'});advance(c,5.1);assert.equal(c.zones[3].compacted,true);c.enemies=[enemy('burrower','backLeft')];advance(c,8.5);assert.equal(c.enemies[0].mode,'attack');assert.ok(c.enemies[0].progress<3);advance(c,.1);assert.equal(c.enemies[0].mode,'inside');
});

test('shelter halves spray damage and wet duration, and clearWet restores the fire effect',()=>{
 for(const shade of [false,true]){const b=fixture(20),e=enemy('quencher');b.enemies=[e];b.fires=[{id:'central',x:e.x,y:e.y,wood:1,heat:60,wet:0,shade}];e.progress=8;stepBattle(b);assert.ok(Math.abs(b.fires[0].heat-(60-.018-(shade?9:18)))<1e-7);assert.equal(b.fires[0].wet,shade?4:8);}
});

test('a new severe injury opens a fresh one-time extension window; changing route invalidates its delivery',()=>{
 let s=day(15);s.people[0].health=10;s.people[0].wound='severe';s.people[0].extended=true;s.people[0].deadline=16;s=action(s,{type:'treat',person:'hero'});assert.equal(s.people[0].extended,false);s.flags.route='road';s.flags.routeDelivered=15;s=action(s,{type:'route',route:'river'});assert.equal(s.flags.routeDelivered,null);
});

test('deep search and skilled escort stack their gains without double-working',()=>{
 let s=day(3);s=action(s,{type:'recruit',person:'lin'});s.people[1].skills.exploration=2;
 const before=structuredClone(s),searched=action(s,{type:'search',site:'shed',deep:true,escort:'lin'});
 assert.equal(searched.ap,before.ap-3);assert.equal(searched.resources.materials-before.resources.materials,17);assert.equal(searched.resources.parts-before.resources.parts,3);assert.equal(searched.resources.fuel-before.resources.fuel,3);assert.equal(searched.exposure,before.exposure+1);assert.equal(searched.people[1].fatigue,10);assert.throws(()=>action(searched,{type:'assign',person:'lin',job:'forage'}));assert.throws(()=>action(searched,{type:'search',site:'shed'}));assert.deepEqual(action(s,{type:'search',site:'shed',deep:true,escort:'lin'}),searched);assert.deepEqual(s,before);
});

test('a deadline death cannot award challenge success, and rewards never hide consumed repair materials',()=>{
 let base=day();base.people[0].wound='severe';base.people[0].deadline=1;base=action(base,{type:'prepare',acceptDanger:true});const b=createBattle(base,'deadline');b.challenge.status='cleared';b.resources.materials-=2;const s=settleNight(base,b);assert.equal(s.phase,'failed');assert.equal(s.report.challenge.status,'missed');assert.equal(s.report.materialsUsed,2);assert.equal(s.achievements,undefined);
});
