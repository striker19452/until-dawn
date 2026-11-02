import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,applyCampaignAction as act,makePerson,settleNight} from '../src/campaign.js';
import {createBattle,battleCommand,stepBattle,inner} from '../src/battle.js';
import {ZONES} from '../src/content.js';
import {orderDuration} from '../src/night-orders.js';
import {fearEffects,fearSituation,fearRetreat,mayFearRetreat,witnessInjury,fearStatus} from '../src/fear.js';
import {isIndoors} from '../src/shelter.js';
import {orderStatus} from '../client/orders.js';
import {validateClientResult} from '../src/client-result.js';

const close=(a,b,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
function fixture({fear=0,role='guard',crew=false}={}){
 let s=act(initialCampaign(53),{type:'chooseRole',role:'repairman'});s.resources={food:100,water:100,materials:100,fuel:100,medicine:100,parts:100};
 if(crew){s.people[0].zone='left';s.people.push(makePerson('lin','林禾','园艺师','survival'));s.people[1].zone='left';s.people[1].nightRole=role;}
 else s.people[0].nightRole=role;
 const base=act(s,{type:'prepare'}),b=createBattle(base,'fear',{autoPause:false});b.schedule=[{at:9999,type:'walker',zone:'gate'}];b.challenge=null;b.fires=[];b.paused=false;b.zones.forEach(z=>z.hp=100);b.supportBudget={materials:0,firewood:0};
 const id=crew?'lin':'hero';b.people.find(p=>p.id===id).fear=fear;return {base,b,id};
}
const person=(b,id='hero')=>b.people.find(p=>p.id===id);
const foe=(id='threat',zone='gate',mode='attack',point=ZONES.find(z=>z.id===zone))=>({id,type:'walker',zone,x:point.x,y:point.y,hp:1000,max:1000,mode,stun:0,attack:0,progress:0});
function until(b,condition){for(let i=0;i<2000&&!condition();i++)stepBattle(b);assert.ok(condition(),'state converges');}

test('fear smoothly increases attack intervals with unchanged damage, and never adds a work delay',()=>{
 for(const fear of [0,25,50,70,70.01,90,100]){
  close(fearEffects(fear).attackInterval,1.8+.009*fear);
  const {b}=fixture({fear});b.enemies=[foe()];
  until(b,()=>b.events.filter(e=>e.type==='attack').length>=4);
  const attacks=b.events.filter(e=>e.type==='attack');
  assert.ok(attacks.every(e=>e.damage===7));
  for(let i=1;i<attacks.length;i++)close(attacks[i].time-attacks[i-1].time,fearEffects(fear).attackInterval,.051);
  const p=person(b);for(const fatigue of [0,50,100])for(const type of ['repair','throw','bait','aid']){
   close(orderDuration({...p,fatigue,fear},type),orderDuration({...p,fatigue,fear:0},type));
  }
 }
});

test('high fear blocks remote guard/repair assistance, recalls reserved remote work once, but still accepts explicit orders',()=>{
 for(const role of ['guard','support'])for(const fear of [70,70.01,95]){
  const {b,id}=fixture({fear,role,crew:true});
  if(role==='guard')b.enemies=[foe()];else {b.zones[0].hp=40;b.supportBudget.materials=2;}
  const stock=b.resources.materials;stepBattle(b);assert.equal(!!person(b,id).task,fear<=70,`${role}/${fear}`);
  if(fear<=70){person(b,id).fear=80;stepBattle(b);assert.equal(person(b,id).task,null);assert.equal(b.resources.materials,stock);}
  b.zones[0].hp=40;
  battleCommand(b,{type:'repair',person:id,target:'gate'});assert.equal(person(b,id).task.automatic,false);
  until(b,()=>!person(b,id).task);assert.ok(b.zones[0].hp>40);
  assert.equal(person(b,id).zone,'left');assert.equal(person(b,id).nightRole,role);
 }
 const {b,id}=fixture({crew:true});Object.assign(person(b),inner(ZONES[0]),{zone:'gate',fear:95});b.enemies=[foe()];
 b.fearRetreats.hero={stage:'travel',progress:0};stepBattle(b);
 assert.equal(person(b,id).task?.assist,true,'a retreating guard must not count as an available defender');
});

test('panic retreats safely, settles for four seconds and restores the unchanged assignment with a real cooldown',()=>{
 const {base,b}=fixture({fear:95}),p=person(b);Object.assign(p,{x:315,y:400});
 b.enemies=[foe('inside','gate','inside',p)];stepBattle(b);
 assert.ok(fearRetreat(b,p));assert.match(orderStatus(p,b).current,/恐惧退却.*超过90.*近身攻击/);
 const assignment=[p.nightRole,p.zone];b.enemies=[];
 until(b,()=>fearRetreat(b,p)?.stage==='calm');assert.ok(isIndoors(b,p));
 const entered=b.elapsed,health=p.health,fear=p.fear;
 b.paused=true;const frozen=structuredClone(b);for(let i=0;i<20;i++)stepBattle(b);assert.deepEqual(b,frozen);
 b.paused=false;until(b,()=>!fearRetreat(b,p));close(b.elapsed-entered,4,.051);
 close(p.fear,fear-4,.051);assert.equal(p.health,health);assert.equal(isIndoors(b,p),false);
 assert.deepEqual([p.nightRole,p.zone],assignment);assert.ok(b.fearCooldowns.hero>=b.elapsed+19.99);
 p.fear=100;b.enemies=[foe('again','gate','inside',p)];assert.equal(mayFearRetreat(b,p),false);
 stepBattle(b);assert.equal(fearRetreat(b,p),null);
 const saved=settleNight(base,b);validateClientResult(base,saved);
 for(const key of ['fearRetreats','fearCooldowns','indoorPeople'])assert.equal(key in saved,false);
 for(const key of ['x','y','task'])assert.equal(key in saved.people[0],false);
 b.fearRetreats.hero={stage:'calm',progress:1};b.finished=true;
 assert.equal(fearStatus(p,b).retreat,null);assert.equal(orderStatus(p,b).current,'本夜已结束');
});

test('manual tasks cannot be interrupted by panic; accepted overrides end retreat while rejected commands keep everything intact',()=>{
 for(const type of ['guard','repair','throw','move']){
  const {b}=fixture({fear:100});Object.assign(person(b),{x:315,y:400});b.enemies=[foe('inside','gate','inside',person(b))];b.zones[0].hp=40;
  battleCommand(b,{type,person:'hero',target:type==='move'?{x:330,y:420}:'gate'});
  for(let i=0;i<20;i++){stepBattle(b);assert.equal(fearRetreat(b,person(b)),null);}
  assert.equal(person(b).nightRole,'guard');assert.equal(person(b).zone,'gate');
 }
 const {b}=fixture({fear:100});Object.assign(person(b),{x:315,y:400});b.enemies=[foe('inside','gate','inside',person(b))];stepBattle(b);
 const before=structuredClone(b);assert.throws(()=>battleCommand(b,{type:'repair',person:'hero',target:'wrong'}));assert.deepEqual(b,before);
 battleCommand(b,{type:'guard',person:'hero',target:'gate'});assert.equal(fearRetreat(b,person(b)),null);
 assert.equal(person(b).task.automatic,false);assert.ok(b.fearCooldowns.hero>b.elapsed);
 assert.match(orderStatus(person(b),b).fear,/手动任务优先/);
 for(let i=0;i<50;i++)stepBattle(b);assert.equal(fearRetreat(b,person(b)),null);
});

test('automatic interrupted reservations refund once, and sleep or severe injuries do not trigger a fear retreat',()=>{
 const {b}=fixture({fear:100,role:'support'});b.supportBudget.materials=1;b.zones[0].hp=40;stepBattle(b);
 const stock=b.resources.materials;assert.ok(person(b).task.automatic);
 b.enemies=[foe('inside','gate','inside',person(b))];stepBattle(b);
 assert.ok(fearRetreat(b,person(b)));assert.equal(b.resources.materials,stock+1);assert.equal(b.supportUsed.materials,0);
 stepBattle(b);assert.equal(b.resources.materials,stock+1);
 for(const role of ['sleep','guard']){
  const other=fixture({fear:100,role}).b;if(role==='guard')person(other).wound='severe';
  other.enemies=[foe('inside','gate','inside',person(other))];stepBattle(other);assert.equal(fearRetreat(other,person(other)),null);
 }
 const stunned=fixture({fear:100}).b;Object.assign(person(stunned),{x:315,y:400});
 stunned.enemies=[{...foe('stunned','gate','inside',person(stunned)),stun:2}];stepBattle(stunned);
 assert.equal(fearRetreat(stunned,person(stunned)),null,'a stunned intruder cannot trigger the under-attack retreat');
});

test('fear context accounts for isolated groups, broken fences, healthy allies and witnessing a new severe injury',()=>{
 const {b}=fixture(),p=person(b);Object.assign(p,{x:315,y:400});p.fear=40;
 b.enemies=[foe('a','gate','attack',p),foe('b','gate','attack',p),foe('c','gate','attack',p)];
 assert.equal(fearSituation(b,p).isolation,1.6);b.zones[2].hp=0;p.x=400;p.y=310;
 assert.equal(fearSituation(b,p).breach,.24);
 const ally=makePerson('lin','林禾','园艺师','survival');Object.assign(ally,{x:405,y:315});b.people.push(ally);
 const calm=fearSituation(b,p);assert.equal(calm.isolation,0);assert.equal(calm.calm,.08);
 const fear=p.fear;assert.deepEqual(witnessInjury(b,ally).map(p=>p.id),['hero']);assert.equal(p.fear,fear+16);
 ally.health=20;assert.equal(fearSituation(b,p).allies,0);
});

test('contact fear is one per second per intruder, with unchanged health damage and fire calming',()=>{
 for(const warm of [false,true]){
  const {b}=fixture({fear:40});const p=person(b),point={x:315,y:400};Object.assign(p,point,{cooldown:100});
  battleCommand(b,{type:'move',person:'hero',target:point});
  if(warm)b.fires=[{id:'central',x:240,y:390,wood:1,heat:60,wet:0,enabled:true}];
  b.enemies=[foe('contact','gate','inside',point)];stepBattle(b,.1);
  close(person(b).fear,40+.1-(warm?.004:0));
  close(person(b).health,100-.12*(warm?.7:1));
 }
 const {b}=fixture({fear:99.99});Object.assign(person(b),{x:315,y:400,cooldown:100});
 battleCommand(b,{type:'move',person:'hero',target:{x:315,y:400}});
 b.enemies=[foe('contact','gate','inside',person(b))];stepBattle(b,.1);assert.equal(person(b).fear,100);
});

test('isolation and breach fear double in the simulation while companion calming stays at 0.08',()=>{
 const {b}=fixture({fear:40});const p=person(b);Object.assign(p,{x:400,y:310,cooldown:100});b.zones[2].hp=0;
 battleCommand(b,{type:'move',person:'hero',target:{x:400,y:310}});
 b.enemies=['a','b','c'].map(id=>foe(id,'right','attack',{x:340,y:310}));
 stepBattle(b,.1);close(person(b).fear,40+.1*(1.6+.24));
 const ally=makePerson('lin','林禾','园艺师','survival');Object.assign(ally,{x:405,y:315,cooldown:100});b.people.push(ally);b.work.lin=0;
 const before=person(b).fear;stepBattle(b,.1);close(person(b).fear,before+.1*(.24-.08));
});

test('a new severe injury gives nearby witnesses sixteen fear once and reports the same amount',()=>{
 const {b}=fixture({fear:40}),p=person(b);Object.assign(p,{x:315,y:400,health:20.01,cooldown:100});
 const ally=makePerson('lin','林禾','园艺师','survival');Object.assign(ally,{x:375,y:400,fear:40,cooldown:100});b.people.push(ally);b.work.lin=0;
 b.enemies=[foe('contact','gate','inside',p)];stepBattle(b,.1);
 assert.equal(p.wound,'severe');assert.equal(ally.fear,56);assert.ok(b.events.some(e=>e.personId==='lin'&&e.text==='附近同伴重伤 · 恐惧+16'));
 stepBattle(b,.1);assert.equal(ally.fear,56);
 ally.fear=95;witnessInjury(b,p);assert.equal(ally.fear,100);
});

test('night breach fear becomes sixteen once per night, and existing calming and starting fear stay unchanged',()=>{
 for(const breaches of [0,1,3]){
  const {base,b}=fixture({fear:40});b.breaches=breaches;
  const result=settleNight(base,b);assert.equal(result.people[0].fear,breaches?56:32);
  assert.equal(act(result,{type:'nextDay'}).people[0].fear,breaches?52:28);
 }
 let s=act(initialCampaign(53),{type:'chooseRole',role:'repairman'});assert.equal(s.people[0].fear,8);
 s=act(s,{type:'recruit',person:'lin'});assert.equal(s.people[1].fear,18);
});
