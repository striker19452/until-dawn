import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,applyCampaignAction} from '../src/campaign.js';
import {gardenStatus,gardenHarvestSummary} from '../client/garden.js';
import {facilityOutput} from '../src/rules.js';
import {weather} from '../src/content.js';

const campaign=()=>{const s=applyCampaignAction(initialCampaign(53),{type:'chooseRole',role:'repairman'});s.buildings=[{id:'garden',type:'garden',level:1,age:0,hp:10}];return s;};
test('garden display distinguishes growing, due and harvested and matches actual food credit',()=>{
 let s=campaign();assert.match(gardenStatus(s.buildings[0],s),/两次黄昏/);
 s=applyCampaignAction(s,{type:'prepare'});assert.equal(gardenHarvestSummary(s),'');assert.match(gardenStatus(s.buildings[0],s),/尚未成熟/);
 s=applyCampaignAction(s,{type:'backDay'});s.buildings[0].age=1;
 const amount=facilityOutput(s.buildings[0],weather(s.day,s.seed)),before=s.resources.food;
 assert.match(gardenStatus(s.buildings[0],s),new RegExp(`食物 \\+${amount}`));
 const ready=applyCampaignAction(s,{type:'prepare'});
 assert.equal(ready.resources.food-before,amount);assert.match(gardenHarvestSummary(ready),new RegExp(`食物 \\+${amount}`));assert.match(gardenStatus(ready.buildings[0],ready),/已收获/);
 assert.equal(gardenHarvestSummary(applyCampaignAction(ready,{type:'backDay'})),'');
});
test('saved harvest totals survive refresh and later damage; destroyed plots promise no output',()=>{
 const s=campaign();s.buildings[0].age=1;s.buildings.push({...s.buildings[0],id:'second',level:2,branch:'steady'});
 const ready=JSON.parse(JSON.stringify(applyCampaignAction(s,{type:'prepare'})));
 assert.match(gardenHarvestSummary(ready),/2块菜畦/);const summary=gardenHarvestSummary(ready);
 ready.phase='report';ready.buildings[0].hp=0;assert.equal(gardenHarvestSummary(ready),summary);assert.match(gardenStatus(ready.buildings[0],ready),/已损毁/);
});
