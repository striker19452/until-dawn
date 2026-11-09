import assert from 'node:assert/strict';
import {dailyChallenge} from '../../src/challenges.js';
import { validateClientResult } from '../../src/client-result.js';
import { initialCampaign,applyCampaignAction,settleNight,candidates } from '../../src/campaign.js';
import { createBattle,stepBattle,battleCommand } from '../../src/battle.js';
import {nightProgress} from '../../src/night-progress.js';
import { ZONES, DEFENSES } from '../../src/content.js';
export function run(role,size,seed,{fire=true,policy='active',deepSearch=false,escortedSearch=false,rotate=false}={}){
 let s=applyCampaignAction(initialCampaign(seed),{type:'chooseRole',role});let failures=[],minHouse=100;const nights=[],searches=[],actions=[],daily=[];
 const act=(type,extra={})=>{try{
  const before=s,search=type==='search';
  const escort=search&&escortedSearch?s.people.find(p=>p.id!=='hero'&&!p.dead&&p.wound!=='severe'&&p.job==='rest'):null;
  const request={type,...(search?{deep:deepSearch,escort:escort?.id}:{}),...extra};s=applyCampaignAction(s,request);
  actions.push({day:s.day,type,request,apBefore:before.ap,apAfter:s.ap,resourcesBefore:before.resources,resourcesAfter:s.resources});
  if(search)searches.push({day:s.day,site:extra.site,deep:!!request.deep,escorted:!!request.escort,healthLost:before.people.reduce((n,p,i)=>n+p.health-s.people[i].health,0),loot:Object.fromEntries(Object.keys(s.resources).map(k=>[k,s.resources[k]-before.resources[k]]))});
  return true;
 }catch(error){actions.push({day:s.day,type,accepted:false,error:error.message});return false;}};
 if(!fire)act('toggleFire',{target:'central'});
 for(let d=1;d<=28;d++){
  if(d>1)assert.ok(act('nextDay'));
  const record={day:d,dawn:structuredClone(s)};daily.push(record);
  if(escortedSearch){const escort=s.people.find(p=>p.id!=='hero'&&!p.dead&&p.wound!=='severe');if(escort)act('assign',{person:escort.id,job:'rest'});}
  // Deep materials runs fund the new permanent prices; retain six materials for night emergencies.
  if(s.resources.materials<18)act('search',{site:'shed',deep:true});
  const preview=dailyChallenge(s);
  for(const wave of preview.waves){
   const feature=wave.type==='climber'?'spikes':['burrower','bladebeast'].includes(wave.type)?'mesh':null;
   const z=s.zones.find(z=>z.id===wave.zone);
   if(feature&&!z[feature]){if(s.resources.materials<DEFENSES[feature].cost.materials+4)act('search',{site:'shed',deep:true});act('defense',{zone:z.id,feature});}
  }
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
  const crew=s.people.filter(p=>!p.dead),fronts=[...new Set(preview.waves.map(w=>w.zone))];
  const zones=[...fronts,...ZONES.map(z=>z.id).filter(id=>!fronts.includes(id))];
  for(const [i,p]of crew.entries()){
   const resting=rotate&&crew.length>=3&&p.fatigue>=60&&i>=fronts.length;
   if(p.id!=='hero')act('assign',{person:p.id,job:p.fatigue>=40?'rest':i%2?'farm':'water'});
   act('nightRole',{person:p.id,role:p.wound==='severe'||resting?'sleep':'guard',zone:zones[i%5]});
  }
  while(s.phase==='day'&&s.ap>=1){const weak=[...s.zones].sort((a,b)=>a.hp-b.hp)[0];if(s.ap>=2&&s.people[0].fatigue>60)act('rest',{person:'hero'});else if(weak.hp<90&&s.resources.materials>=2)act('repair',{zone:weak.id});else if(s.ap>=2&&s.people[0].fatigue>30)act('rest',{person:'hero'});else break;}
  if(s.phase==='failed'){failures.push(`D${d} daytime death`);break;}
  // Keep the pressure audit running through untreated wounds instead of stopping at its confirmation screen.
  if(!act('prepare',{acceptDanger:true})){failures.push(`D${d} prepare`);break;}

  record.prepared=structuredClone(s);
  let interventions=0,throws=0,repairs=0;
  const issue=(p,type,target)=>{try{battleCommand(b,{type,person:p.id,target});interventions++;if(type==='throw')throws++;if(['repair','barricade'].includes(type))repairs++;return true;}catch{return false;}};const b=createBattle(s,`${role}-${size}-${seed}-${d}`,{autoPause:false});b.paused=false;
  for(let i=0;i<9000&&!b.finished;i++){
  if(i%10===0){
   for(const id of s.people.map(p=>p.id)){
    const p=b.people.find(p=>p.id===id);if(p.dead||p.nightRole==='sleep'||p.wound==='severe'||p.task&&p.task.type!=='guard')continue;
    const bs=b.boss,live=b.enemies.filter(e=>e.hp>0&&e.mode!=='retreat');
    const local=live.filter(e=>e.zone===p.zone||Math.hypot(e.x-p.x,e.y-p.y)<90);
    // Ordinary hits only pause windup now; digging and climbing also need an
    // actual throw when preparation has not blocked their special action.
    const mechanism=local.find(e=>e.mode==='attack'&&e.stun<=0&&(e.type==='shellcrab'&&!(e.shellExposedUntil>b.elapsed)||e.type==='caller'&&!e.called&&e.progress>.1||b.challenge.goal==='exclude'&&['burrower','climber'].includes(e.type)&&e.progress>.1||e.type==='quencher'&&e.progress>.1||e.type==='sporetoad'&&e.progress>1||e.type==='bladebeast'&&e.progress>1||e.type==='rammer'&&e.attack>1.8));
    if(bs&&!bs.defeated&&bs.phase==='charge'&&p.zone===bs.zone&&bs.clock>2&&p.stamina>=30&&(b.braceCooldowns[p.id]||0)<=0){issue(p,'brace',bs.zone);continue;}
    if(bs&&!bs.defeated&&bs.mounds.length){const mound=bs.mounds.find(m=>!b.zones.find(z=>z.id===m.zone).compacted&&!b.people.some(q=>q.task?.target===m.zone&&['compact','throw'].includes(q.task.type)));if(mound&&p.zone===mound.zone){issue(p,'compact',mound.zone);continue;}}
    if(bs&&!bs.defeated&&bs.phase==='siphon'&&bs.clock>1&&p.zone===bs.zone&&throws<12&&!b.people.some(q=>q.task?.type==='throw'&&q.task.target===bs.zone)){issue(p,'throw',bs.zone);continue;}
    if(mechanism&&throws<12&&!b.people.some(q=>q.task?.type==='throw'&&q.task.target===mechanism.zone)){issue(p,'throw',mechanism.zone);continue;}
    if(p.task)continue;
    const own=b.zones.find(z=>z.id===p.zone);
    if(own.hp>0&&own.hp<85&&repairs<10&&!b.people.some(q=>q.task?.type==='repair'&&q.task.target===own.id)&&(local.every(e=>e.mode==='approach'||e.stun>0)||b.people.some(q=>q.id!==p.id&&!q.dead&&!q.task&&Math.hypot(q.x-p.x,q.y-p.y)<100))){issue(p,'repair',own.id);continue;}
    if(b.house<90&&repairs<10&&live.every(e=>e.zone!==p.zone)){issue(p,'barricade','house');continue;}
    // Cover the nearest unstaffed live front, with priorities for a summoner or
    // an intruder. Never rewrite health, positions, cooldowns or encounter clocks.
    const target=live.filter(e=>e.mode!=='approach'&&!b.people.some(q=>q.id!==id&&!q.dead&&q.wound!=='severe'&&(q.task?.target===e.zone||!q.task&&q.zone===e.zone)))
     .sort((a,c)=>((a.mode==='inside'?-500:0)+(a.type==='caller'?-200:0)+Math.hypot(a.x-p.x,a.y-p.y))-((c.mode==='inside'?-500:0)+(c.type==='caller'?-200:0)+Math.hypot(c.x-p.x,c.y-p.y)))[0];
    if(target&&!local.some(e=>e.mode!=='approach'))issue(p,'guard',target.zone);
   }
  }
   stepBattle(b);
  }
  assert.ok(b.finished,'night simulation converges '+JSON.stringify({role,size,seed,day:d,elapsed:b.elapsed,house:b.house,people:b.people.map(p=>({id:p.id,health:p.health,wound:p.wound,fear:p.fear,fatigue:p.fatigue,task:p.task})),enemies:b.enemies,schedule:b.schedule}));const base=s;s=settleNight(s,b);validateClientResult(base,s);minHouse=Math.min(minHouse,s.house);nights.push({day:d,elapsed:s.report.elapsed,remaining:nightProgress(b).remaining,pending:b.schedule.length,boss:s.report.boss||null,challenge:b.challenge.title,cleared:b.challenge.status==='cleared',house:Math.round(s.house),heroDead:s.people.find(p=>p.id==='hero').dead,breaches:b.breaches,interventions,food:s.resources.food,water:s.resources.water,materials:s.resources.materials,fuel:s.resources.fuel,heroHealth:Math.round(s.people[0].health),fatigue:Math.round(s.people[0].fatigue),crewFatigue:s.people.filter(p=>!p.dead&&p.id!=='hero').map(p=>p.fatigue),sleepers:s.people.filter(p=>!p.dead&&p.nightRole==='sleep').length,reinforcements:b.reinforcements,feedback:b.challenge.feedback});
  record.settled=structuredClone(s);record.night={elapsed:b.elapsed,work:b.work,resources:b.resources,people:b.people,zones:b.zones,report:s.report};
  if(s.phase==='failed'){failures.push(`D${d} house=${Math.round(s.house)} food=${s.resources.food} mats=${s.resources.materials} hero=${s.people[0].health}/${s.people[0].wound} actions=${interventions}`);break;}
 }
 return {s,failures,minHouse,nights,searches,actions,daily};
}
