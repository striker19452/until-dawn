import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialCampaign,applyCampaignAction as act,settleNight} from '../src/campaign.js';
import {createBattle,stepBattle,inner} from '../src/battle.js';
import {ENEMIES,ZONES,enemyTypes,dailyIntel} from '../src/content.js';
import {artPoint,COURTYARD} from '../src/yard-geometry.js';
import {pointInPolygon} from '../client/scene-layout.js';
import {weakestZone,defenseStrength,skitterDetour} from '../src/skitter.js';
import {bestiaryEntries} from '../src/bestiary.js';
import {validateClientResult} from '../src/client-result.js';
import {leaveHouse} from '../src/shelter.js';
import {enemyFeedback} from '../client/combat-feedback.js';

function fixture(){let s=act(initialCampaign(53),{type:'chooseRole',role:'repairman'});s.day=5;s.flags.centralFire=false;s.people[0].nightRole='sleep';s.zones.forEach(z=>z.hp=100);const base=act(s,{type:'prepare'}),b=createBattle(base,'skitter',{autoPause:false});b.schedule=[];b.challenge=null;b.paused=false;return {base,b};}
const advance=(b,seconds)=>{for(let i=0;i<Math.round(seconds*20)&&!b.finished;i++)stepBattle(b);};
function spawn(b,zone='gate'){b.schedule=[{at:b.elapsed+.05,type:'skitter',zone}];stepBattle(b);return b.enemies.find(e=>e.type==='skitter');}

test('a genuinely small, fragile and faster species joins the pool on day five without adding wave slots',()=>{
 assert.equal(ENEMIES.skitter.hp,12);assert.equal(ENEMIES.skitter.speed,66);assert.ok(ENEMIES.skitter.speed>Math.max(...Object.entries(ENEMIES).filter(([id])=>id!=='skitter').map(([,d])=>d.speed)));
 assert.ok(ENEMIES.skitter.hp<Math.min(...Object.entries(ENEMIES).filter(([id])=>id!=='skitter').map(([,d])=>d.hp)));
 assert.equal(ENEMIES.skitter.agile,true);assert.ok(!enemyTypes(4).includes('skitter'));assert.ok(enemyTypes(5).includes('skitter'));
 const {base}=fixture(),planned=createBattle(base,'natural');assert.equal(planned.schedule[0].type,'skitter');assert.equal(planned.schedule.length,4);
 const art=JSON.parse(readFileSync(new URL('../client/assets/skitter-walk-v1.json',import.meta.url)));assert.equal(art.frames.length,4);assert.equal(art.displaySize,56);assert.ok(art.frames.every(f=>f.species==='skitter'));assert.equal(new Set(art.frames.map(f=>f.rect.join(','))).size,4);
});

test('wall damage, missing attachments and actual nearby defenders change which zone is weakest',()=>{
 const {b}=fixture();b.zones.find(z=>z.id==='right').hp=25;assert.equal(weakestZone(b,ZONES),'right');
 b.zones.forEach(z=>z.hp=100);b.zones.forEach(z=>Object.assign(z,{spikes:true,mesh:true,bell:true,traps:1}));Object.assign(b.zones[3],{spikes:false,mesh:false,bell:false,traps:0});assert.equal(weakestZone(b,ZONES),'backLeft');
 b.zones.forEach(z=>Object.assign(z,{spikes:false,mesh:false,bell:false,traps:0}));const p=b.people[0];leaveHouse(b,p);Object.assign(p,inner(ZONES[0]),{nightRole:'guard'});assert.ok(defenseStrength(b,b.zones[0],ZONES)>defenseStrength(b,b.zones[1],ZONES));assert.notEqual(weakestZone(b,ZONES),'gate');
 b.zones[0].hp=0;assert.equal(weakestZone(b,ZONES),'gate','an actual breach is preferred even with a nearby guard');
});

test('the real spawn observes current repairs, announces the actual weak zone and remains deterministic',()=>{
 const a=fixture(),c=fixture();for(const {b}of [a,c]){b.zones[2].hp=22;b.zones[0].hp=90;spawn(b,'gate');}
 assert.equal(a.b.enemies[0].zone,'right');assert.equal(a.b.enemies[0].hp,12);assert.ok(a.b.events.some(e=>e.type==='warning'&&e.zone==='right'&&e.text.includes('薄弱')));assert.deepEqual(a.b,c.b);
 const {base}=fixture();base.zones[4].hp=15;assert.equal(dailyIntel(base).direction,'backRight');base.zones[4].hp=100;base.zones[1].hp=20;assert.equal(dailyIntel(base).direction,'left');
});

