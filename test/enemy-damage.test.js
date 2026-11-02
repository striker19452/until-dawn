import test from 'node:test';import assert from 'node:assert/strict';
import {initialCampaign,applyCampaignAction as act,makePerson} from '../src/campaign.js';
import {createBattle,stepBattle} from '../src/battle.js';import {enterHouse} from '../src/shelter.js';
import {bestiaryEntries} from '../src/bestiary.js';import {enemyImpactFrame,latestStructureImpact} from '../client/enemy-impact.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function fixture(type='walker',extra={}){let s=act(initialCampaign(53),{type:'chooseRole',role:'watchman'});s.flags.centralFire=false;s.people.push(makePerson('lin','林禾','园艺师','survival'));const b=createBattle(act(s,{type:'prepare'}),'damage',{autoPause:false});b.challenge=null;b.schedule=[{at:9999,type:'walker',zone:'gate'}];b.paused=false;b.fires=[];b.weather='clear';b.zones.forEach(z=>Object.assign(z,{hp:100,traps:0}));b.people.forEach((p,i)=>Object.assign(p,{x:198-i*5,y:410,fear:0,cooldown:100,task:{type:'move',stage:'work',progress:0,target:{x:198-i*5,y:410},reserved:{}}}));const e={id:'attacker',type,zone:'gate',x:240,y:410,hp:1000,max:1000,mode:'inside',stun:0,attack:0,progress:0,targetId:'house',targetName:'小屋',targetPoint:{x:240,y:410},...extra};b.enemies=[e];return {s,b,e,p:b.people[0],q:b.people[1]};}

test('all boss forms have differentiated actual person damage and matching bestiary data',()=>{
 for(const [type,extra,rate] of [['bastion',{boss:true},4.8],['broodmother',{boss:true},2.4],['cinderwhale',{boss:true},3],['twinvein',{boss:true},3.6],['broodmother',{bossBrood:true},1.2],['twinvein',{boss:true,bossForm:1},2.4],['twinvein',{boss:true,bossForm:2,bossRevived:true},2.4]]){
  const {b,p,q}=fixture(type,extra);stepBattle(b,.1);close(p.health,100-rate*.1);assert.equal(q.health,100);assert.equal(b.house,100);const hit=b.events.find(v=>v.type==='enemy-hit');assert.equal(hit.targetId,'hero');assert.equal(hit.targetKind,'person');assert.equal(hit.damageRate,rate);close(hit.damage,rate*.1);assert.match(hit.text,/健康\/秒/);
 }
 const {s}=fixture();s.flags.seenTypes=['bastion','broodmother','twinvein'];const entries=bestiaryEntries(s);assert.equal(entries.find(e=>e.id==='bastion').personDamage,4.8);assert.equal(entries.find(e=>e.id==='bastion').firePersonDamage,3.36);assert.match(entries.find(e=>e.id==='broodmother').formDamage,/1.2/);assert.match(entries.find(e=>e.id==='twinvein').formDamage,/2.4/);assert.deepEqual(entries.find(e=>e.id==='rammer'),{id:'rammer',known:false});
});

test('contact effects follow real damage, throttle to readable beats and change victim immediately',()=>{
 const {b,e,p,q}=fixture();stepBattle(b,.05);for(let i=0;i<9;i++)stepBattle(b,.05);assert.equal(b.events.filter(e=>e.type==='enemy-hit').length,1);close(p.health,99.4);assert.equal(q.health,100);
 p.x=100;stepBattle(b,.05);const hits=b.events.filter(e=>e.type==='enemy-hit');assert.equal(hits.length,2);assert.equal(hits[1].targetId,'lin');assert.equal(hits[1].source.x,240);close(hits[1].damage,.06);
 e.stun=3;const count=b.events.length,hp=q.health;for(let i=0;i<10;i++)stepBattle(b,.05);assert.equal(b.events.length,count);assert.equal(q.health,hp);
});

test('no misleading hits on range misses, indoor people, intact boundaries or travel',()=>{
 for(const mode of ['outside','indoors','far','travel']){const {b,e,p,q}=fixture();enterHouse(b,q);if(mode==='outside'){e.mode='attack';e.attack=0;}if(mode==='indoors'){enterHouse(b,p);e.targetPoint={x:400,y:400};}if(mode==='far'){p.x=180;e.targetPoint={x:400,y:400};}if(mode==='travel'){enterHouse(b,p);e.targetPoint={x:400,y:400};}stepBattle(b,.05);assert.equal(b.events.some(v=>v.type==='enemy-hit'),false,mode);}
});

test('fence and house impacts carry the actual single structure and clipped damage, not a nearby member',()=>{
 const f=fixture('rammer');f.e.mode='attack';f.e.y=475;f.e.attack=3.99;f.b.zones[0].hp=.5;f.p.y=f.q.y=440;stepBattle(f.b,.05);let hit=f.b.events.find(e=>e.type==='enemy-hit');assert.equal(hit.targetKind,'fence');assert.equal(hit.targetId,'gate');assert.equal(hit.damage,.5);assert.equal(hit.style,'slam');assert.equal(f.p.health,100);assert.equal(f.b.house,100);
 const {b,e,p,q}=fixture();enterHouse(b,p);enterHouse(b,q);b.house=.01;stepBattle(b,.05);hit=b.events.find(e=>e.type==='enemy-hit');assert.equal(hit.targetKind,'structure');assert.equal(hit.targetId,'house');close(hit.damage,.01);assert.equal(b.house,0);
});

test('impact frame expires, freezes with game time and removes motion for reduced preferences',()=>{
 const event={type:'enemy-hit',time:3,targetKind:'structure',targetId:'house',heavy:true};assert.equal(enemyImpactFrame(event,2),null);assert.equal(enemyImpactFrame(event,4),null);const frame=enemyImpactFrame(event,3.15);assert.ok(frame.lunge>6);assert.ok(Math.abs(frame.shake)>0);assert.equal(frame.flash,true);assert.deepEqual(enemyImpactFrame(event,3.15),frame);const reduced=enemyImpactFrame(event,3.15,true);assert.equal(reduced.shake,0);assert.equal(reduced.lunge,0);assert.equal(reduced.recoil,0);assert.equal(reduced.flash,true);assert.equal(latestStructureImpact({events:[event]},'house',3.15).event,event);assert.equal(latestStructureImpact({events:[event]},'gate',3.15),null);
});
