import test from 'node:test';
import assert from 'node:assert/strict';
import { run } from './support/campaign-route.js';
import {createTestSession} from '../src/test-mode.js';
import {createBattle,stepBattle} from '../src/battle.js';
import {settleNight} from '../src/campaign.js';
import {validateClientResult} from '../src/client-result.js';

// These are the old fixed-input policies, deliberately retained as a pressure
// audit. Activity meals deliberately raise food demand; these unchanged
// food-buying policies are not assumed to win. Every night validates its save.
const cache=new Map();
function route(role,size,seed,options={}){const key=JSON.stringify([role,size,seed,options]);if(!cache.has(key))cache.set(key,run(role,size,seed,options));return cache.get(key);}
test('45 historical campaign policies converge and save cleanly under the increased combat pressure',t=>{
 const outcomes=[];
 for(const role of ['repairman','medic','watchman'])for(const size of [1,2,3,4,5])for(const seed of [11,53,97]){
  const r=route(role,size,seed);assert.ok(['rescued','failed'].includes(r.s.phase));assert.ok(r.nights.length>=1&&r.nights.length<=28);
  assert.ok(Object.values(r.s.resources).every(n=>Number.isFinite(n)&&n>=0));
  for(const night of r.nights){assert.ok(Number.isFinite(night.elapsed)&&night.elapsed>0);if(night.house>0&&!night.heroDead){assert.equal(night.remaining,0,'a standing house finishes only after clearing all threats');assert.equal(night.pending,0,'future arrivals cannot be skipped');}}
  if(r.s.phase==='rescued'){assert.equal(r.s.day,28);assert.ok(r.s.house>0);assert.ok(r.s.people.filter(p=>!p.dead).length>=1&&r.s.people.filter(p=>!p.dead).length<=size);}
  else assert.ok(r.s.house===0||r.s.people[0].dead,'failure must have a real loss condition');
  outcomes.push({role,size,seed,day:r.s.day,phase:r.s.phase});
 }
 assert.ok(outcomes.some(r=>r.phase==='failed'),'the old policies must reveal the stronger pressure');
 t.diagnostic(JSON.stringify({rescued:outcomes.filter(r=>r.phase==='rescued').length,failed:outcomes.filter(r=>r.phase==='failed').length}));
});
test('an old solo policy without fire resolves an actual loss and remains deterministic at the stronger difficulty',()=>{
 const r=route('repairman',1,53,{fire:false}),again=run('repairman',1,53,{fire:false});
 // Denser early waves can break this old policy before the first boss. Check
 // the actual loss and contiguous, reproducible nights rather than a fixed day.
 assert.equal(r.s.phase,'failed');assert.ok(r.s.house===0||r.s.people[0].dead);assert.equal(r.nights.length,r.s.day);assert.deepEqual(r.nights.map(n=>n.day),Array.from({length:r.s.day},(_,i)=>i+1));assert.deepEqual(r.nights,again.nights);assert.deepEqual(r.failures,again.failures);
});
test('manual orders improve aggregate historical challenge clears under the new food pressure',()=>{
 let activeClears=0,idleClears=0;
 for(const size of [1,3,5]){
  const active=route('repairman',size,53),idle=route('repairman',size,53,{policy:'idle'});
  const a=active.nights.filter(n=>n.cleared).length,i=idle.nights.filter(n=>n.cleared).length;
  assert.ok(['rescued','failed'].includes(active.s.phase));assert.ok(['rescued','failed'].includes(idle.s.phase));
  if(size===1)assert.ok(a>i,'a solo yard needs active direction');
  activeClears+=a;idleClears+=i;
 }
 // Clearing all enemies is now required; a timed retreat can no longer turn a live boss into a missed challenge.
 assert.ok(activeClears>idleClears,'manual direction must still improve real challenge outcomes');
});


test('a supplied five-person final-night preparation still clears all threats and pays the new duty meals',()=>{
 const base=createTestSession({day:28,preset:'crew',role:'watchman',seed:53}).snapshot.state,b=createBattle(base,'supplied-final',{autoPause:false});b.paused=false;for(let i=0;i<9000&&!b.finished;i++)stepBattle(b);assert.equal(b.finished,true);const result=settleNight(base,b);validateClientResult(base,result);assert.equal(result.phase,'rescued');assert.equal(result.report.foodUsed,9);assert.equal(result.report.hungry,false);assert.equal(result.report.thirsty,false);assert.ok(result.people.every(p=>!p.dead));
});
