import {isIndoors,leaveHouse} from '../src/shelter.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { initialCampaign,applyCampaignAction,settleNight } from '../src/campaign.js';
import { createBattle,battleCommand,stepBattle } from '../src/battle.js';
import { validateClientResult } from '../src/client-result.js';
import { artPoint,worldPoint,pickPerson } from '../client/scene-layout.js';
import { walkablePoint,nearestWalkablePoint,moveToward } from '../src/movement.js';
import { createWalkMap,COURTYARD,HOUSE_FOOTPRINT,HOUSE_ANCHOR } from '../src/yard-geometry.js';
function fixture(){const base=applyCampaignAction(applyCampaignAction(initialCampaign(53),{type:'chooseRole',role:'repairman'}),{type:'prepare'}),battle=createBattle(base,'click-move',{autoPause:false});battle.schedule=[{at:9999,type:'walker',zone:'gate'}];battle.challenge=null;battle.fires=[];return {base,battle};}
const run=(b,n)=>{for(let i=0;i<n;i++)stepBattle(b);};

test('direct movement can be queued while paused, walks around the house, arrives for a temporary hold and returns to duty',()=>{
 const {battle:b}=fixture();Object.assign(b.people[0],{x:145,y:197});const resources=structuredClone(b.resources);
 battleCommand(b,{type:'move',person:'hero',target:{x:350,y:410}});const frozen=structuredClone(b);run(b,10);assert.deepEqual(b,frozen);assert.deepEqual(b.resources,resources);
 battleCommand(b,{type:'resume'});let moved=false;for(let i=0;i<800&&b.people[0].task?.stage!=='work';i++){stepBattle(b);const p=b.people[0];moved ||= p.x!==145;assert.ok(walkablePoint(p,b.walkMap),'every step stays on the painted ground and outside building footprints');}
 const p=b.people[0];assert.ok(moved);assert.equal(p.task.stage,'work');assert.ok(Math.hypot(p.x-350,p.y-410)<.11);assert.equal(p.manualPosition,undefined);
 const point={x:p.x,y:p.y};run(b,100);assert.deepEqual({x:p.x,y:p.y},point);run(b,100);assert.equal(p.task,null);assert.ok(Math.hypot(p.x-point.x,p.y-point.y)>1);assert.deepEqual(b.resources,resources);
});

test('invalid destinations preserve the previous job and reservation; a valid move refunds unused materials once',()=>{
 const {battle:b}=fixture();battleCommand(b,{type:'repair',person:'hero',target:'gate'});const old=structuredClone(b);
 for(const target of [null,{},'gate',{x:NaN,y:350},{x:240,y:Infinity}]){assert.throws(()=>battleCommand(b,{type:'move',person:'hero',target}));assert.deepEqual(b,old);}
 const target={x:350,y:400};battleCommand(b,{type:'move',person:'hero',target});target.x=999;assert.deepEqual(b.people[0].task.target,{x:350,y:400});assert.equal(b.resources.materials,old.resources.materials+1);
 battleCommand(b,{type:'move',person:'hero',target:{x:100,y:400}});assert.equal(b.resources.materials,old.resources.materials+1);
});

test('the walkable outline follows the courtyard walls and house footing instead of a bounding rectangle',()=>{
 for(const p of [{x:60,y:400},{x:420,y:400},{x:170,y:145},{x:310,y:145},{x:240,y:438}])assert.ok(walkablePoint(worldPoint(p)),JSON.stringify(p));
 for(const p of [{x:40,y:180},{x:440,y:180},{x:100,y:460},{x:240,y:460},{x:240,y:500},{x:240,y:240}])assert.equal(walkablePoint(worldPoint(p)),false,JSON.stringify(p));
 for(const p of [...COURTYARD,...HOUSE_FOOTPRINT])assert.ok(walkablePoint(worldPoint(p)),'boundary points are stable valid destinations');
});

