import test from 'node:test';
import assert from 'node:assert/strict';
import { initialCampaign,applyCampaignAction } from '../src/campaign.js';
import { createBattle,stepBattle,battleCommand,inner } from '../src/battle.js';
import { ENEMIES,ZONES } from '../src/content.js';
import { activeFeedback,enemyFeedback,combatCaption } from '../client/combat-feedback.js';

function fixture(){let s=applyCampaignAction(initialCampaign(53),{type:'chooseRole',role:'repairman'});s.day=28;s=applyCampaignAction(s,{type:'prepare'});const b=createBattle(s,'feedback',{autoPause:false});b.schedule=[{at:9999,type:'walker',zone:'gate'}];b.challenge=null;b.paused=false;b.fires=[];b.people[0].nightRole='sleep';b.people[0].x=240;b.people[0].y=350;return b;}
function enemy(type,zone='gate',extra={}){const z=ZONES.find(z=>z.id===zone);return {id:type,type,zone,x:z.x,y:z.y,hp:ENEMIES[type].hp,max:ENEMIES[type].hp,mode:'attack',attack:0,progress:0,stun:0,called:false,...extra};}

test('trap feedback reports the actual victim, damage, stun and remaining count including a stopped charge',()=>{
 const b=fixture(),z=b.zones[0];z.traps=2;b.enemies=[enemy('rammer','gate',{mode:'approach'})];
 stepBattle(b);const first=b.events.find(e=>e.type==='trap');assert.equal(first.damage,18);assert.equal(first.stun,2);assert.equal(first.remaining,1);assert.equal(first.enemyId,'rammer');
 b.enemies[0].stun=0;b.enemies[0].attack=8;stepBattle(b);const second=b.events.filter(e=>e.type==='trap').at(-1);
 assert.equal(second.remaining,0);assert.equal(second.stun,3);assert.equal(second.stopsCharge,true);assert.equal(z.hp,50);
 assert.equal(enemyFeedback(b,b.enemies[0]).restrained,true);assert.match(combatCaption(b,'gate').message,/陷阱 −18.*剩余0/);
});

test('spikes and mesh visibly report blocked abilities without changing their continuous damage rules',()=>{
 const b=fixture();b.zones[0].spikes=true;b.zones[1].mesh=true;b.enemies=[enemy('climber'),enemy('burrower','left')];
 stepBattle(b);assert.equal(b.enemies[0].hp,ENEMIES.climber.hp-.05*1.25);assert.equal(b.enemies[0].progress,0);assert.equal(b.enemies[1].progress,0);
 assert.ok(b.events.some(e=>e.type==='blocked'&&e.defense==='spikes'));assert.ok(b.events.some(e=>e.type==='blocked'&&e.defense==='mesh'));
 assert.equal(enemyFeedback(b,b.enemies[0]).label,'翻刺挡攀');assert.equal(enemyFeedback(b,b.enemies[1]).label,'埋网挡掘');
});

test('spray feedback connects source and target and distinguishes shelter mitigation',()=>{
 for(const shade of [false,true]){const b=fixture(),pos=inner(ZONES[0]);b.fires=[{id:'central',...pos,wood:1,heat:60,wet:0,shade}];b.enemies=[enemy('quencher','gate',{progress:8})];stepBattle(b);
  const wet=b.events.find(e=>e.type==='wet');assert.equal(wet.loss,shade?9:18);assert.equal(wet.wet,shade?4:8);assert.equal(wet.targetId,'central');assert.equal(wet.source.x,240);assert.equal(wet.protected,shade);
 }
});

test('reduced impact damage and charging progress match the simulation instead of decorative estimates',()=>{
 const b=fixture(),e=enemy('rammer','gate',{attack:2});b.enemies=[e];assert.equal(enemyFeedback(b,e).progress,.5);
 b.fires=[{id:'central',x:240,y:390,wood:1,heat:60,wet:0,shade:true}];e.attack=8;stepBattle(b);const hit=b.events.find(e=>e.type==='impact');
 assert.equal(hit.damage,12.75);assert.equal(hit.prevented,2.25);assert.equal(hit.fireProtected,true);assert.equal(b.zones[0].hp,37.25);
});

test('effect lifetime follows game time and remains frozen throughout a real simulation pause',()=>{
 const b=fixture();b.zones[0].traps=1;b.enemies=[enemy('walker','gate',{mode:'approach'})];stepBattle(b);
 battleCommand(b,{type:'pause'});const before=structuredClone(activeFeedback(b));for(let i=0;i<200;i++)stepBattle(b);assert.deepEqual(activeFeedback(b),before);
 battleCommand(b,{type:'resume'});for(let i=0;i<80;i++)stepBattle(b);assert.ok(!activeFeedback(b).some(e=>e.type==='trap'));
});
