import test from 'node:test';import assert from 'node:assert/strict';
import {initialCampaign,applyCampaignAction as act,settleNight,makePerson} from '../src/campaign.js';
import {createBattle,stepBattle,battleCommand} from '../src/battle.js';
import {fearSituation,FEAR_GAIN} from '../src/fear.js';
import {ENEMY_MELEE_RANGE,canEnemyHitPerson} from '../src/rules.js';
import {enterHouse} from '../src/shelter.js';
import {bestiaryEntries} from '../src/bestiary.js';
import {validateClientResult} from '../src/client-result.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function fixture(range=42,{warm=false,type='walker',brood=false}={}){const s=act(initialCampaign(53),{type:'chooseRole',role:'watchman'});s.flags.centralFire=false;s.people[0].zone='right';const base=act(s,{type:'prepare'}),b=createBattle(base,'melee-range',{autoPause:false});b.schedule=[{at:9999,type:'walker',zone:'gate'}];b.challenge=null;b.paused=false;b.fires=warm?[{id:'central',x:240,y:390,wood:1,heat:60,wet:0,enabled:true}]:[];Object.assign(b.people[0],{x:380-range,y:410,fear:0,cooldown:100});const e={id:'attacker',type,zone:'right',x:380,y:410,hp:1000,max:1000,mode:'inside',attack:0,progress:0,stun:0,bossBrood:brood,targetId:'house',targetPoint:{x:380,y:410}};b.enemies=[e];return {base,b,e};}
const run=(b,n)=>{for(let i=0;i<n;i++)stepBattle(b,.05);};

test('automatic patrol and manual drive keep their visual gap but take real damage and fear for the whole exchange',()=>{
 for(const manual of [false,true]){const {b}=fixture();if(manual)battleCommand(b,{type:'guard',person:'hero',target:'right'});run(b,20);const p=b.people[0];close(distance(p,b.enemies[0]),42);close(p.health,98.8);close(p.fear,FEAR_GAIN.contact);assert.equal(fearSituation(b,p).underAttack,true);run(b,20);close(p.health,97.6);}
});

test('enemy melee includes 50, stops immediately beyond 50, and uses the same boundary for under-attack fear',()=>{
 assert.equal(ENEMY_MELEE_RANGE,50);
 for(const range of [27,36,42,46,50,50.0001,60]){const {b,e}=fixture(range);battleCommand(b,{type:'move',person:'hero',target:{x:b.people[0].x,y:410}});const p=b.people[0];p.task.stage='work';assert.equal(fearSituation(b,p).underAttack,range<=50);stepBattle(b,.1);close(p.health,range<=50?99.88:100);close(p.fear,range<=50?.1:0);assert.equal(canEnemyHitPerson(b,b.enemies[0],p),range<=50);}
});

test('species-specific person damage and fire reduction apply at 42 distance',()=>{
 for(const [type,rate] of Object.entries({walker:1.2,climber:1.6,rammer:3,caller:.6,burrower:1.8,quencher:.9,skitter:.6,broodmother:1.2}))for(const warm of [false,true]){const brood=type==='broodmother',{b}=fixture(42,{type,warm,brood});stepBattle(b,.1);const factor=warm?(type==='rammer'?.85:.7):1;close(b.people[0].health,100-.1*rate*factor);close(b.people[0].fear,.1-(warm?.004:0));}
});

test('complete fences, real indoor refuge, stuns, dormant creatures and dead people do not gain remote damage',()=>{
 for(const state of ['fence','indoors','stun','dormant','dead']){const {b,e}=fixture();const p=b.people[0];if(state==='fence')e.mode='attack';if(state==='indoors'){enterHouse(b,p);Object.assign(e,{x:p.x+42,y:p.y,targetPoint:{x:p.x+42,y:p.y}});}if(state==='stun')e.stun=2;if(state==='dormant'){e.hp=0;e.bossDormant=true;}if(state==='dead'){p.dead=true;p.health=0;}const hp=p.health;assert.equal(fearSituation(b,p).underAttack,false);stepBattle(b,.1);assert.equal(p.health,hp,state);}
});

test('fear over 90 reacts to a real strike across the normal gap and starts the existing refuge behavior',()=>{
 const {b}=fixture();b.people[0].fear=95;stepBattle(b,.1);assert.ok(b.people[0].health<100);assert.equal(b.fearRetreats.hero?.stage,'travel');assert.ok(distance(b.people[0],b.enemies[0])>35);
});

test('multiple attacks at normal distance stack, can cause severe wounds and death, and save exactly that result',()=>{
 const {base,b,e}=fixture();const p=b.people[0];p.health=.1;b.enemies.push({...e,id:'second'});stepBattle(b,.05);assert.equal(p.dead,true);assert.equal(p.health,0);assert.equal(p.deathCause,'attack');assert.equal(b.finished,true);const result=settleNight(base,b);validateClientResult(base,result);assert.equal(result.phase,'failed');assert.deepEqual(result.report.deaths,['你']);
 const severe=fixture().b;severe.people[0].health=20.01;stepBattle(severe,.1);assert.equal(severe.people[0].wound,'severe');assert.ok(severe.people[0].health<20);
});

test('bestiary exposes the same attack range without revealing undiscovered species',()=>{
 const {base}=fixture();assert.equal(bestiaryEntries(base).some(e=>e.known),false);base.flags.seenTypes=['walker'];const e=bestiaryEntries(base).find(e=>e.id==='walker');assert.equal(e.personRange,50);assert.equal(e.personDamage,1.2);assert.equal(e.firePersonDamage,.84);
});
