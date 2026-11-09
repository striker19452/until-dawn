import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestSession} from '../src/test-mode.js';
import {createBattle,battleCommand} from '../src/battle.js';
import {quickOrders} from '../client/quick-orders.js';
const fixture=()=>{const b=createBattle(createTestSession({day:17}).snapshot.state,'quick');return {b,p:b.people[0]};};
test('quick orders expose interruption first and collapse fire care to the action the fire needs',()=>{
 const {b,p}=fixture(),fire=b.fires[0];
 assert.deepEqual(quickOrders(b,p,'left').primary.slice(0,3).map(o=>[o.type,o.target]),[['heavy','left'],['guard','left'],['repair','left']]);
 for(const [patch,type] of [[{heat:60,wood:1,wet:3},'clearWet'],[{heat:0,wood:1,wet:0},'fire'],[{heat:60,wood:0,wet:0},'addWood'],[{heat:20,wood:1,wet:0},'stoke']]){Object.assign(fire,patch);const action=quickOrders(b,p,'left').primary[3];assert.equal(action.type,type);assert.equal(action.target,'central');}
});
test('quick orders show real costs, cannot repeat a charged strike, and cancellation does not spend resources or stamina',()=>{
 const {b,p}=fixture();b.enemies=[{id:'target',type:'caller',zone:'right',hp:100,mode:'attack',x:400,y:330}];const before=structuredClone(b),action=quickOrders(b,p,'right').primary[0];assert.equal(action.allowed,true);assert.deepEqual(b,before);
 b.enemies=[{id:'target',type:'caller',zone:'right',hp:100,mode:'attack',x:400,y:330}];const materials=b.resources.materials;battleCommand(b,{type:action.type,person:p.id,target:action.target});const actor=b.people[0];assert.equal(b.resources.materials,materials);assert.equal(quickOrders(b,actor,'right').primary[0].allowed,false);
 assert.ok(quickOrders(b,actor,'right').contextual.some(o=>o.type==='cancel'));battleCommand(b,{type:'cancel',person:actor.id});assert.equal(b.resources.materials,materials);assert.equal(actor.zone,p.zone);
});
test('context commands follow the selected front and validate injury and resources',()=>{
 const {b,p}=fixture();b.enemies=[{id:'rammer',type:'rammer',hp:100,zone:'left',mode:'attack'}];
 assert.ok(quickOrders(b,p,'left').contextual.some(o=>o.type==='brace'));assert.ok(!quickOrders(b,p,'right').contextual.some(o=>o.type==='brace'));
 b.enemies[0].type='burrower';assert.ok(quickOrders(b,p,'left').contextual.some(o=>o.type==='compact'));
 b.resources.materials=0;assert.equal(quickOrders(b,p,'left').primary[0].allowed,true);p.stamina=0;assert.equal(quickOrders(b,p,'left').primary[0].allowed,false);
 p.wound='severe';const quick=quickOrders(b,p,'left');assert.ok(quick.contextual.some(o=>o.type==='aid'));assert.equal(quick.primary[0].allowed,false);
});
