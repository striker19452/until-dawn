import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,applyCampaignAction as act,makePerson,settleNight,normalizeCampaign} from '../src/campaign.js';
import {createBattle,stepBattle,battleCommand} from '../src/battle.js';
import {enterHouse,leaveHouse,HOUSE_DOOR,isIndoors} from '../src/shelter.js';
import {validateClientResult} from '../src/client-result.js';
import {deathReason} from '../src/health.js';
import {formatDurability,formatDurabilityText} from '../src/format.js';
import {SITES} from '../src/content.js';
import {searchPlan,searchInjury} from '../src/search.js';

function fixture(crew=false){let s=act(initialCampaign(53),{type:'chooseRole',role:'repairman'});s.flags.centralFire=false;s.people[0].nightRole='sleep';if(crew)s.people.push(makePerson('lin','林禾','园艺师','survival'));const base=act(s,{type:'prepare'}),b=createBattle(base,'lethal',{autoPause:false});b.schedule=[{at:9999,type:'walker',zone:'gate'}];b.challenge=null;b.paused=false;return {base,b};}
function target(b,id='hero',health=.03){const p=b.people.find(p=>p.id===id);leaveHouse(b,p);Object.assign(p,{x:400,y:400,health,wound:'severe',deadline:2});return p;}
const enemy=(id,p)=>({id,type:'walker',zone:'gate',x:p.x,y:p.y,hp:100,max:100,mode:'inside',attack:0,progress:0,stun:0});

test('severe wounds keep taking damage below five, including just outside the doorway',()=>{
 for(const door of [false,true]){const {b}=fixture(),p=target(b,'hero',door?10:5.02);if(door)Object.assign(p,{x:HOUSE_DOOR.x+10,y:HOUSE_DOOR.y});b.enemies=[enemy('attacker',p)];stepBattle(b);assert.ok(p.health<(door?10:5));assert.equal(p.dead,false);assert.equal(isIndoors(b,p),false);}
});

test('fatal hero damage stops the night with a standing house and records actual cause',()=>{
 const {base,b}=fixture(),p=target(b);b.enemies=[enemy('attacker',p)];stepBattle(b);assert.equal(p.health,0);assert.equal(p.dead,true);assert.equal(p.deathCause,'attack');assert.equal(b.house,100);assert.equal(b.finished,true);assert.equal(b.paused,true);const elapsed=b.elapsed;stepBattle(b);assert.equal(b.elapsed,elapsed);
 const result=settleNight(base,b);assert.equal(result.phase,'failed');assert.equal(result.people[0].health,0);assert.deepEqual(result.report.deaths,['你']);assert.equal(result.report.foodUsed,0);assert.equal(result.report.waterUsed,0);assert.match(deathReason(result.people[0]),/受到攻击.*健康归零/);validateClientResult(base,result);
});

test('companion death cancels and refunds reserved aid once, cannot act or be revived, and does not end the night',()=>{
 const {base,b}=fixture(true);target(b,'lin',.1);const before=b.resources.medicine;battleCommand(b,{type:'aid',person:'lin'});let p=b.people.find(p=>p.id==='lin');assert.equal(b.resources.medicine,before-2);b.enemies=[enemy('one',p),enemy('two',p)];stepBattle(b);p=b.people.find(p=>p.id==='lin');assert.equal(p.health,0);assert.equal(p.dead,true);assert.equal(p.task,null);assert.equal(b.resources.medicine,before);assert.equal(b.finished,false);assert.equal(b.events.filter(e=>e.type==='death').length,1);assert.throws(()=>battleCommand(b,{type:'aid',person:'lin'}),/成员不存在/);for(let i=0;i<5;i++)stepBattle(b);assert.equal(b.resources.medicine,before);
 const result=settleNight(base,b);assert.deepEqual(result.report.deaths,['林禾']);assert.equal(result.phase,'report');validateClientResult(base,result);
});

test('actual indoor refuge is safe and retreat enters the house instead of creating a nearby invulnerability radius',()=>{
 const {b}=fixture(),p=b.people[0];b.enemies=[enemy('inside-yard',HOUSE_DOOR)];const health=p.health;stepBattle(b);assert.equal(p.health,health);assert.ok(isIndoors(b,p));
 leaveHouse(b,p);Object.assign(p,{nightRole:'guard',wound:'none',x:HOUSE_DOOR.x+10,y:HOUSE_DOOR.y});battleCommand(b,{type:'retreat',person:'hero'});for(let i=0;i<40&&b.people[0].task?.stage!=='work';i++)stepBattle(b);assert.ok(isIndoors(b,b.people[0]));
});

test('food and water shortage can kill at zero without restoring five health',()=>{
 const {base,b}=fixture();base.people[0].health=b.people[0].health=10;base.resources.food=b.resources.food=0;base.resources.water=b.resources.water=0;const result=settleNight(base,b);assert.equal(result.people[0].health,0);assert.equal(result.people[0].dead,true);assert.equal(result.people[0].deathCause,'shortage');assert.equal(result.phase,'failed');assert.deepEqual(result.report.deaths,['你']);validateClientResult(base,result);
});

test('a lethal deep search keeps its loot but ends the hero run, and zero-health active saves cannot be healed back to life',()=>{
 let seed=1;const plan=searchPlan(SITES.alley,{deep:true,day:2});while(!searchInjury(seed,2,'alley',plan))seed++;
 let s=act(initialCampaign(seed),{type:'chooseRole',role:'repairman'});s.day=2;s.people[0].health=1;const before=s.resources.food;s=act(s,{type:'search',site:'alley',deep:true});assert.equal(s.resources.food,before+plan.loot.food);assert.equal(s.people[0].health,0);assert.equal(s.people[0].dead,true);assert.equal(s.people[0].deathCause,'search');assert.equal(s.phase,'failed');assert.equal(s.report.period,'day');assert.throws(()=>act(s,{type:'treat',person:'hero'}));
 const old=act(initialCampaign(53),{type:'chooseRole',role:'medic'});old.people[0].health=0;normalizeCampaign(old);assert.equal(old.people[0].dead,true);assert.equal(old.phase,'failed');assert.throws(()=>act(old,{type:'rest'}));
});

test('save validation rejects a living zero-health person, resurrection and invented death causes',()=>{
 const {base,b}=fixture(),p=target(b);b.enemies=[enemy('fatal',p)];stepBattle(b);const result=settleNight(base,b);
 const alive=structuredClone(result);alive.people[0].dead=false;assert.throws(()=>validateClientResult(base,alive),/健康归零/);
 const invalid=structuredClone(result);invalid.people[0].deathCause='mystery';assert.throws(()=>validateClientResult(base,invalid),/死亡原因/);
 const prior=structuredClone(base);prior.people[0].dead=true;const revived=structuredClone(result);Object.assign(revived.people[0],{dead:false,health:42});delete revived.people[0].deathCause;assert.throws(()=>validateClientResult(prior,revived),/不能复活/);
});

test('durability formatting rounds to one decimal, omits integer zeros and keeps tiny positive remains distinct from destruction',()=>{
 for(const [value,text] of [[0,'0'],[10,'10'],[64.25,'64.3'],[4.05,'4.1'],[99.999999999,'100'],[8.999999999,'9'],[0.004,'0.1']])assert.equal(formatDurability(value),text);
 assert.equal(formatDurabilityText('耐久9.999999999/10，房屋64.25；围栏 −1.26，受袭 · 1.26/秒'),'耐久10/10，房屋64.3；围栏 −1.3，受袭 · 1.3/秒');
});
