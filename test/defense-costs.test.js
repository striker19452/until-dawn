import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,applyCampaignAction,settleNight} from '../src/campaign.js';
import {createBattle} from '../src/battle.js';

const act=(s,type,extra={})=>applyCampaignAction(s,{type,...extra});
const day=()=>act(initialCampaign(53),'chooseRole',{role:'repairman'});
const prices={spikes:10,mesh:10,bell:8};

test('permanent defenses cost one action and 10/10/8 materials separately in every zone',()=>{
 for(const zone of day().zones)for(const [feature,materials]of Object.entries(prices)){
  const s=day();s.resources.materials=materials;const before=structuredClone(s);
  const installed=act(s,'defense',{zone:zone.id,feature});
  assert.equal(installed.ap,before.ap-1);assert.equal(installed.resources.materials,0);
  assert.equal(installed.zones.find(z=>z.id===zone.id)[feature],true);
  assert.equal(installed.zones.filter(z=>z[feature]).length,1);
  for(const other of Object.keys(prices).filter(k=>k!==feature))assert.ok(installed.zones.every(z=>!z[other]));
  assert.deepEqual(s,before);
  assert.throws(()=>act(installed,'defense',{zone:zone.id,feature}));
  assert.equal(installed.ap,before.ap-1);assert.equal(installed.resources.materials,0);
 }
});

test('insufficient materials or actions cannot partly install or charge a permanent defense',()=>{
 for(const [feature,materials]of Object.entries(prices))for(const shortage of ['materials','ap']){
  const s=day();s.resources.materials=materials;if(shortage==='materials')s.resources.materials--;else s.ap=0;
  const before=structuredClone(s);assert.throws(()=>act(s,'defense',{zone:'gate',feature}),shortage==='ap'?/行动力不足/:/物资不足/);assert.deepEqual(s,before);
 }
});

test('installed defenses survive preparation, its reversal and dawn without another installation charge',()=>{
 let s=day();s.resources.materials=40;for(const feature of Object.keys(prices))s=act(s,'defense',{zone:'gate',feature});
 assert.equal(s.resources.materials,12);s=act(s,'toggleFire',{target:'central'});
 const prepared=act(s,'prepare'),back=act(prepared,'backDay');assert.equal(back.resources.materials,12);
 for(const state of [prepared,back])for(const feature of Object.keys(prices))assert.equal(state.zones[0][feature],true);
 const ready=act(back,'prepare'),battle=createBattle(ready,'defense-persist');battle.finished=true;
 const dawn=act(settleNight(ready,battle),'nextDay');
 for(const feature of Object.keys(prices))assert.equal(dawn.zones[0][feature],true);
 assert.equal(dawn.resources.materials,12);
});

test('consumable traps remain one action and two materials with one added trap',()=>{
 const s=day(),built=act(s,'craft',{item:'trap',zone:'gate'});
 assert.equal(built.ap,s.ap-1);assert.equal(built.resources.materials,s.resources.materials-2);assert.equal(built.zones[0].traps,1);
});
