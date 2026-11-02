import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,applyCampaignAction as act,normalizeCampaign,settleNight,makePerson} from '../src/campaign.js';
import {createBattle,battleCommand,stepBattle} from '../src/battle.js';
import {campfireWood,campfireHeatDecay,campfireMaintenance,campfireActive,CENTRAL_FIRE} from '../src/campfire.js';
import {orderDuration} from '../src/night-orders.js';
import {orderStatus} from '../client/orders.js';
import {validateClientResult} from '../src/client-result.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function fixture(){let s=act(initialCampaign(53),{type:'chooseRole',role:'repairman'});s.people[0].nightRole='sleep';const base=act(s,{type:'prepare'}),b=createBattle(base,'tending',{autoPause:false});b.schedule=[{at:9999,type:'walker',zone:'gate'}];b.challenge=null;b.paused=false;b.weather='clear';return {base,b};}
function order(b,type){battleCommand(b,{type,person:'hero',target:'central'});b.people[0].task.stage='work';let ticks=0;while(b.people[0].task&&ticks++<400)stepBattle(b);assert.equal(b.people[0].task,null);return ticks*.05;}

test('wood is bounded to one at loading, preparation and every simulation step, without mutating an input save',()=>{
 assert.deepEqual([-1,0,.2,1,3,NaN,Infinity,undefined].map(campfireWood),[0,0,.2,1,1,0,0,0]);const s=act(initialCampaign(53),{type:'chooseRole',role:'repairman'});s.flags.campfireWood=3;s.preparationBase=structuredClone(s);s.preparationBase.flags.campfireWood=2;const saved=structuredClone(s),normal=normalizeCampaign(structuredClone(s));assert.equal(normal.flags.campfireWood,1);assert.equal(normal.preparationBase.flags.campfireWood,1);assert.deepEqual(s,saved);
 delete s.preparationBase;const base=act(s,{type:'prepare'}),b=createBattle(base,'old-stock');assert.equal(base.flags.campfireWood,1);assert.equal(b.fires[0].wood,1);assert.equal(b.resources.materials,base.resources.materials);
 b.paused=false;b.schedule=[{at:9999,type:'walker',zone:'gate'}];b.challenge=null;b.fires[0].heat=0;b.fires[0].wood=20;stepBattle(b);assert.equal(b.fires[0].wood,1);
});
test('rain speeds heat loss even at the central protected hearth, while wood use and spray wetness remain separate',()=>{
 for(const shade of [false,true])for(const weather of ['clear','hot','fog','rain']){const {b}=fixture();Object.assign(b.fires[0],{heat:60,wood:1,shade,wet:0});b.weather=weather;for(let i=0;i<20;i++)stepBattle(b);close(b.fires[0].heat,60-(weather==='rain'?.65:.36));close(b.fires[0].wood,.994);assert.equal(b.fires[0].wet,0);assert.equal(campfireActive(b),true);}
 assert.equal(campfireHeatDecay('rain'),.65);assert.equal(campfireHeatDecay('clear'),.36);
});
test('maintenance offers free stoking or relighting, paid refill only below a quarter, and remains usable without materials',()=>{
 for(const [wood,heat,materials,expected]of [[1,20,0,'stoke'],[.25,20,3,'stoke'],[.249,20,1,'addWood'],[.1,20,0,'stoke'],[.8,0,0,'fire'],[.1,0,0,'fire'],[0,0,0,'addWood'],[0,10,1,'addWood']])assert.equal(campfireMaintenance({wood,heat},materials),expected);
});
test('stoking raises heat for free in two base seconds, never adds wood, and uses fatigue-adjusted task status',()=>{
 for(const fatigue of [0,50]){const {b}=fixture();Object.assign(b.fires[0],{wood:.8,heat:20});b.people[0].fatigue=fatigue;b.resources.materials=0;b.supportBudget.firewood=0;const stock=structuredClone(b.resources),wood=b.fires[0].wood,flows=b.resourceFlows.length;const duration=orderDuration(b.people[0],'stoke');close(duration,2/(1-.004*fatigue));battleCommand(b,{type:'stoke',person:'hero',target:'central'});b.people[0].task.stage='work';assert.match(orderStatus(b.people[0],b).current,/拨火.*中央篝火/);while(b.people[0].task)stepBattle(b);assert.deepEqual(b.resources,stock);close(b.fires[0].heat,60);close(b.fires[0].wood,wood-b.elapsed*.006);assert.equal(b.resourceFlows.length,flows);assert.equal(b.supportUsed.firewood,0);assert.ok(b.events.some(e=>e.text==='拨火 · 免费'));}
 const {b}=fixture();b.fires[0].heat=95;order(b,'stoke');assert.equal(b.fires[0].heat,100);
});
test('free stoking cannot light an empty or extinguished hearth and does not clean spray wetness',()=>{
 for(const [heat,wood]of [[0,1],[20,0]]){const {b}=fixture();Object.assign(b.fires[0],{heat,wood});const before=structuredClone(b);assert.throws(()=>battleCommand(b,{type:'stoke',person:'hero',target:'central'}),/火星和余柴/);assert.deepEqual(b,before);}
 const {b}=fixture();Object.assign(b.fires[0],{heat:20,wet:20});order(b,'stoke');assert.equal(b.fires[0].heat,60);assert.ok(b.fires[0].wet>17);assert.equal(campfireActive(b),false);
});
test('low wood refills to exactly one for one material; enough wood rejects paid refills atomically',()=>{
 for(const heat of [0,40]){const {b}=fixture();Object.assign(b.fires[0],{heat,wood:.2});const materials=b.resources.materials;order(b,'addWood');assert.equal(b.resources.materials,materials-1);assert.equal(b.fires[0].wood,1);assert.ok(b.fires[0].heat>=60);assert.ok(b.events.some(e=>e.text.includes('补满1')));}
 for(const wood of [.25,.5,1]){const {b}=fixture();b.fires[0].wood=wood;const before=structuredClone(b);assert.throws(()=>battleCommand(b,{type:'addWood',person:'hero',target:'central'}),/余柴充足/);assert.deepEqual(b,before);}
});
test('cancelling, duplicate refills and a stale completed refill cannot double charge or exceed capacity',()=>{
 const {b}=fixture();b.fires[0].wood=.2;const materials=b.resources.materials;battleCommand(b,{type:'addWood',person:'hero',target:'central'});assert.equal(b.resources.materials,materials-1);battleCommand(b,{type:'cancel',person:'hero'});assert.equal(b.resources.materials,materials);assert.equal(b.fires[0].wood,.2);
 b.people.push(makePerson('lin','林禾','园艺师','survival'));b.work.lin=0;battleCommand(b,{type:'addWood',person:'hero',target:'central'});const pending=structuredClone(b);assert.throws(()=>battleCommand(b,{type:'addWood',person:'lin',target:'central'}),/正在添柴/);assert.deepEqual(b,pending);
 b.fires[0].wood=1;b.people[0].task.stage='work';while(b.people[0].task)stepBattle(b);assert.equal(b.resources.materials,materials);assert.ok(b.fires[0].wood<=1);assert.equal(b.supportUsed.firewood,0);
});
test('support stokes with zero budget, refills only low wood within its paid budget, and respects an intentionally extinguished hearth',()=>{
 for(const [wood,materials,budget,type]of [[1,0,0,'stoke'],[.2,0,0,'stoke'],[.2,3,0,'stoke'],[.2,3,1,'addWood'],[.8,3,1,'stoke']]){const {b}=fixture();b.people[0].nightRole='support';b.resources.materials=materials;b.supportBudget.firewood=budget;Object.assign(b.fires[0],{wood,heat:20,enabled:true});stepBattle(b);assert.equal(b.people[0].task.type,type);assert.equal(b.resources.materials,materials-(type==='addWood'?1:0));b.people[0].task.stage='work';while(b.people[0].task)stepBattle(b);assert.equal(b.supportUsed.firewood,type==='addWood'?1:0);assert.ok(b.fires[0].wood<=1);}
 const {b}=fixture();b.people[0].nightRole='support';Object.assign(b.fires[0],{heat:0,wood:.8,enabled:false});stepBattle(b);assert.notEqual(b.people[0].task?.target,'central');assert.equal(b.fires[0].heat,0);
});
test('extinguishing cancels a pending stoke and preserves remaining wood through rain and pauses',()=>{
 const {b}=fixture();b.people.push(makePerson('lin','林禾','园艺师','survival'));b.work.lin=0;b.weather='rain';battleCommand(b,{type:'stoke',person:'hero',target:'central'});battleCommand(b,{type:'extinguish',person:'lin',target:'central'});b.people[1].task.stage='work';b.people[0].task.stage='travel';Object.assign(b.people[0],{x:90,y:210});while(b.people[1].task)stepBattle(b);assert.equal(b.fires[0].heat,0);assert.equal(b.people[0].task,null);const wood=b.fires[0].wood;for(let i=0;i<20;i++)stepBattle(b);assert.equal(b.fires[0].wood,wood);battleCommand(b,{type:'pause'});const paused=structuredClone(b);stepBattle(b);assert.deepEqual(b,paused);
});
test('settlement and old-browser results cap carried wood, preserve free tending, and still reject impossible stock',()=>{
 const {base,b}=fixture();b.fires[0].heat=20;const materials=b.resources.materials;order(b,'stoke');const saved=settleNight(base,b);assert.equal(saved.resources.materials,materials);assert.ok(saved.flags.campfireWood<=1);validateClientResult(base,saved);const morning=act(saved,{type:'nextDay'});assert.equal(morning.flags.campfireWood,saved.flags.campfireWood);
 const legacy=structuredClone(saved);legacy.resources.materials--;legacy.flags.campfireWood=1.5;assert.equal(validateClientResult(base,legacy).flags.campfireWood,1);const bad=structuredClone(saved);bad.flags.campfireWood=100;assert.throws(()=>validateClientResult(base,bad),/柴料/);
});
