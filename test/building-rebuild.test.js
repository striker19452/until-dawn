import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,applyCampaignAction,normalizeCampaign,settleNight} from '../src/campaign.js';
import {createBattle,stepBattle} from '../src/battle.js';
import {BUILDINGS} from '../src/content.js';
import {buildingPlot,freeBuildingPlot} from '../src/building-health.js';
import {createWalkMap,PLOTS,artPoint} from '../src/yard-geometry.js';
import {validateClientResult} from '../src/client-result.js';
function yard(){const s=applyCampaignAction(initialCampaign(53),{type:'chooseRole',role:'repairman'});s.resources.materials=50;s.resources.food=s.resources.water=20;s.buildings=['garden','water','workshop','generator','infirmary','watchtower'].map((type,i)=>({id:'old'+i,type,plot:i,hp:i===0?0:10,level:2,branch:'steady',age:1,enabled:false}));return normalizeCampaign(s);}

test('a full courtyard can replace a ruin in place with any available type, paying new-build costs and resetting upgrades',()=>{
 const s=yard(),before=structuredClone(s),next=applyCampaignAction(s,{type:'rebuildBuilding',id:'old0',building:'stove'});
 assert.equal(next.buildings.length,6);assert.notEqual(next.buildings[0].id,'old0');assert.deepEqual(next.buildings[0],{id:next.buildings[0].id,type:'stove',plot:0,hp:10,level:1,branch:'normal',age:0,enabled:true});assert.deepEqual(next.buildings.slice(1),s.buildings.slice(1));assert.equal(next.ap,s.ap-2);assert.equal(next.resources.materials,s.resources.materials-BUILDINGS.stove.cost);assert.deepEqual(s,before);
 const same=applyCampaignAction(s,{type:'rebuildBuilding',id:'old0',building:'garden'});assert.equal(same.buildings[0].age,0);assert.equal(same.buildings[0].type,'garden');assert.equal(same.resources.materials,s.resources.materials-BUILDINGS.garden.cost);
});

test('rebuilding respects limits, ruin state, identity, AP and materials atomically',()=>{
 const s=yard(),before=structuredClone(s);
 for(const action of [{type:'rebuildBuilding',id:'old0',building:'generator'},{type:'rebuildBuilding',id:'old1',building:'stove'},{type:'rebuildBuilding',id:'missing',building:'stove'},{type:'rebuildBuilding',id:'old0',building:'unknown'},{type:'repairBuilding',id:'old0'}])assert.throws(()=>applyCampaignAction(s,action));
 assert.deepEqual(s,before);for(const change of [v=>v.ap=1,v=>v.resources.materials=0]){const poor=structuredClone(s);change(poor);const copy=structuredClone(poor);assert.throws(()=>applyCampaignAction(poor,{type:'rebuildBuilding',id:'old0',building:'garden'}));assert.deepEqual(poor,copy);}
});

test('clearing a ruin leaves all other plots fixed; new construction fills the vacant plot and keeps navigation consistent',()=>{
 const s=yard(),cleared=applyCampaignAction(s,{type:'demolish',id:'old0'});assert.deepEqual(cleared.buildings.map(b=>b.plot),[1,2,3,4,5]);assert.equal(freeBuildingPlot(cleared),0);assert.equal(cleared.resources.materials,s.resources.materials);
 const rebuilt=applyCampaignAction(cleared,{type:'build',building:'exchange'});assert.deepEqual(rebuilt.buildings.map(b=>b.plot),[1,2,3,4,5,0]);assert.equal(rebuilt.buildings.at(-1).type,'exchange');
 const map=createWalkMap(rebuilt);for(let i=0;i<rebuilt.buildings.length;i++){const center=artPoint(PLOTS[buildingPlot(rebuilt.buildings[i],i)]),footprint=map.obstacles[i+1];assert.ok(footprint.some(p=>Math.hypot(p.x-center.x,p.y-center.y)<40));}
 const ready=applyCampaignAction(cleared,{type:'prepare'}),back=applyCampaignAction(ready,{type:'backDay'});assert.deepEqual(back.buildings,cleared.buildings);
});

test('stable plots migrate through prepare and old-browser settlement but supplied night-time placement edits are rejected',()=>{
 const legacy=yard();legacy.buildings.forEach(b=>delete b.plot);const base=applyCampaignAction(legacy,{type:'prepare'});assert.deepEqual(base.buildings.map(b=>b.plot),[0,1,2,3,4,5]);assert.deepEqual(base.preparationBase.buildings.map(b=>b.plot),[0,1,2,3,4,5]);const battle=createBattle(base,'old-compatible');const result=settleNight(base,battle);result.buildings.forEach(b=>delete b.plot);validateClientResult(base,result);assert.deepEqual(result.buildings.map(b=>b.plot),[0,1,2,3,4,5]);const corrupt=structuredClone(result);corrupt.buildings[0].plot=5;assert.throws(()=>validateClientResult(base,corrupt),/只能改变设施耐久/);
});

test('intruders target an operational rebuilt facility at its stable plot after an earlier slot was removed',()=>{
 let s=yard();s=applyCampaignAction(s,{type:'demolish',id:'old0'});s.flags.centralFire=false;s.people[0].nightRole='sleep';const base=applyCampaignAction(s,{type:'prepare'}),b=createBattle(base,'stable-target',{autoPause:false});b.challenge=null;b.schedule=[{at:9999,type:'walker',zone:'gate'}];b.paused=false;b.rng=500;
 b.enemies=[{id:'e',type:'walker',zone:'gate',x:240,y:475,hp:100,max:100,mode:'inside',attack:0,progress:0,stun:0}];stepBattle(b);const e=b.enemies[0];assert.notEqual(e.targetId,'old0');const target=b.buildings.find(q=>q.id===e.targetId);assert.ok(target);const wrong=PLOTS[b.buildings.indexOf(target)],right=PLOTS[target.plot];assert.ok(Math.hypot(e.targetPoint.x-right.x,e.targetPoint.y-right.y)<55);assert.notDeepEqual(wrong,right);
 for(let i=0;i<1800&&target.hp===10;i++)stepBattle(b);assert.ok(target.hp<10);
});