test('an approaching skitter reevaluates repairs and circles outside every intact boundary',()=>{
 const {b}=fixture();b.zones[0].hp=20;const e=spawn(b);Object.assign(e,{x:240,y:530,huntRecheck:0});b.zones[0].hp=100;b.zones[4].hp=18;
 stepBattle(b);assert.equal(e.zone,'backRight');assert.ok(e.huntPath.length);assert.ok(b.events.some(e=>e.type==='weakpoint'&&e.from==='gate'&&e.zone==='backRight'));assert.match(enemyFeedback(b,e).label,/绕行/);
 let steps=0;while(e.mode==='approach'&&steps++<1000){stepBattle(b);assert.ok(!pointInPolygon(artPoint(e),COURTYARD),'never cross a fence while circling');}
 assert.equal(e.mode,'attack');assert.ok(Math.hypot(e.x-ZONES[4].x,e.y-ZONES[4].y)<8);assert.equal(b.zones[4].hp,18);
 // Every possible change of approach follows the same safe perimeter.
 for(const from of ZONES)for(const target of ZONES){let p=artPoint(from);for(const next of skitterDetour(p,target.id)){for(let i=0;i<=20;i++)assert.ok(!pointInPolygon({x:p.x+(next.x-p.x)*i/20,y:p.y+(next.y-p.y)*i/20},COURTYARD));p=next;}}
});

test('movement is actually fast, while pause and stun freeze the hunter and its recheck clock',()=>{
 const {b}=fixture();b.zones[0].hp=10;const e=spawn(b);Object.assign(e,{x:240,y:550,huntRecheck:1});const y=e.y;stepBattle(b,.1);assert.ok(Math.abs(y-e.y-6.6)<1e-8);
 e.stun=1;const stopped={x:e.x,y:e.y,clock:e.huntRecheck};stepBattle(b,.1);assert.deepEqual({x:e.x,y:e.y,clock:e.huntRecheck},stopped);
 b.paused=true;const frozen=structuredClone(b);advance(b,2);assert.deepEqual(b,frozen);
});

test('low health remains meaningful: ordinary traps kill it and two unskilled guard hits drive it off',()=>{
 const trap=fixture();trap.b.zones[0].hp=10;trap.b.zones[0].traps=1;const e=spawn(trap.b);Object.assign(e,{x:240,y:475,huntRecheck:1});stepBattle(trap.b);assert.ok(trap.b.events.some(e=>e.type==='trap'&&e.defeated));assert.equal(trap.b.enemies.length,0);
 const guard=fixture();guard.b.zones[0].hp=10;const q=spawn(guard.b);Object.assign(q,{x:240,y:475,mode:'attack'});const p=guard.b.people[0];leaveHouse(guard.b,p);Object.assign(p,inner(ZONES[0]),{nightRole:'guard',cooldown:0});advance(guard.b,5);assert.equal(guard.b.enemies.length,0);assert.equal(guard.b.events.filter(e=>e.type==='attack').length,2);
});

test('the hunter bites intact walls, uses a real breach to enter, and does not retarget from inside',()=>{
 const {b}=fixture();b.zones[0].hp=20;const e=spawn(b);Object.assign(e,{x:240,y:475,mode:'attack'});advance(b,.95);assert.equal(b.zones[0].hp,20);stepBattle(b);assert.equal(b.zones[0].hp,18.5);assert.equal(e.mode,'attack');
 b.zones[0].hp=1;e.attack=.99;stepBattle(b);assert.equal(b.zones[0].hp,0);assert.equal(e.mode,'inside');const zone=e.zone;b.zones[4].hp=0;advance(b,2);assert.equal(e.zone,zone);assert.ok(e.targetId);
});

test('bait controls the fast hunter for its full lifetime, with an exterior route rather than an interior shortcut',()=>{
 const {b}=fixture();b.zones[1].hp=20;const e=spawn(b,'left');Object.assign(e,{x:100,y:360});b.lures=[{zone:'gate',x:240,y:475,until:b.elapsed+12,affected:[]}];stepBattle(b);
 assert.equal(e.zone,'gate');assert.equal(e.huntLuredUntil,b.lures[0].until);assert.ok(e.huntPath.length);advance(b,3);assert.equal(e.zone,'gate');
});

test('encounter discovery uses the new portrait entry and is accepted in a real night result',()=>{
 const {base,b}=fixture();assert.equal(bestiaryEntries(base).find(e=>e.id==='skitter').known,false);spawn(b);const entry=bestiaryEntries(base,b).find(e=>e.id==='skitter');assert.equal(entry.known,true);assert.equal(entry.name,'裂隙鼠');assert.match(entry.behavior,/院外绕行/);assert.match(entry.counter,/陷阱/);
 b.enemies[0].hp=0;stepBattle(b);assert.equal(b.finished,true);const result=settleNight(base,b);assert.equal(validateClientResult(base,result),result);assert.ok(result.flags.seenTypes.includes('skitter'));
});