test('front-of-house destinations stay in front, while injured occupants leave through the real doorway',()=>{
 const map=createWalkMap(),from={x:240,y:350};
 for(const x of [180,200,240,280,305])for(const y of [270,275,279]){
  const target=nearestWalkablePoint(worldPoint({x,y}),map,from);
  assert.ok(walkablePoint(target,map));assert.ok(artPoint(target).y>=HOUSE_ANCHOR.y+6-1e-8,'front taps leave standing room beyond the house depth');
 }
 const base=fixture().base;base.people[0].nightRole='guard';base.people[0].wound='severe';
 const b=createBattle(base,'safe-rest');assert.ok(isIndoors(b,b.people[0]));leaveHouse(b,b.people[0]);assert.ok(walkablePoint(b.people[0],b.walkMap));assert.ok(artPoint(b.people[0]).y>HOUSE_ANCHOR.y);
});

test('gate and exterior taps resolve inside the front wall and the whole approach stays there',()=>{
 const map=createWalkMap();
 for(const x of [200,240,280])for(const y of [460,468,500]){
  const person={x:240,y:350},target=nearestWalkablePoint(worldPoint({x,y}),map,person);
  assert.ok(artPoint(target).y<=443+1e-8);assert.ok(walkablePoint(target,map));
  for(let i=0;i<500&&Math.hypot(person.x-target.x,person.y-target.y)>.01;i++){
   moveToward(person,target,43,.05,true,map);assert.ok(artPoint(person).y<=443+1e-8);assert.ok(walkablePoint(person,map));
  }
  assert.ok(Math.hypot(person.x-target.x,person.y-target.y)<.01);
 }
});

test('blocked clicks snap to the nearest ground point in painted screen space and preserve valid clicks exactly',()=>{
 const map=createWalkMap(),from={x:350,y:400};
 for(const requested of [{x:240,y:240},{x:0,y:300},{x:240,y:550},{x:240,y:336},{x:100,y:470}]){
  const target=nearestWalkablePoint(worldPoint(requested),map,from);assert.ok(walkablePoint(target,map));const painted=artPoint(target),actual=Math.hypot(painted.x-requested.x,painted.y-requested.y);
  // No sampled valid edge point can be closer than the exact projection.
  for(const poly of [map.boundary,...map.obstacles])for(let i=0;i<poly.length;i++)for(let n=0;n<=20;n++){
   const a=poly[i],b=poly[(i+1)%poly.length],p={x:a.x+(b.x-a.x)*n/20,y:a.y+(b.y-a.y)*n/20};
   if(walkablePoint(worldPoint(p),map))assert.ok(actual<=Math.hypot(p.x-requested.x,p.y-requested.y)+1e-6);
  }
 }
 const valid={x:350.123,y:410.456};assert.deepEqual(nearestWalkablePoint(valid,map,from),valid);
 assert.equal(nearestWalkablePoint({x:Infinity,y:1},map),null);
});

test('the nearest reachable point is used when an obstacle divides the ground',()=>{
 const rect=(left,top,right,bottom)=>[{x:left,y:top},{x:right,y:top},{x:right,y:bottom},{x:left,y:bottom}];
 const map={boundary:rect(0,0,100,100),obstacles:[rect(45,-10,55,110)]},from=worldPoint({x:20,y:50});
 const target=artPoint(nearestWalkablePoint(worldPoint({x:80,y:50}),map,from));
 assert.ok(Math.abs(target.x-45)<1e-6);assert.ok(Math.abs(target.y-50)<1e-6);
});

test('house, facilities, hearths and concave wall corners are avoided throughout a route',()=>{
 const map=createWalkMap({buildings:[{type:'garden'},{type:'watchtower'},{type:'workshop'}],zones:[]});
 for(const [a,b] of [[{x:170,y:150},{x:300,y:440}],[{x:350,y:400},{x:65,y:300}],[{x:240,y:465},{x:80,y:430}],[{x:200,y:336},{x:280,y:336}]]){
  const p=nearestWalkablePoint(worldPoint(a),map),target=nearestWalkablePoint(worldPoint(b),map,p);
  for(let i=0;i<1000&&Math.hypot(p.x-target.x,p.y-target.y)>.01;i++){
   const before=artPoint(p);moveToward(p,target,43,.05,true,map);const after=artPoint(p);
   for(let n=0;n<=4;n++)assert.ok(walkablePoint(worldPoint({x:before.x+(after.x-before.x)*n/4,y:before.y+(after.y-before.y)*n/4}),map));
  }
  assert.ok(Math.hypot(p.x-target.x,p.y-target.y)<.01,'arrives without sticking at a corner');
 }
});

