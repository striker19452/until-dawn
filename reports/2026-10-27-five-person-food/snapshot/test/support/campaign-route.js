import assert from 'node:assert/strict';
import { validateClientResult } from '../../src/client-result.js';
import { initialCampaign,applyCampaignAction,settleNight,candidates } from '../../src/campaign.js';
import { createBattle,stepBattle,battleCommand } from '../../src/battle.js';
import {nightProgress} from '../../src/night-progress.js';
import { ZONES, DEFENSES } from '../../src/content.js';
export function run(role,size,seed,{fire=true,policy='active',deepSearch=false,escortedSearch=false,rotate=false,onNight=null,onAction=null,onReject=null}={}){
 let s=applyCampaignAction(initialCampaign(seed),{type:'chooseRole',role});let failures=[],minHouse=100;const nights=[],searches=[];
 const act=(type,extra={})=>{try{
  const before=s,search=type==='search';
  const escort=search&&escortedSearch?s.people.find(p=>p.id!=='hero'&&!p.dead&&p.wound!=='severe'&&p.job==='rest'):null;
  const request={type,...(search?{deep:deepSearch,escort:escort?.id}:{}),...extra};const flows=[];s=applyCampaignAction(s,request,{onResourceFlow:f=>flows.push(f)});onAction?.({before,after:s,request,flows});
  if(search)searches.push({day:s.day,site:extra.site,deep:!!request.deep,escorted:!!request.escort,healthLost:before.people.reduce((n,p,i)=>n+p.health-s.people[i].health,0),loot:Object.fromEntries(Object.keys(s.resources).map(k=>[k,s.resources[k]-before.resources[k]]))});
  return true;
 }catch(error){onReject?.({day:s.day,type,extra,message:error.message});return false;}};
 if(!fire)act('toggleFire',{target:'central'});
 for(let d=1;d<=28;d++){
  if(d>1)assert.ok(act('nextDay'));
  if(escortedSearch){const escort=s.people.find(p=>p.id!=='hero'&&!p.dead&&p.wound!=='severe');if(escort)act('assign',{person:escort.id,job:'rest'});}
  // Deep materials runs fund the new permanent prices; retain six materials for night emergencies.
  if(s.resources.materials<18)act('search',{site:'shed',deep:true});
  if(d>=15){if(!s.flags.route)act('route',{route:'road'});if(s.flags.routeWork<2)act('search',{site:'rescue'});if(!s.flags.routeDelivered)act('search',{site:'contact'});}
  if((s.day>=20||s.people.some(p=>!p.dead&&p.wound==='severe'))&&s.resources.medicine<2)act('search',{site:'clinic'});
  while(s.phase==='day'&&s.house<85&&s.ap>=1&&s.resources.materials>=2)act('houseRepair');
  if(s.people.filter(p=>!p.dead).length<size){const c=candidates(s)[0];if(c){if(s.beds<=s.people.filter(p=>!p.dead).length)act('beds');act('recruit',{person:c.id});}}
  const gardenCount=s.buildings.filter(b=>b.type==='garden').length,waterCount=s.buildings.filter(b=>b.type==='water').length;
  if(!gardenCount||size>=3&&gardenCount<2)act('build',{building:'garden'});
  if(!waterCount)act('build',{building:'water'});
  // A steady stove supplies daily recovery for the hero's daytime workload.
  if(s.people[0].fatigue>=60&&!s.buildings.some(b=>b.type==='stove'))act('build',{building:'stove'});
  const stove=s.buildings.find(b=>b.type==='stove');if(stove?.level===1)act('upgradeBuilding',{id:stove.id,branch:'steady'});
  if(s.resources.food<size+2)act('search',{site:'alley'});
  if(s.resources.water<size+1)act('search',{site:d>=7?'pump':'alley'});
  // Campfire burns stored building materials; fuel is reserved for facilities.
  if(s.house<80)act('houseRepair');
  if(d>=8&&!s.buildings.some(b=>b.type==='exchange'))act('build',{building:'exchange'});
  while(s.buildings.some(b=>b.type==='exchange')&&s.resources.food>size+5&&s.resources.materials<18){if(!act('trade',{offer:'materials'}))break;}
  const injured=s.people.find(p=>!p.dead&&p.wound==='severe')||s.people.find(p=>p.id==='hero'&&p.health<60);if(injured)act('treat',{person:injured.id});
  for(const z of [...s.zones].sort((a,b)=>a.hp-b.hp)){if(z.hp<60)act('repair',{zone:z.id});}
  const unspiked=s.zones.find(z=>!z.spikes);if(unspiked&&s.resources.materials>=DEFENSES.spikes.cost.materials+6)act('defense',{zone:unspiked.id,feature:'spikes'});
  if(d>=16){const unmeshed=s.zones.find(z=>!z.mesh);if(unmeshed&&s.resources.materials>=DEFENSES.mesh.cost.materials+6)act('defense',{zone:unmeshed.id,feature:'mesh'});}
  if(d>=4&&!s.flags.registeredDay)act('search',{site:'contact'});
  for(const [i,p]of s.people.filter(p=>!p.dead).entries()){
   const resting=rotate&&p.id!=='hero'&&p.fatigue>=25;
   if(p.id!=='hero'){const jobs=['farm','water','forage','craft'];act('assign',{person:p.id,job:resting?'rest':jobs[(i-1)%4]});}
   act('nightRole',{person:p.id,role:p.wound==='severe'||resting?'sleep':i===1?'support':'guard',zone:ZONES[i%5].id});
  }
  while(s.phase==='day'&&s.ap>=1){const weak=[...s.zones].sort((a,b)=>a.hp-b.hp)[0];if(s.ap>=2&&s.people[0].fatigue>60)act('rest',{person:'hero'});else if(weak.hp<90&&s.resources.materials>=2)act('repair',{zone:weak.id});else if(s.ap>=2&&s.people[0].fatigue>30)act('rest',{person:'hero'});else break;}
  if(s.phase==='failed'){failures.push(`D${d} daytime death`);break;}
  // Keep the pressure audit running through untreated wounds instead of stopping at its confirmation screen.
  if(!act('prepare',{acceptDanger:true})){failures.push(`D${d} prepare`);break;}
  
  let interventions=0;const b=createBattle(s,`${role}-${size}-${seed}-${d}`,{autoPause:false});b.paused=false;
  for(let i=0;i<9000&&!b.finished;i++){
   if(policy!=='idle'&&i%40===0){const hero=b.people[0],threat=b.enemies.filter(e=>e.hp>0).sort((a,c)=>(a.mode==='inside'?-500:0)+Math.hypot(a.x-hero.x,a.y-hero.y)-((c.mode==='inside'?-500:0)+Math.hypot(c.x-hero.x,c.y-hero.y)))[0];if(!hero.task&&hero.wound==='severe'&&b.resources.medicine>=2){try{battleCommand(b,{type:'aid',person:'hero'});}catch{}}if(!hero.task&&interventions<(b.day>=21?12:b.day>=9?8:4)){const own=b.zones.find(z=>z.id===hero.zone);if(b.fires[0]?.heat<25&&b.fires[0].wood>0){try{battleCommand(b,{type:b.fires[0].heat<=0?'fire':'addWood',person:'hero',target:'central'});interventions++;}catch{}}else if(b.house<65&&b.resources.materials>0){try{battleCommand(b,{type:'barricade',person:'hero',target:'house'});interventions++;}catch{}}else if(own.hp>0&&own.hp<35&&b.resources.materials>0){try{battleCommand(b,{type:'repair',person:'hero',target:own.id});interventions++;}catch{}}else if(threat&&((threat.type==='rammer'&&threat.attack>3)||(['caller','climber','burrower'].includes(threat.type)&&threat.progress>3)||b.enemies.filter(e=>e.zone===threat.zone&&e.hp>0).length>=2)&&b.resources.materials>0){try{battleCommand(b,{type:'throw',person:'hero',target:threat.zone});interventions++;}catch{}}}if(threat&&b.people[0].zone!==threat.zone&&!b.people[0].task){try{battleCommand(b,{type:'guard',person:'hero',target:threat.zone});}catch{}}}
   stepBattle(b);
  }
  assert.ok(b.finished,'night simulation converges '+JSON.stringify({role,size,seed,day:d,elapsed:b.elapsed,house:b.house,people:b.people.map(p=>({id:p.id,health:p.health,wound:p.wound,fear:p.fear,fatigue:p.fatigue,task:p.task})),enemies:b.enemies,schedule:b.schedule}));const base=s;s=settleNight(s,b);validateClientResult(base,s);minHouse=Math.min(minHouse,s.house);nights.push({day:d,elapsed:s.report.elapsed,remaining:nightProgress(b).remaining,pending:b.schedule.length,boss:s.report.boss||null,challenge:b.challenge.title,cleared:b.challenge.status==='cleared',house:Math.round(s.house),heroDead:s.people.find(p=>p.id==='hero').dead,breaches:b.breaches,interventions,food:s.resources.food,water:s.resources.water,materials:s.resources.materials,fuel:s.resources.fuel,heroHealth:Math.round(s.people[0].health),fatigue:Math.round(s.people[0].fatigue),crewFatigue:s.people.filter(p=>!p.dead&&p.id!=='hero').map(p=>p.fatigue),sleepers:s.people.filter(p=>!p.dead&&p.nightRole==='sleep').length,reinforcements:b.reinforcements,feedback:b.challenge.feedback});
  onNight?.({state:s,battle:b});
  if(s.phase==='failed'){failures.push(`D${d} house=${Math.round(s.house)} food=${s.resources.food} mats=${s.resources.materials} hero=${s.people[0].health}/${s.people[0].wound} actions=${interventions}`);break;}
 }
 return {s,failures,minHouse,nights,searches};
}
