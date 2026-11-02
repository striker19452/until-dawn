import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,applyCampaignAction,settleNight} from '../src/campaign.js';
import {createBattle,battleCommand,stepBattle,inner} from '../src/battle.js';
import {ZONES} from '../src/content.js';
import {validateClientResult} from '../src/client-result.js';
import {orderStatus} from '../client/orders.js';

function fixture(role='support'){
 let base=applyCampaignAction(initialCampaign(53),{type:'chooseRole',role:'repairman'});
 base=applyCampaignAction(base,{type:'nightRole',person:'hero',role,zone:'left'});
 base=applyCampaignAction(base,{type:'prepare'});
 const b=createBattle(base,'temporary-orders',{autoPause:false});b.schedule=[{at:9999,type:'walker',zone:'gate'}];b.challenge=null;b.paused=false;b.supportBudget={materials:0,firewood:0};b.zones.forEach(z=>z.hp=100);
 return {base,b};
}
function until(b,condition,max=1600){for(let i=0;i<max&&!condition();i++)stepBattle(b);assert.ok(condition(),'task reaches its declared completion condition');}
const command=(b,type,target='gate')=>battleCommand(b,{type,person:'hero',target});
const assigned=b=>[b.people[0].nightRole,b.people[0].zone];
const enemy=(id,x=70,y=310)=>({id,type:'walker',zone:'left',x,y,hp:7,max:7,mode:'attack',stun:0,attack:0,progress:0});

test('all temporary actions preserve every assigned role and focus zone through completion',()=>{
 for(const role of ['guard','support','sleep'])for(const type of ['move','guard','retreat','repair','fire','brace','throw','bait','compact','clearWet','barricade','aid']){
  const {b}=fixture(role);if(type==='fire')b.fires[0].heat=0;b.resources.medicine=10;b.zones[0].hp=40;b.house=75;
  if(type==='aid')Object.assign(b.people[0],{wound:'severe',health:15,deadline:2,x:240,y:350});
  const target=type==='move'?{x:350,y:410}:['fire','clearWet'].includes(type)?'central':'gate';
  command(b,type,target);assert.deepEqual(assigned(b),[role,'left'],`${role}/${type} queued`);
  until(b,()=>!b.people[0].task);assert.deepEqual(assigned(b),[role,'left'],`${role}/${type} completed`);
  stepBattle(b);assert.deepEqual(assigned(b),[role,'left']);assert.equal(b.people[0].manualPosition,undefined);
 }
});

test('movement holds for eight seconds, attacks nearby without chasing, then resumes the original patrol',()=>{
 const {b}=fixture('guard');command(b,'move',{x:350,y:410});until(b,()=>b.people[0].task?.stage==='work');
 const point={x:b.people[0].x,y:b.people[0].y},started=b.elapsed;
 b.enemies=[{...enemy('nearby',340,410),zone:'right',mode:'inside',hp:40,max:40}];
 for(let i=0;i<100;i++)stepBattle(b);
 assert.equal(b.people[0].x,point.x);assert.equal(b.people[0].y,point.y);assert.ok(b.enemies[0].hp<40);assert.equal(b.people[0].task.type,'move');
 b.enemies=[];until(b,()=>!b.people[0].task);assert.ok(b.elapsed-started>=7.9&&b.elapsed-started<8.1);assert.deepEqual(assigned(b),['guard','left']);
 until(b,()=>Math.hypot(b.people[0].x-inner(ZONES[1]).x,b.people[0].y-inner(ZONES[1]).y)<1);assert.equal(b.people[0].manualPosition,undefined);
});

test('drive order finishes its captured threats and does not turn later arrivals into a permanent posting',()=>{
 const {b}=fixture('support');b.enemies=[enemy('ordered')];command(b,'guard','left');
 b.enemies.push({...enemy('later',-50,310),mode:'approach',hp:40,max:40});
 until(b,()=>!b.people[0].task);assert.ok(!b.enemies.some(e=>e.id==='ordered'));assert.equal(b.enemies.find(e=>e.id==='later').hp,40);assert.deepEqual(assigned(b),['support','left']);
});