test('night commands resolve blocked destinations before replacing a reserved job',()=>{
 const {battle:b}=fixture();battleCommand(b,{type:'repair',person:'hero',target:'gate'});const materials=b.resources.materials;
 battleCommand(b,{type:'move',person:'hero',target:{x:240,y:280}});assert.ok(walkablePoint(b.people[0].task.target,b.walkMap));assert.equal(b.resources.materials,materials+1);
 battleCommand(b,{type:'resume'});for(let i=0;i<800&&b.people[0].task;i++)stepBattle(b);
 assert.equal(b.people[0].task,null);assert.equal(b.people[0].manualPosition,undefined);assert.equal(b.people[0].zone,'gate');
});

test('temporary positioning guards nearby threats without chasing and later orders replace the hold',()=>{
 const {battle:b}=fixture();Object.assign(b.people[0],{x:350,y:400});battleCommand(b,{type:'move',person:'hero',target:{x:350,y:400}});battleCommand(b,{type:'resume'});stepBattle(b);
 b.enemies=[{id:'nearby',type:'walker',zone:'right',x:340,y:400,hp:23,max:23,mode:'inside',stun:0,attack:0,progress:0}];stepBattle(b);assert.ok(b.enemies[0].hp<23);assert.equal(b.people[0].x,350);assert.equal(b.people[0].y,400);
 battleCommand(b,{type:'guard',person:'hero',target:'backLeft'});assert.equal(b.people[0].manualPosition,undefined);assert.equal(b.people[0].task.type,'guard');
});

test('severe wounds reject movement and runtime destinations never leak into the dawn save',()=>{
 const {base,battle:b}=fixture();b.people[0].wound='severe';const old=structuredClone(b);assert.throws(()=>battleCommand(b,{type:'move',person:'hero',target:{x:100,y:400}}));assert.deepEqual(b,old);
 b.people[0].wound='none';battleCommand(b,{type:'move',person:'hero',target:{x:350,y:400}});battleCommand(b,{type:'resume'});run(b,180);assert.equal(b.people[0].task?.type,'move');assert.equal(b.people[0].manualPosition,undefined);const result=settleNight(base,b);assert.equal(result.people[0].manualPosition,undefined);assert.equal(result.people[0].task,undefined);validateClientResult(base,result);
});

test('map clicks invert the art perspective exactly and pick people before ground or creatures',()=>{
 for(const y of [25,170,195,215,310,350,452,475,625])for(const x of [90,145,240,335,390]){const restored=worldPoint(artPoint({x,y}));assert.ok(Math.abs(restored.x-x)<1e-8);assert.ok(Math.abs(restored.y-y)<1e-8);}
 const tokens=new Map([['e-walker',{x:150,y:250,bodyBounds:{left:140,top:180,width:25,height:70}}],['p-lin',{x:150,y:250,bodyBounds:{left:140,top:180,width:25,height:70}}]]);
 assert.equal(pickPerson(tokens,{x:150,y:205}),'lin');const stacked=new Map([['p-hero',tokens.get('p-lin')],['p-lin',tokens.get('p-lin')]]);assert.equal(pickPerson(stacked,{x:150,y:205},8,'hero'),'lin');assert.equal(pickPerson(stacked,{x:150,y:205},8,'lin'),'hero');assert.equal(pickPerson(tokens,{x:300,y:400}),null);assert.equal(walkablePoint(worldPoint({x:-100,y:300})),false);
});
