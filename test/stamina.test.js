import test from 'node:test';
import assert from 'node:assert/strict';
import {ROLES,COMPANIONS} from '../src/content.js';
import {maxStamina} from '../src/rules.js';
import {initialCampaign,applyCampaignAction,makePerson,settleNight,normalizeCampaignStamina} from '../src/campaign.js';
import {createBattle,battleCommand,stepBattle} from '../src/battle.js';
import {validateClientResult} from '../src/client-result.js';

const day=role=>applyCampaignAction(initialCampaign(53),{type:'chooseRole',role});
function roster(){const s=day('repairman');s.people.push(...COMPANIONS.map(c=>makePerson(c.id,c.name,c.role,c.skill)));return s;}
test('careers and companions start with their identity capacity, and a new morning restores it',()=>{
 for(const [role,expected]of Object.entries({repairman:110,medic:100,watchman:120})){const s=day(role);assert.equal(s.people[0].stamina,expected);assert.equal(maxStamina(s.people[0]),expected);assert.ok(ROLES[role].staminaNote);}
 const caps={lin:105,zhou:85,chen:115,xu:95,yuan:130,meng:100};
 for(const c of COMPANIONS){const s=day('repairman');s.day=c.day;const recruited=applyCampaignAction(s,{type:'recruit',person:c.id}),p=recruited.people[1];assert.equal(p.stamina,caps[c.id]);assert.equal(maxStamina({...p,maxStamina:999}),caps[c.id]);assert.equal('maxStamina' in p,false);}
 const s=roster();s.phase='report';for(const p of s.people)p.stamina=5;
 for(const p of applyCampaignAction(s,{type:'nextDay'}).people)assert.equal(p.stamina,maxStamina(p));
 assert.equal(maxStamina({id:'unknown',role:'unknown'}),100);
});

test('night restoration and regeneration respect every capacity; work above 100 is not truncated',()=>{
 const base=applyCampaignAction(roster(),{type:'prepare'}),b=createBattle(base,'stamina',{autoPause:false});b.schedule=[{at:9999,type:'walker',zone:'gate'}];b.challenge=null;b.paused=false;
 for(const p of b.people){assert.equal(p.stamina,maxStamina(p));p.stamina=maxStamina(p)-.01;}
 stepBattle(b);for(const p of b.people)assert.equal(p.stamina,maxStamina(p));
 battleCommand(b,{type:'brace',person:'yuan',target:'gate'});const courier=b.people.find(p=>p.id==='yuan');for(let i=0;i<300&&courier.task?.stage!=='work';i++)stepBattle(b);assert.equal(courier.task?.stage,'work');assert.ok(courier.stamina>129&&courier.stamina<130);
 for(let i=0;i<300&&courier.task;i++)stepBattle(b);assert.equal(courier.task,null);assert.ok(courier.stamina>100&&courier.stamina<maxStamina(courier));
 const result=settleNight(base,b);validateClientResult(base,result);for(const p of result.people)assert.equal(p.stamina,maxStamina(p));
});

test('save validation allows real capacities and old full-rest results without raising other status limits',()=>{
 const base=applyCampaignAction(roster(),{type:'prepare'}),result=settleNight(base,createBattle(base,'save-stamina'));validateClientResult(base,result);
 for(const id of ['hero','zhou','yuan'])for(const value of [-1,Infinity,NaN,maxStamina(result.people.find(p=>p.id===id))+1]){const bad=structuredClone(result),p=bad.people.find(p=>p.id===id);p.stamina=value;p.maxStamina=999;assert.throws(()=>validateClientResult(base,bad),/体力/);}
 const bad=structuredClone(result);bad.people[0].health=101;assert.throws(()=>validateClientResult(base,bad),/人物状态/);
 const legacy=structuredClone(result);for(const p of legacy.people)p.stamina=100;validateClientResult(base,legacy);normalizeCampaignStamina(legacy);for(const p of legacy.people)assert.equal(p.stamina,maxStamina(p));
});
