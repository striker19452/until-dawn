import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,applyCampaignAction as act} from '../src/campaign.js';
import {dailyConsumption,needs} from '../src/rules.js';
import {rationsPanel,rationState} from '../client/rations.js';
const start=()=>act(initialCampaign(314),{type:'chooseRole',role:'repairman'});
test('daytime fatigue follows AP cost for search, construction and every kind of repair, caps at 100',()=>{
 for(const [action,ap]of [[{type:'search',site:'shed'},2],[{type:'search',site:'shed',deep:true},3],[{type:'build',building:'garden'},2],[{type:'repair',zone:'gate'},1],[{type:'houseRepair'},1],[{type:'repairBuilding',id:'g'},1],[{type:'rebuildBuilding',id:'r',building:'garden'},2]]){
  const s=start();s.house=70;s.buildings=[{id:'g',type:'garden',plot:0,level:1,hp:5},{id:'r',type:'water',plot:1,level:1,hp:0}];s.resources.materials=100;
  const after=act(s,action);assert.equal(after.people[0].fatigue,ap*5,action.type);assert.equal(after.ap,s.ap-ap);assert.equal(s.people[0].fatigue,0);
  s.people[0].fatigue=98;assert.equal(act(s,action).people[0].fatigue,100);
 }
});
test('rest fully reduces fatigue; free changes, failed actions and preparation do not add hero fatigue',()=>{
 let s=start();s.people[0].fatigue=50;
 assert.equal(act(s,{type:'rest'}).people[0].fatigue,22);
 s=act(s,{type:'recruit',person:'lin'});assert.equal(s.people[0].fatigue,50);
 s=act(s,{type:'rest',person:'lin'});assert.equal(s.people[0].fatigue,50);
 const before=structuredClone(s);assert.throws(()=>act(s,{type:'build',building:'missing'}));assert.deepEqual(s,before);
 s=act(s,{type:'nightRole',person:'hero',role:'sleep'});assert.equal(s.people[0].fatigue,50);
 const ready=act(s,{type:'prepare'}),back=act(ready,{type:'backDay'});assert.equal(ready.people[0].fatigue,50);assert.equal(back.people[0].fatigue,50);
});
test('escorted deep search independently charges hero AP fatigue and companion outing fatigue',()=>{
 let s=act(start(),{type:'recruit',person:'lin'});s=act(s,{type:'search',site:'shed',deep:true,escort:'lin'});
 assert.equal(s.people[0].fatigue,15);assert.equal(s.people[1].fatigue,10);
 const ready=act(s,{type:'prepare'});assert.equal(ready.people[0].fatigue,15);assert.equal(ready.people[1].fatigue,10);
});
test('daily consumption breakdown matches actual demand including stove, cooking, heat, deaths and ruins',()=>{
 const s=start();s.day=13;s.people=Array.from({length:5},(_,i)=>({...s.people[0],id:i===4?'meng':String(i),job:i===4?'cook':'rest'}));s.weather='hot';
 s.buildings=[{id:'stove',type:'stove',branch:'yield',level:2,hp:10}];
 const d=dailyConsumption(s);assert.deepEqual({...d,personMeals:undefined},{people:5,workExtra:1,nightExtra:5,personMeals:undefined,stoveSaving:2,cookingSaving:5,hotExtra:2,dogFood:0,food:4,water:7});assert.deepEqual(d.personMeals.map(p=>p.food),[2,2,2,2,3]);assert.deepEqual(needs(s),{food:4,water:7});
 assert.match(rationsPanel(s,null,'food'),/孟姐掌灶节省（每人1）<\/dt><dd>−5食物/);
 s.phase='ready';s.dayProduced=true;s.people[4].workedDay=s.day;s.flags.cookedDay=s.day;s.buildings[0].hp=0;assert.equal(needs(s).food,6);s.people[0].dead=true;assert.equal(needs(s).food,5);assert.equal(needs(s).water,6);
 s.flags.cookedDay=12;assert.equal(needs(s).food,9);s.buildings[0].hp=10;s.people.forEach((p,i)=>p.dead=i!==4);s.flags.cookedDay=13;assert.equal(needs(s).food,1);
});
test('resource panel uses live battle people, facilities and weather without changing saved state',()=>{
 const s=start(),before=structuredClone(s),b={people:s.people,buildings:[],weather:'hot',flags:{},resources:{...s.resources,water:3},day:s.day};
 assert.equal(dailyConsumption(rationState(s,b)).water,2);assert.match(rationsPanel(s,b,'water'),/净水每日消耗 2/);assert.match(rationsPanel(s,b,'water'),/现有3净水/);assert.deepEqual(s,before);
 assert.match(rationsPanel(initialCampaign(1),null,'food'),/选择角色后/);
});
