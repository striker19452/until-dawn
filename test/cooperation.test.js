import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,applyCampaignAction,makePerson,settleNight} from '../src/campaign.js';
import {createBattle,battleCommand,stepBattle,inner} from '../src/battle.js';
import {COMPANIONS,ZONES} from '../src/content.js';
import {validateClientResult} from '../src/client-result.js';
import {isIndoors,sleepInterrupted} from '../src/shelter.js';
import {orderStatus} from '../client/orders.js';
import {ownThreats,patrolTarget,warningDistance} from '../src/cooperation.js';

function fixture({ids=['lin'],role='guard'}={}){
 let base=applyCampaignAction(initialCampaign(53),{type:'chooseRole',role:'repairman'});base.resources={food:100,water:100,materials:100,fuel:100,medicine:100,parts:100};base.beds=5;base.people[0].zone='left';
 for(const id of ids){const c=COMPANIONS.find(c=>c.id===id),p=makePerson(id,c.name,c.role,c.skill);p.nightRole=role;p.zone='left';p.fatigue=60;base.people.push(p);}
 base=applyCampaignAction(base,{type:'prepare'});const b=createBattle(base,'cooperation',{autoPause:false});b.schedule=[{at:9999,type:'walker',zone:'gate'}];b.challenge=null;b.paused=false;b.zones.forEach(z=>z.hp=100);b.supportBudget={materials:0,firewood:0};
 return {base,b};
}
const person=(b,id='lin')=>b.people.find(p=>p.id===id);
const foe=(id,zone='gate',mode='attack')=>{const z=ZONES.find(z=>z.id===zone);return {id,type:'walker',zone,x:z.x,y:z.y,hp:23,max:23,mode,attack:0,progress:0,stun:0,called:false};};
function until(b,condition){for(let i=0;i<1800&&!condition();i++)stepBattle(b);assert.ok(condition(),'automatic assistance completes');}

test('an idle companion crosses the yard to help an uncovered zone, defeats the captured threat and returns to the assigned post',()=>{
 const {base,b}=fixture();b.enemies=[foe('uncovered')];stepBattle(b);
 assert.deepEqual([person(b).task.type,person(b).task.target,person(b).task.automatic,person(b).task.assist],['guard','gate',true,true]);assert.equal(person(b).zone,'left');assert.equal(person(b,'hero').task,null);
 assert.match(orderStatus(person(b),b).current,/自动支援驱赶.*正门/);assert.match(orderStatus(person(b),b).after,/返回左栏巡守/);
 until(b,()=>!b.enemies.length);until(b,()=>!person(b).task&&Math.hypot(person(b).x-inner(ZONES[1]).x,person(b).y-inner(ZONES[1]).y)<1);
 assert.equal(person(b).nightRole,'guard');assert.equal(person(b).zone,'left');assert.ok(!orderStatus(person(b),b).current.includes('临时'));
 const saved=settleNight(base,b);validateClientResult(base,saved);assert.equal(saved.people[1].zone,'left');assert.equal(saved.people[1].task,undefined);
});

test('distant local approaches allow assistance; a nearby approach recalls the helper',()=>{
 const {b}=fixture();b.enemies=[foe('elsewhere'),{...foe('home','left','approach'),x:-200}];stepBattle(b);assert.ok(person(b).task.assist);
 const task=person(b).task;b.enemies.find(e=>e.id==='home').x=-180;stepBattle(b);assert.equal(person(b).task,task);
 b.enemies.find(e=>e.id==='home').x=-20;stepBattle(b);assert.equal(person(b).task,null);assert.equal(person(b).zone,'left');
});