test('a support worker resumes automatic work after a manual order and manual costs do not consume the auto budget',()=>{
 const {b}=fixture('support');b.zones[0].hp=40;command(b,'repair','gate');until(b,()=>!b.people[0].task);assert.equal(b.supportUsed.materials,0);
 b.supportBudget.firewood=1;b.fires[0].wood=.1;stepBattle(b);assert.equal(b.people[0].task.type,'addWood');assert.equal(b.people[0].task.automatic,true);
 until(b,()=>!b.people[0].task);assert.equal(b.supportUsed.firewood,1);assert.deepEqual(assigned(b),['support','left']);
});

test('cancel and replacement refund unused material once and return to the same assignment',()=>{
 const {b}=fixture('support');b.zones[0].hp=40;const materials=b.resources.materials;
 command(b,'repair','gate');assert.equal(b.resources.materials,materials-1);command(b,'retreat');assert.equal(b.resources.materials,materials);
 command(b,'cancel');command(b,'cancel');assert.equal(b.resources.materials,materials);assert.equal(b.people[0].task,null);assert.deepEqual(assigned(b),['support','left']);
});

test('temporary retreat rests safely in shelter for eight seconds and then resumes the assigned guard duty',()=>{
 const {b}=fixture('guard');Object.assign(b.people[0],{x:240,y:350});command(b,'retreat');until(b,()=>b.people[0].task?.stage==='work');
 const started=b.elapsed,health=b.people[0].health;b.enemies=[{...enemy('inside',240,350),mode:'inside',hp:100}];
 for(let i=0;i<40;i++)stepBattle(b);assert.equal(b.people[0].health,health);assert.deepEqual(assigned(b),['guard','left']);
 b.enemies=[];until(b,()=>!b.people[0].task);assert.ok(b.elapsed-started>=7.9);until(b,()=>Math.hypot(b.people[0].x-240,b.people[0].y-350)>15);
});

test('injury suspends duty instead of editing it, and first aid restores the original role',()=>{
 const {b}=fixture('support');Object.assign(b.people[0],{x:400,y:400,health:20.01});b.enemies=[{...enemy('injure',400,400),mode:'inside',hp:100}];stepBattle(b);
 assert.equal(b.people[0].wound,'severe');assert.equal(b.people[0].task,null);assert.deepEqual(assigned(b),['support','left']);assert.match(orderStatus(b.people[0],b).current,/重伤退守/);
 b.enemies=[];b.resources.medicine=3;command(b,'aid');until(b,()=>!b.people[0].task);assert.equal(b.people[0].wound,'recovering');assert.equal(b.people[0].health,42);assert.deepEqual(assigned(b),['support','left']);
});

test('settlement preserves configured assignments and rejects uploaded role or zone edits',()=>{
 const {base,b}=fixture('support');command(b,'guard','right');b.people[0].nightRole='guard';b.people[0].zone='right';
 const result=settleNight(base,b);assert.equal(result.people[0].nightRole,'support');assert.equal(result.people[0].zone,'left');validateClientResult(base,result);
 for(const [key,value]of [['nightRole','sleep'],['zone','gate']]){const bad=structuredClone(result);bad.people[0][key]=value;assert.throws(()=>validateClientResult(base,bad),/分工/);}
});

test('task previews distinguish assignment, paused order, countdown and the exact return behavior',()=>{
 const {b}=fixture('support');b.paused=true;command(b,'move',{x:350,y:410});let info=orderStatus(b.people[0],b);
 assert.match(info.role,/支援修补添火.*左栏/);assert.match(info.current,/待执行.*警戒8秒/);assert.match(info.after,/恢复自动支援/);
 b.people[0].task.stage='work';b.people[0].task.progress=3;info=orderStatus(b.people[0],b);assert.match(info.current,/临时警戒.*剩余5秒.*已暂停/);
 command(b,'cancel');info=orderStatus(b.people[0],b);assert.match(info.current,/按分工自动支援/);assert.match(info.after,/左栏/);
});
