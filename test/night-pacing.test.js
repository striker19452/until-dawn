import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestSession} from '../src/test-mode.js';
import {createBattle,stepBattle,battleCommand} from '../src/battle.js';
import {dailyChallenge} from '../src/challenges.js';
import {ENEMIES} from '../src/content.js';

test('all nights retain their invasion budgets and announced waves with bounded gaps and compact arrivals',()=>{
 for(let day=1;day<=28;day++)for(const seed of [11,53,97])for(const exposure of [0,3]){
  const base=createTestSession({day,seed}).snapshot.state;base.exposure=exposure;
  const b=createBattle(base,'pacing'),c=dailyChallenge(base),total=3+Math.floor((day-1)/3)+(day%7===0?3:0)+exposure;
  assert.equal(b.schedule.length,total-(c.replacementSlots||c.count)+c.count);
  assert.ok(b.schedule[0].at<=3);assert.ok(b.schedule.at(-1).at<=(day%7===0?52:42));
  let previous=0;for(const wave of b.schedule){assert.ok(wave.at>=previous&&wave.at-previous<=10+1e-8);previous=wave.at;assert.ok(ENEMIES[wave.type].day<=day);}
  assert.deepEqual(b.schedule.filter(w=>w.challenge).map(({challenge,...wave})=>wave),c.waves,'broadcast times must match actual challenge arrivals');
  assert.deepEqual(b.schedule,createBattle(base,'same').schedule,'timing stays deterministic');
 }
});

test('first-night pressure begins at three seconds and pause freezes deployment',()=>{
 const base=createTestSession({day:1}).snapshot.state,b=createBattle(base,'first',{autoPause:false});
 const frozen=structuredClone(b);stepBattle(b);assert.deepEqual(b,frozen);
 battleCommand(b,{type:'resume'});for(let i=0;i<59;i++)stepBattle(b);assert.equal(b.enemies.length,0);stepBattle(b);stepBattle(b);assert.equal(b.enemies.length,1);assert.ok(b.enemies[0].challenge);
 battleCommand(b,{type:'pause'});const paused=structuredClone(b);for(let i=0;i<200;i++)stepBattle(b);assert.deepEqual(b,paused);
});

test('new four-second warning precedes the announced eight-second challenge',()=>{
 const base=createTestSession({day:9}).snapshot.state;base.flags.seenTypes=Object.keys(ENEMIES);const b=createBattle(base,'warning');battleCommand(b,{type:'resume'});
 for(let i=0;i<200&&!b.paused;i++)stepBattle(b);
 assert.match(b.reason,/挑战预警/);assert.ok(b.elapsed>=4&&b.elapsed<4.1);assert.equal(b.challenge.starts,8);assert.equal(b.enemies.some(e=>e.challenge),false);
 battleCommand(b,{type:'resume'});for(let i=0;i<100&&b.elapsed<8.1;i++)stepBattle(b);assert.ok(b.enemies.some(e=>e.challenge));
});