test('every warning source expands early deployment, with fog, stacking and local bells respected',()=>{
 const cases=[
  {lead:0},{tower:'normal',lead:25},{tower:'normal',weather:'fog',lead:17.5},
  {tower:'yield',lead:45},{tower:'yield',weather:'fog',lead:31.5},
  {tower:'steady',lead:35},{tower:'steady',weather:'fog',lead:45},
  {scout:12,lead:12},{bell:true,lead:18},{tower:'yield',scout:12,bell:true,lead:75},
  {tower:'yield',hp:0,lead:0}
 ];
 for(const c of cases){
  const {b}=fixture();b.weather=c.weather||'clear';b.scoutLead=c.scout||0;
  if(c.tower)b.buildings=[{id:'tower',type:'watchtower',branch:c.tower,hp:c.hp??10}];
  b.zones[0].bell=!!c.bell;b.enemies=[{...foe('warning','gate','approach'),y:inner(ZONES[0]).y+130}];
  const before={x:person(b).x,y:person(b).y};stepBattle(b);
  assert.ok(Math.abs(warningDistance(b,'gate')-c.lead)<1e-8,JSON.stringify(c));assert.ok(Math.abs(warningDistance(b,'right')-(c.lead-(c.bell?18:0)))<1e-8);
  assert.equal(!!person(b).task?.assist,c.lead>0,JSON.stringify(c));
  if(c.lead){assert.ok(Math.hypot(person(b).x-before.x,person(b).y-before.y)>0);assert.match(orderStatus(person(b),b).current,/预警提前就位/);}
 }
});

test('warning enlarges patrol selection but does not turn a distant local approach into a recall',()=>{
 const {b}=fixture();const p=person(b,'hero'),home={...foe('home','left','approach'),x:inner(ZONES[1]).x-135};b.enemies=[home];
 assert.equal(patrolTarget(b,p),null);b.warningLead=25;assert.equal(patrolTarget(b,p),home);assert.equal(ownThreats(b,p).length,0);
 home.x=inner(ZONES[1]).x-124;assert.equal(ownThreats(b,p).length,1);
 home.x=-200;home.mode='attack';assert.equal(ownThreats(b,p).length,1);home.mode='inside';assert.equal(ownThreats(b,p).length,1);
 home.mode='retreat';assert.equal(ownThreats(b,p).length,0);
 // An out-of-range nearest enemy must not mask a detectable one elsewhere.
 b.enemies=[{...foe('near-person','right','approach'),x:450,y:400},foe('detectable','left')];Object.assign(p,{x:400,y:400});
 assert.equal(patrolTarget(b,p).id,'detectable');
});

test('a local early warning does not repeatedly cancel a cross-zone guard assignment',()=>{
 const {b}=fixture();b.scoutLead=75;b.enemies=[foe('elsewhere'),{...foe('far-home','left','approach'),x:inner(ZONES[1]).x-190}];
 stepBattle(b);const task=person(b).task;assert.ok(task?.assist);
 for(let i=0;i<20;i++){stepBattle(b);assert.equal(person(b).task,task);}
 assert.equal(b.log.filter(line=>line.includes('自动支援')).length,1);
 b.enemies.find(e=>e.id==='far-home').x=inner(ZONES[1]).x-124;stepBattle(b);assert.equal(person(b).task,null);
});

test('a warning buys real time to reach the threatened post before contact, without extending attack range',()=>{
 const times=[];
 for(const warned of [false,true]){
  const {b}=fixture();if(warned){b.buildings=[{id:'tower',type:'watchtower',branch:'yield',hp:10}];b.scoutLead=12;b.warningLead=57;b.zones[0].bell=true;}
  b.schedule=[{at:.05,type:'walker',zone:'gate'}];let arrived=null,contact=null,reinforced=false;
  for(let i=0;i<600&&(arrived===null||contact===null);i++){
   stepBattle(b);if(!reinforced&&b.enemies.length){b.enemies[0].hp=b.enemies[0].max=500;reinforced=true;}
   if(arrived===null&&Math.hypot(person(b).x-ZONES[0].x,person(b).y-ZONES[0].y)<=50)arrived=b.elapsed;
   if(contact===null){const event=b.events.find(e=>e.type==='contact');if(event)contact=event.time;}
   for(const event of b.events.filter(e=>e.type==='attack'&&e.source)){
    const target=b.enemies.find(e=>e.id===event.enemyId);if(target&&event.time===b.elapsed)assert.ok(Math.hypot(event.source.x-target.x,event.source.y-target.y)<=50);
   }
  }
  assert.notEqual(arrived,null);assert.notEqual(contact,null);times.push({arrived,contact});
 }
 assert.ok(times[1].arrived<times[1].contact);assert.ok(times[1].contact-times[1].arrived>times[0].contact-times[0].arrived+3);
});

