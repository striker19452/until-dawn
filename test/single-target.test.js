import test from 'node:test';import assert from 'node:assert/strict';
import {initialCampaign,applyCampaignAction as act,makePerson,settleNight} from '../src/campaign.js';import {createBattle,stepBattle} from '../src/battle.js';
import {enterHouse} from '../src/shelter.js';import {enemyPersonTarget} from '../src/enemy-target.js';import {fearSituation} from '../src/fear.js';import {enemyFeedback} from '../client/combat-feedback.js';import {BOSSES} from '../src/boss-content.js';import {validateClientResult} from '../src/client-result.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function hold(p,x,y){Object.assign(p,{x,y,cooldown:100,fear:0,task:{type:'move',stage:'work',progress:0,target:{x,y},reserved:{},automatic:false}});}
function fixture(day=1){let s=act(initialCampaign(53),{type:'chooseRole',role:'watchman'});s.day=day;s.flags.centralFire=false;s.people.push(makePerson('lin','林禾','园艺师','survival'));const base=act(s,{type:'prepare'}),b=createBattle(base,'single',{autoPause:false});b.schedule=[{at:9999,type:'walker',zone:'gate'}];b.challenge=null;b.paused=false;b.fires=[];b.weather='clear';b.zones.forEach(z=>z.hp=100);hold(b.people[0],340,410);hold(b.people[1],334,410);const e={id:'one',type:'walker',zone:'right',x:380,y:410,hp:1000,max:1000,mode:'inside',stun:0,attack:0,progress:0,targetId:'house',targetName:'小屋',targetPoint:{x:380,y:410}};b.enemies=[e];return {base,b,e,p:b.people[0],q:b.people[1]};}
const run=(b,n)=>{for(let i=0;i<n;i++)stepBattle(b,.05);};

test('one creature attacks one member and leaves the other member and its cached structure untouched',()=>{
 const {b,e,p,q}=fixture();run(b,20);close(p.health,98.8);assert.equal(q.health,100);assert.equal(b.house,100);assert.equal(e.personTargetId,'hero');assert.deepEqual(e.attackTarget,{kind:'person',id:'hero',name:'你'});assert.equal(e.targetId,'house');assert.equal(fearSituation(b,p).underAttack,true);assert.equal(fearSituation(b,q).underAttack,false);assert.equal(enemyFeedback(b,e).label,'攻击你');
});

test('a live target stays locked even if another member becomes closer; out-of-range and indoor targets are replaced',()=>{
 const {b,e,p,q}=fixture();stepBattle(b);q.x=379;stepBattle(b);assert.equal(e.personTargetId,'hero');assert.equal(q.health,100);p.x=300;stepBattle(b);assert.equal(e.personTargetId,'lin');assert.ok(q.health<100);const hp=q.health;enterHouse(b,q);stepBattle(b);assert.equal(q.health,hp);assert.equal(e.personTargetId,undefined);assert.equal(e.attackTarget.kind,'structure');assert.ok(b.house<100);
});

test('a fatal strike does not spill damage into a second member or structure until the next attack',()=>{
 const {base,b,e,p,q}=fixture();p.health=.01;stepBattle(b);assert.equal(p.dead,true);assert.equal(q.health,100);assert.equal(b.house,100);const result=settleNight(base,b);validateClientResult(base,result);assert.equal(result.phase,'failed');
 const other=fixture();other.q.health=.01;other.e.personTargetId='lin';stepBattle(other.b);assert.equal(other.q.dead,true);assert.equal(other.p.health,100);assert.equal(other.b.house,100);stepBattle(other.b);assert.equal(other.e.personTargetId,'hero');assert.ok(other.p.health<100);assert.equal(other.b.house,100);
});

test('two creatures may focus one victim while each still deals damage to only that target',()=>{
 const {b,e,p,q}=fixture();b.enemies.push({...e,id:'two'});stepBattle(b,.1);close(p.health,99.76);assert.equal(q.health,100);assert.equal(b.house,100);assert.ok(b.enemies.every(e=>e.attackTarget.id==='hero'));
});

test('breaking a fence consumes that attack instead of also hitting an inside target in the same step',()=>{
 const {b,e,p,q}=fixture();q.dead=true;hold(p,240,440);Object.assign(e,{zone:'gate',mode:'attack',x:240,y:475,attack:1.54});b.zones[0].hp=.01;stepBattle(b,.05);assert.equal(b.zones[0].hp,0);assert.equal(p.health,100);assert.equal(b.house,100);assert.equal(e.attackTarget.kind,'fence');stepBattle(b,.05);assert.ok(p.health<100);assert.equal(e.attackTarget.kind,'person');assert.equal(b.house,100);
});

test('every boss body uses the single-target rule inside, without also charging a fence or draining the fire',()=>{
 for(const day of [7,14,21,28]){const {b,p,q}=fixture(day),def=BOSSES[day];q.dead=true;b.enemies=[];b.schedule=[{at:.05,type:def.id,zone:def.zone}];stepBattle(b);const e=b.enemies[0];b.schedule=[{at:9999,type:'walker',zone:'gate'}];Object.assign(e,{mode:'inside',x:380,y:410,stun:0,targetId:'house',targetPoint:{x:380,y:410}});b.boss.phase=day===7?'charge':day===21?'siphon':'nesting';b.boss.clock=7.99;const hp=p.health,zones=b.zones.map(z=>z.hp);stepBattle(b,.1);close(hp-p.health,({7:4.8,14:2.4,21:3,28:3.6})[day]*.1);assert.deepEqual(b.zones.map(z=>z.hp),zones);assert.equal(b.house,100);assert.equal(e.attackTarget.kind,'person');assert.equal(e.attackTarget.id,'hero');}
});

test('spraying the central fire occupies the quencher attack and resets its fence attack timer',()=>{
 const {b,e,p,q}=fixture();p.nightRole=q.nightRole='sleep';enterHouse(b,p);enterHouse(b,q);Object.assign(e,{type:'quencher',mode:'attack',zone:'gate',x:240,y:475,progress:3.99,attack:2.49});b.fires=[{id:'central',x:240,y:390,heat:60,wood:1,wet:0,enabled:true,shade:true}];stepBattle(b,.05);assert.equal(b.zones[0].hp,100);assert.ok(b.fires[0].wet>0);assert.equal(e.attack,0);assert.equal(e.attackTarget.kind,'fire');stepBattle(b,.05);assert.equal(b.zones[0].hp,100);
});

test('a cinder burst targets the fence alone after siphoning, preserving the fire apart from natural decay',()=>{
 const {b,p,q}=fixture(21);enterHouse(b,p);enterHouse(b,q);b.enemies=[];b.schedule=[{at:.05,type:'cinderwhale',zone:'left'}];stepBattle(b);const e=b.enemies[0];b.schedule=[{at:9999,type:'walker',zone:'gate'}];Object.assign(e,{mode:'attack',x:70,y:310});b.boss.phase='siphon';b.boss.clock=7.99;b.fires=[{id:'central',x:240,y:390,heat:60,wood:1,wet:0,enabled:true}];stepBattle(b,.05);assert.ok(b.zones[1].hp<100);close(b.fires[0].heat,60-.05*.36);assert.equal(b.fires[0].wet,0);assert.equal(e.attackTarget.kind,'fence');assert.equal(b.events.find(e=>e.type==='boss-burst').targetId,'left');
});
