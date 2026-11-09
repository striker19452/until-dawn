import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestSession} from '../src/test-mode.js';
import {createBattle,battleCommand,stepBattle} from '../src/battle.js';
import {healthStatus} from '../client/crew-health.js';
import {tacticalOpportunities,tacticalActionState} from '../client/tactics.js';
import {COMBAT,BOSS_RULES,DAY_ACTIONS} from '../src/balance.js';

function fixture(day=8){
 const base=createTestSession({day}).snapshot.state,b=createBattle(base,'tactics',{autoPause:false});
 b.zones.forEach(z=>z.hp=100);b.schedule=[{at:9999,type:'walker',zone:'gate'}];b.challenge=null;
 return b;
}
const enemy=(type,extra={})=>({id:type,type,zone:'gate',x:240,y:475,hp:100,max:100,mode:'attack',stun:0,attack:0,progress:0,...extra});

test('health distinguishes low health, severe wounds, indoor rest and death without displaying zero while alive',()=>{
 const b=fixture(),p=b.people[0];p.health=.001;
 assert.equal(healthStatus(p,b).value,'0.1');assert.equal(healthStatus(p,b).tone,'critical');
 p.wound='severe';b.indoorPeople[p.id]=true;assert.equal(healthStatus(p,b).label,'重伤');
 p.wound='recovering';p.health=42;assert.equal(healthStatus(p,b).label,'屋内');
 p.dead=true;assert.equal(healthStatus(p,b).label,'已死亡');assert.equal(healthStatus(p,b).health,0);
});

test('opportunities react to live counter windows and disappear when controlled, compacted, occupied or over',()=>{
 const b=fixture();b.enemies=[enemy('rammer'),enemy('burrower'),enemy('caller')];b.zones[1].hp=0;
 const ids=()=>tacticalOpportunities(b).map(o=>o.id);
 assert.ok(ids().includes('gate-rammer'));assert.ok(ids().includes('gate-burrower'));assert.ok(ids().includes('gate-caller'));assert.ok(ids().includes('repair-left'));
 b.enemies[0].stun=1;b.zones[0].compacted=true;b.reinforcements=COMBAT.callLimit;
 assert.ok(!ids().includes('gate-rammer'));assert.ok(!ids().includes('gate-burrower'));assert.ok(!ids().includes('gate-caller'));
 b.enemies.push(enemy('walker',{zone:'left'}));assert.ok(!ids().includes('repair-left'));
 b.finished=true;assert.deepEqual(tacticalOpportunities(b),[]);
});

test('health opportunities target the affected person and never propose ordinary retreat to a severe casualty',()=>{
 const b=fixture(),p=b.people[1];Object.assign(p,{health:15,wound:'severe'});
 const rescue=tacticalOpportunities(b).find(o=>o.person===p.id);assert.equal(rescue.actions[0].type,'aid');
 assert.match(rescue.detail,new RegExp(String(DAY_ACTIONS.treatment.severeHealth)));
 p.wound='none';p.health=50;Object.assign(p,{x:240,y:475});b.enemies=[enemy('walker',{mode:'inside'})];
 b.people[0].x=100;b.people[0].y=400;
 const relief=tacticalOpportunities(b).find(o=>o.id==='relief-'+p.id);assert.equal(relief.person,p.id);assert.equal(relief.actions[0].type,'retreat');
 b.indoorPeople[p.id]=true;assert.ok(!tacticalOpportunities(b).some(o=>o.id==='relief-'+p.id));
});

test('counter availability uses authoritative reservations and rejection preserves the original battle',()=>{
 const b=fixture(),p=b.people[0],option={type:'throw',target:'gate'};b.resources.materials=0;
 const before=structuredClone(b);assert.equal(tacticalActionState(b,p,option).allowed,false);assert.deepEqual(b,before);
 b.resources.materials=1;b.zones[1].hp=30;battleCommand(b,{type:'repair',person:p.id,target:'left'});
 const reserved=structuredClone(b),actor=b.people[0];assert.equal(b.resources.materials,0);
 assert.equal(tacticalActionState(b,actor,option).allowed,true,'replacement can use the refunded reservation');assert.deepEqual(b,reserved);
 assert.equal(tacticalActionState(b,actor,{type:'repair',target:'left'}).reason,'已在执行这项任务');
});

test('boss mechanics expose actual alternative counters, and a queued counter creates the advertised weakness',()=>{
 const b=fixture(7),p=b.people[0];b.boss.phase='charge';b.boss.clock=2;
 const e=enemy('bastion',{id:'boss',boss:true});b.boss.entityIds=[e.id];b.enemies=[e];
 const opportunity=tacticalOpportunities(b).find(o=>o.id==='boss-charge');
 assert.deepEqual(opportunity.actions.map(a=>a.type),['heavy','brace']);assert.match(opportunity.detail,/3.0秒/);
 Object.assign(p,{x:240,y:456.25});b.people.slice(1).forEach(p=>p.nightRole='sleep');
 battleCommand(b,{type:'heavy',person:p.id,target:'gate',enemyId:e.id});b.paused=false;
 for(let i=0;i<50&&b.boss.phase==='charge';i++)stepBattle(b);
 assert.equal(b.boss.phase,'exposed');assert.ok(b.boss.clock<=BOSS_RULES.bastion.afterCounter);
 assert.ok(!tacticalOpportunities(b).some(o=>o.id==='boss-charge'));
});

test('lure options need ordinary intruders and a prepared defense, and never claim to attract a boss',()=>{
 const b=fixture();b.enemies=[enemy('walker',{mode:'inside'}),enemy('climber',{mode:'inside'})];
 assert.ok(!tacticalOpportunities(b).some(o=>o.id==='lure'));
 b.zones[2].traps=1;const plan=tacticalOpportunities(b).find(o=>o.id==='lure');assert.equal(plan.zone,'right');assert.equal(plan.actions[0].type,'bait');
 b.enemies[0].boss=true;assert.ok(!tacticalOpportunities(b).some(o=>o.id==='lure'));
});