test('remote repair continues past distant locals, then a close local recalls and refunds its reservation once',()=>{
 const {b}=fixture({role:'support'});b.supportBudget.materials=1;b.zones[0].hp=40;const materials=b.resources.materials;
 b.enemies=[{...foe('home','left','approach'),x:-200}];stepBattle(b);const task=person(b).task;assert.equal(task?.target,'gate');assert.equal(b.resources.materials,materials-1);
 stepBattle(b);assert.equal(person(b).task,task);assert.equal(b.resources.materials,materials-1);
 b.enemies[0].x=-20;stepBattle(b);assert.equal(person(b).task,null);assert.equal(b.resources.materials,materials);assert.equal(b.supportUsed.materials,0);
 stepBattle(b);assert.equal(b.resources.materials,materials);
});

test('a companion finishes its own intruder even after it has moved beyond the normal patrol radius',()=>{
 const {b}=fixture();b.enemies=[{...foe('home-intruder','left','inside'),x:240,y:350}];
 until(b,()=>!b.enemies.length);assert.ok(b.work.lin>0);assert.equal(b.work.hero,0);assert.equal(person(b).zone,'left');
});

test('a normally covered zone needs no extra helper, but inside, low-health and charged threats trigger assistance',()=>{
 for(const danger of ['none','inside','weak','charge','outnumbered']){
  const {b}=fixture();Object.assign(person(b,'hero'),inner(ZONES[0]),{zone:'gate'});b.enemies=[foe('front')];
  if(danger==='inside')b.enemies[0].mode='inside';if(danger==='weak')b.zones[0].hp=30;if(danger==='charge')Object.assign(b.enemies[0],{type:'rammer',hp:65,max:65,attack:2});if(danger==='outnumbered')b.enemies.push(foe('second'));
  stepBattle(b);assert.equal(!!person(b).task?.assist,danger!=='none',danger);
 }
 const {b}=fixture();b.enemies=[foe('front'),foe('intruder','right','inside')];stepBattle(b);assert.equal(person(b).task.target,'right','an intruder takes priority over an uncovered intact fence');
});

test('at most two companions reserve automatic guard assistance for the same zone',()=>{
 const {b}=fixture({ids:['lin','zhou','chen','xu']});b.enemies=['front','second','third'].map(id=>({...foe(id),hp:300,max:300}));stepBattle(b);
 assert.equal(b.people.filter(p=>p.task?.assist&&p.task.type==='guard').length,2);assert.equal(person(b,'hero').task,null);
 for(let i=0;i<20;i++){stepBattle(b);assert.ok(b.people.filter(p=>p.task?.assist&&p.task.type==='guard'&&p.task.target==='gate').length<=2);}
});

test('support repairs its own zone before lower remote walls, then helps elsewhere within the same shared budget',()=>{
 const {b}=fixture({role:'support'});b.supportBudget.materials=2;b.zones.find(z=>z.id==='left').hp=40;b.zones[0].hp=10;const materials=b.resources.materials;
 stepBattle(b);assert.equal(person(b).task.target,'left');assert.equal(person(b).task.assist,undefined);
 until(b,()=>!person(b).task);stepBattle(b);assert.equal(person(b).task.target,'gate');assert.equal(person(b).task.assist,true);assert.match(orderStatus(person(b),b).current,/自动支援修补/);
 until(b,()=>!person(b).task);stepBattle(b);assert.equal(b.supportUsed.materials,2);assert.equal(b.resources.materials,materials-2);assert.equal(b.zones[0].hp,33);assert.equal(person(b).task,null);
});

