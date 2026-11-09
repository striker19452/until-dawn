import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,applyCampaignAction as act} from '../src/campaign.js';
import {createBattle,stepBattle,battleCommand,inner} from '../src/battle.js';
import {ENEMY_WINDUP,ZONES} from '../src/content.js';
import {burrowFrame} from '../src/burrow.js';
import {walkablePoint} from '../src/movement.js';
import {leaveHouse} from '../src/shelter.js';

function fixture(zone='backLeft',compacted=false,autoPause=false){
 let s=act(initialCampaign(53),{type:'chooseRole',role:'repairman'});s.day=16;s.people[0].nightRole='sleep';
 const b=createBattle(act(s,{type:'prepare'}),'burrow',{autoPause});
 Object.assign(b,{paused:false,challenge:null,boss:null,fires:[],schedule:[{at:9999,type:'walker',zone:'gate'}]});
 const z=ZONES.find(z=>z.id===zone);b.zones.find(z=>z.id===zone).compacted=compacted;
 const e={id:'digger',type:'burrower',zone,x:z.x,y:z.y,hp:1000,max:1000,mode:'attack',progress:0,attack:0,stun:0};b.enemies=[e];
 return {b,e,z};
}
const advance=(b,seconds)=>{for(let i=0;i<Math.round(seconds*20);i++)stepBattle(b,.05);};

test('digging takes three seconds total; the last second sinks, tunnels and emerges before the entry alarm',()=>{
 for(const zone of ['backLeft','backRight']){
  const {b,e,z}=fixture(zone,false,true);advance(b,2.15);
  assert.equal(ENEMY_WINDUP.dig,3);assert.equal(burrowFrame(e).phase,'sink');assert.ok(burrowFrame(e).visible<1);assert.equal(b.paused,false);
  advance(b,.35);assert.equal(burrowFrame(e).phase,'tunnel');assert.equal(burrowFrame(e).visible,0);assert.notEqual(e.y,z.y);
  const at=structuredClone(e);battleCommand(b,{type:'pause'});advance(b,1);assert.deepEqual(e,at);battleCommand(b,{type:'resume'});
  advance(b,.35);assert.equal(burrowFrame(e).phase,'emerge');assert.ok(burrowFrame(e).visible>0);assert.ok(walkablePoint(e,b.walkMap));
  advance(b,.1);assert.equal(e.mode,'attack');assert.equal(b.events.some(v=>v.type==='dig'),false);
  advance(b,.05);assert.equal(e.mode,'inside');assert.equal(b.paused,true);assert.equal(e.burrow,undefined);
  const dig=b.events.find(v=>v.type==='dig');assert.ok(Math.abs(dig.time-3)<1e-8);assert.ok(dig.y>z.y);assert.equal(dig.text,'破土入院');
 }
});

test('compaction retains its 35 percent rate and a one-second crossing; mesh blocks the whole sequence',()=>{
 const {b,e}=fixture('backRight',true);advance(b,7.55);assert.equal(e.burrow,undefined);
 advance(b,.2);assert.equal(burrowFrame(e).phase,'sink');advance(b,.35);assert.equal(burrowFrame(e).phase,'tunnel');
 advance(b,.4);assert.equal(burrowFrame(e).phase,'emerge');advance(b,.05);assert.equal(e.mode,'attack');advance(b,.05);assert.equal(e.mode,'inside');
 const blocked=fixture();blocked.b.zones.find(z=>z.id==='backLeft').mesh=true;advance(blocked.b,10);
 assert.equal(blocked.e.progress,0);assert.equal(blocked.e.burrow,undefined);assert.equal(blocked.e.mode,'attack');
});

test('throwing or compacting during tunnelling clears the old exit and resets digging at the wall',()=>{
 for(const type of ['throw','compact']){
  const {b,e,z}=fixture();advance(b,2.5);assert.equal(burrowFrame(e).phase,'tunnel');
  const p=b.people[0];leaveHouse(b,p);Object.assign(p,{...inner(z),cooldown:100});
  p.task={type,target:z.id,progress:100,stage:'work',reserved:{}};
  stepBattle(b);assert.equal(e.progress,0);assert.equal(e.burrow,undefined);assert.equal(e.mode,'attack');assert.equal(e.x,z.x);assert.equal(e.y,z.y);assert.ok(e.stun>0);
  assert.equal(b.events.some(v=>v.type==='dig'),false);
 }
});

test('ordinary strikes pause tunnelling without resetting its progress or exit',()=>{
 const {b,e}=fixture();advance(b,2.4);const p=b.people[0];leaveHouse(b,p);Object.assign(p,{x:e.x,y:e.y,zone:e.zone,nightRole:'guard',cooldown:0});
 const burrow=e.burrow;stepBattle(b);assert.equal(e.stun,.5);assert.equal(e.burrow,burrow);assert.ok(Math.abs(e.progress-2.45)<1e-8);assert.equal(burrowFrame(e).phase,'tunnel');
 const progress=e.progress;advance(b,.45);assert.equal(e.progress,progress);advance(b,.6);assert.equal(e.mode,'inside');assert.equal(e.burrow,undefined);assert.ok(b.events.some(v=>v.type==='dig'));
});

test('submerged creatures cannot hurt nearby people before emerging and restored battles retain the same crossing',()=>{
 const {b,e,z}=fixture();advance(b,2.5);
 const p=b.people[0];leaveHouse(b,p);Object.assign(p,{...inner(z),cooldown:100,nightRole:'guard'});
 const health=p.health,copy=structuredClone(b);advance(b,.45);advance(copy,.45);
 assert.equal(p.health,health);assert.deepEqual(copy.enemies,b.enemies);stepBattle(b);assert.equal(e.mode,'inside');assert.ok(p.health<health);
});