test('repair reservations prevent duplicate work and overspending across multiple helpers',()=>{
 for(const [hp,budget,count]of [[50,4,1],[30,1,1],[30,2,2]]){
  const {b}=fixture({ids:['lin','zhou','xu'],role:'support'});b.zones.find(z=>z.id==='left').hp=100;b.zones[0].hp=hp;b.supportBudget.materials=budget;const materials=b.resources.materials;stepBattle(b);
  assert.equal(b.people.filter(p=>p.task?.type==='repair').length,count);assert.equal(b.resources.materials,materials-count);assert.equal(b.supportUsed.materials,0);
  until(b,()=>!b.people.some(p=>p.task));assert.equal(b.supportUsed.materials,count);assert.equal(b.resources.materials,materials-count);
 }
});

test('support clears an occupied breach before reserving resources to seal it',()=>{
 const {b}=fixture({role:'support'});b.supportBudget.materials=1;b.zones[0].hp=0;b.enemies=[foe('intruder','gate','inside')];const materials=b.resources.materials;
 stepBattle(b);assert.equal(person(b).task.type,'guard');assert.equal(b.resources.materials,materials);
 until(b,()=>!b.enemies.length);until(b,()=>person(b).task?.type==='repair');assert.equal(person(b).task.target,'gate');
 until(b,()=>!person(b).task);assert.ok(b.zones[0].hp>0);assert.equal(b.supportUsed.materials,1);assert.equal(b.resources.materials,materials-1);
});

test('returning to newly damaged home work transfers the existing reservation once; no-budget support can still guard without task churn',()=>{
 const {b}=fixture({role:'support'});b.resources.materials=1;b.supportBudget.materials=1;b.zones[0].hp=40;stepBattle(b);assert.equal(person(b).task.target,'gate');assert.equal(b.resources.materials,0);
 b.zones.find(z=>z.id==='left').hp=40;stepBattle(b);assert.equal(person(b).task.target,'left');assert.equal(b.resources.materials,0);assert.equal(b.supportUsed.materials,0);
 battleCommand(b,{type:'retreat',person:'lin'});assert.equal(b.resources.materials,1);
 const other=fixture({role:'support'}).b;other.zones.find(z=>z.id==='left').hp=40;other.enemies=[foe('front')];for(let i=0;i<20;i++)stepBattle(other);
 assert.equal(person(other).task.type,'guard');assert.equal(other.log.filter(line=>line.includes('自动支援')).length,1);
});

test('manual orders override assistance, and resolved remote work cancels and refunds before arrival',()=>{
 const {b}=fixture();b.enemies=[foe('front')];stepBattle(b);b.zones[2].hp=40;const materials=b.resources.materials;
 battleCommand(b,{type:'repair',person:'lin',target:'right'});b.enemies.push({...foe('home','left','approach'),x:-20});for(let i=0;i<20;i++)stepBattle(b);
 assert.equal(person(b).task.type,'repair');assert.equal(person(b).task.automatic,false);assert.equal(person(b).task.assist,undefined);
 battleCommand(b,{type:'cancel',person:'lin'});assert.equal(b.resources.materials,materials);
 const remote=fixture({role:'support'}).b;remote.supportBudget.materials=1;remote.zones[0].hp=40;const before=remote.resources.materials;stepBattle(remote);remote.zones[0].hp=100;stepBattle(remote);
 assert.equal(person(remote).task,null);assert.equal(remote.resources.materials,before);assert.equal(remote.supportUsed.materials,0);
});

test('sleepers are not called out automatically; exhausted or badly hurt companions are not sent to fight',()=>{
 const {base,b}=fixture({role:'sleep'});b.enemies=[foe('front')];for(let i=0;i<200;i++)stepBattle(b);
 assert.ok(isIndoors(b,person(b)));assert.equal(sleepInterrupted(b,person(b)),false);assert.equal(person(b).task,null);assert.equal(settleNight(base,b).people[1].fatigue,16);
 for(const change of [{health:29},{stamina:0},{wound:'severe',health:20}]){const other=fixture().b;Object.assign(person(other),change);other.enemies=[foe('front')];stepBattle(other);assert.equal(person(other).task,null);}
});
