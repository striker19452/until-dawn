import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,applyCampaignAction as act,makePerson,settleNight} from '../src/campaign.js';
import {createBattle,battleCommand,stepBattle,inner} from '../src/battle.js';
import {PRODUCTION,WORK,DAY_ACTIONS,RATIONS,COMBAT,NIGHT_ACTIONS,BOSS_RULES,CHALLENGE_REWARD} from '../src/balance.js';
import {BUILDINGS,SITES,ZONES,weather} from '../src/content.js';
import {facilityOutput,UPGRADE_TEXT,dailyConsumption} from '../src/rules.js';
import {recipeDescription,defenseDescription} from '../src/descriptions.js';
import {workDescriptions,campfireDetails} from '../client/rule-help.js';
import {nightActionInfo} from '../client/action-help.js';
import {rationsPanel} from '../client/rations.js';
import {skillInfo} from '../client/skills.js';
import {bestiaryEntries} from '../src/bestiary.js';
import {BOSS_SPECIES} from '../src/boss-content.js';
import {validateClientResult} from '../src/client-result.js';
import {bossDamage} from '../src/bosses.js';
import {warningDistance} from '../src/cooperation.js';
import {SEARCH_RULES,searchPlan,searchRiskDescription} from '../src/search.js';
import {dailyChallenge} from '../src/challenges.js';
import {CAMPFIRE_HEAT,tendedHeat} from '../src/campfire.js';

// These deliberately alter the rules, then run real actions. A copied literal
// in either the help or simulation must fail even if today's defaults match.
function changed(target,patch,run){const original={...target};Object.assign(target,patch);try{return run();}finally{for(const key of Object.keys(target))delete target[key];Object.assign(target,original);}}
function day(seed=53){const s=act(initialCampaign(seed),{type:'chooseRole',role:'repairman'});for(const key in s.resources)s.resources[key]=100;s.flags.centralFire=false;return s;}
const advance=(b,seconds)=>{for(let i=0;i<Math.ceil(seconds*20);i++)stepBattle(b);};

test('edited water outputs and garden cycles update actual receipts, base descriptions and both upgrade previews',()=>{
 changed(PRODUCTION.water,{base:7,perLevel:2,yieldBonus:3,rainBonus:4,hotBonus:-2,steady:11},()=>{
  for(const w of ['clear','rain','hot'])for(const branch of ['normal','yield','steady']){
   const seed=Array.from({length:100},(_,i)=>i+1).find(n=>weather(1,n)===w),s=day(seed);
   const building={id:'water',type:'water',hp:10,level:branch==='normal'?1:2,branch};s.buildings=[building];
   const expected=branch==='steady'?11:7+(building.level-1)*2+(branch==='yield'?3:0)+(w==='rain'?4:w==='hot'?-2:0);
   assert.equal(facilityOutput(building,w),expected);
   assert.equal(act(s,{type:'prepare'}).resources.water-s.resources.water,expected);
  }
  assert.match(BUILDINGS.water.desc,/每天产7净水，雨天11、晴热5/);
  assert.match(UPGRADE_TEXT.water.yield,/12净水，雨天16、晴热10/);
  assert.match(UPGRADE_TEXT.water.steady,/固定11净水/);
 });
 changed(PRODUCTION.garden,{cycle:3,base:9},()=>{
  const s=day();s.buildings=[{id:'garden',type:'garden',hp:10,level:1,branch:'normal',age:1}];
  assert.match(BUILDINGS.garden.desc,/每3次黄昏/);assert.match(UPGRADE_TEXT.garden.yield,/每3日/);
  assert.equal(act(s,{type:'prepare'}).resources.food,s.resources.food);
  s.buildings[0].age=2;assert.ok(act(s,{type:'prepare'}).resources.food>s.resources.food);
 });
});

test('edited fuel recipe changes action price, credited output and generated button text together',()=>{
 changed(DAY_ACTIONS.fuel,{ap:3,cost:{materials:4,water:2},gain:{fuel:9}},()=>{
  const s=day(),after=act(s,{type:'craft',item:'fuel'});
  assert.equal(s.ap-after.ap,3);assert.equal(s.resources.materials-after.resources.materials,4);assert.equal(s.resources.water-after.resources.water,2);assert.equal(after.resources.fuel-s.resources.fuel,9);
  assert.equal(recipeDescription('fuel'),'3行动 · 4建材、2净水 → 9燃料');
 });
});

test('edited companion production is shared by dusk work, work help and skill explanations',()=>{
 changed(WORK,{water:8,forage:6,careHealth:13},()=>{
  for(const [job,resource,output]of [['water','water',8],['forage','fuel',6]]){
   let s=day();s.people.push(makePerson('lin','林禾','园艺师','survival'));s=act(s,{type:'assign',person:'lin',job});
   const after=act(s,{type:'prepare'});assert.equal(after.resources[resource]-s.resources[resource],output);
   assert.ok(workDescriptions(s,s.people[1])[job].includes(`+${output}`));
   assert.ok(skillInfo(s.people[1],'survival').note.includes(`${job==='water'?'取水':'搜集燃料'}固定+${output}`));
  }
  let s=day();s.people.push(makePerson('xu','许宁','社区护士','medical'));s.people.forEach(p=>p.health=50);s=act(s,{type:'assign',person:'xu',job:'care'});
  assert.ok(act(s,{type:'prepare'}).people.every(p=>p.health===63));assert.match(workDescriptions(s,s.people[1]).care,/健康\+13/);
 });
});

test('edited search loot, risk and AP are used by the preview and actual search without adding removed resources',()=>{
 changed(SITES.shed,{loot:{materials:11,parts:4}},()=>changed(SEARCH_RULES,{quickAP:3,deepAP:4,deepPrimaryFactor:3,deepSecondary:2,deepInjury:100,deepDamage:17},()=>{
  const s=day();s.day=5;
  for(const deep of [false,true]){
   const plan=searchPlan(SITES.shed,{deep,day:s.day}),after=act(s,{type:'search',site:'shed',deep});
   for(const [key,n]of Object.entries(plan.loot))assert.equal(after.resources[key]-s.resources[key],n);
   assert.equal(after.resources.fuel,s.resources.fuel);assert.equal(s.ap-after.ap,plan.ap);
   assert.equal(after.people[0].health,deep?83:100);
  }
 }));
});

test('edited fog risk updates quick search damage and shared rule and skill descriptions together',()=>{
 changed(SEARCH_RULES,{fogInjuryBonus:100,deepDamage:17},()=>{
  const s=day(7);s.day=15;assert.equal(weather(s.day,s.seed),'fog');
  const plan=searchPlan(SITES.shed,{weather:'fog',day:s.day}),after=act(s,{type:'search',site:'shed'});
  assert.equal(plan.injuryChance,100);assert.equal(after.people[0].health,83);
  assert.match(searchRiskDescription(),/雾天所有搜索增加100个百分点：快搜100%，深搜独行100%/);
  assert.match(skillInfo(s.people[0],'exploration').note,/雾天所有搜索增加100个百分点/);
 });
});

test('edited food rules update the consumption breakdown, help and exact night settlement',()=>{
 changed(RATIONS,{baseFood:2,workFood:3,nightFood:4},()=>{
  const s=day();s.people[0].workedDay=s.day;const prepared=act(s,{type:'prepare'}),b=createBattle(prepared,'ration-copy',{autoPause:false});
  b.finished=true;const d=dailyConsumption(b),result=settleNight(prepared,b);
  assert.equal(d.food,9);assert.equal(prepared.resources.food-result.resources.food,d.food);
  const html=rationsPanel(s,null,'food');assert.match(html,/2＋3＋4＝9食物/);assert.match(html,/每人基础2食物/);assert.match(html,/劳动加3/);assert.match(html,/临时出动加4/);
 });
});

test('edited throw damage, cost and time reach the battle, emergency help and creature counter advice',()=>{
 changed(COMBAT.throw,{damage:19,stun:5},()=>changed(NIGHT_ACTIONS.times,{throw:.5},()=>changed(NIGHT_ACTIONS.costs,{throw:{materials:3}},()=>{
  const b=createBattle(act(day(),{type:'prepare'}),'throw-copy',{autoPause:false});b.schedule=[{at:999,type:'walker',zone:'left'}];b.paused=false;
  const p=b.people[0];Object.assign(p,inner(ZONES[0]),{cooldown:100});
  b.enemies=[{id:'victim',type:'walker',zone:'gate',x:240,y:475,hp:100,max:100,mode:'attack',attack:0,progress:0,stun:100}];
  const help=nightActionInfo(b,p,'throw'),before=b.resources.materials;
  assert.equal(help.cost,'3建材');assert.equal(help.time,'0.5秒');assert.match(help.effect,/基础19伤害、眩晕5秒/);
  battleCommand(b,{type:'throw',person:p.id,target:'gate'});assert.equal(b.resources.materials,before-3);advance(b,.6);
  assert.equal(b.enemies[0].hp,81);assert.ok(b.enemies[0].stun>4.8);
  assert.ok(bestiaryEntries({flags:{seenTypes:['caller']}}).find(e=>e.id==='caller').counter.includes(`${COMBAT.heavy.damage}伤害、眩晕${COMBAT.heavy.stun}秒`));
 })));
});

test('edited fire, warning and boss rules update their effects and generated descriptions',()=>{
 changed(COMBAT.fire,{damageFactor:.5,rammerFactor:.6,stamina:3},()=>{
  const html=campfireDetails({heat:60,wood:1,wet:0},'clear',true);assert.match(html,/伤害−50%/);assert.match(html,/重撞兽−40%/);assert.match(html,/每秒恢复3点/);
  const entries=bestiaryEntries({flags:{seenTypes:['walker','rammer']}});assert.equal(entries.find(e=>e.id==='walker').firePersonDamage,.6);assert.equal(entries.find(e=>e.id==='rammer').fireReduction,40);
 });
 changed(CAMPFIRE_HEAT,{add:13,minimum:30,active:21},()=>{
  assert.equal(tendedHeat(45),58);assert.match(nightActionInfo({aidKit:false},{skills:{medical:0,engineering:0},fatigue:0},'stoke').effect,/火势\+13，至少30/);assert.match(campfireDetails({heat:45,wood:1,wet:0},'clear',true),/必须大于21/);
 });
 changed(COMBAT,{bellRange:37},()=>{assert.equal(warningDistance({warningLead:5,zones:[{id:'gate',bell:true}]},'gate'),42);});
 changed(COMBAT.trap,{damage:29,stun:4},()=>{assert.match(defenseDescription(),/基础伤害29、眩晕4秒/);});
 changed(BOSS_RULES.bastion,{charge:.3,armor:.2,afterHit:1.25},()=>{
  const s=day();s.day=7;s.people[0].nightRole='sleep';const b=createBattle(act(s,{type:'prepare'}),'boss-copy',{autoPause:false});b.schedule=[{at:.05,type:'bastion',zone:'gate',challenge:true}];b.paused=false;stepBattle(b);
  const e=b.enemies.find(e=>e.boss);Object.assign(e,{x:240,y:475,mode:'attack'});advance(b,.05);assert.equal(bossDamage(b,e,10,'strike'),2);
  assert.match(BOSS_SPECIES.bastion.behavior,/蓄撞0.3秒/);assert.match(BOSS_SPECIES.bastion.behavior,/造成20%伤害/);advance(b,.35);assert.equal(b.boss.phase,'exposed');assert.ok(b.boss.clock<=1.25);assert.ok(b.zones[0].hp<s.zones[0].hp);
 });
});

test('edited challenge reward changes the preview and saved payout together',()=>{
 changed(CHALLENGE_REWARD,{materials:7,fear:9},()=>{
  const s=day();s.people[0].fear=50;const ready=act(s,{type:'prepare'}),b=createBattle(ready,'reward-copy');b.finished=true;b.challenge.status='cleared';
  assert.match(dailyChallenge(s).reward,/建材\+7、全员恐惧−9/);const after=settleNight(ready,b);assert.equal(after.resources.materials-ready.resources.materials,7);assert.equal(validateClientResult(ready,after),after);assert.ok(after.logs.some(line=>line.includes('建材+7，全员恐惧−9')));
 });
});

test('the generated rules document stays current and follows edited loot without its own numeric table',async()=>{
 const {generateRules}=await import('../scripts/generate-rules.js');
 const {readFileSync}=await import('node:fs');
 assert.equal(readFileSync(new URL('../RULES_CURRENT.md',import.meta.url),'utf8'),generateRules());
 changed(SITES.shed,{loot:{materials:23,parts:6}},()=>{
  assert.ok(generateRules().includes('| 废弃工具棚 | 1 | 23建材、6零件 |'));
  assert.ok(!generateRules().includes('| 废弃工具棚 | 1 | 7建材、1零件、2燃料 |'));
 });
});

test('edited automatic repair prices respect remaining stock and the support budget',()=>{
 changed(NIGHT_ACTIONS.costs,{repair:{materials:3}},()=>{
  for(const [stock,budget,allowed]of [[2,4,false],[5,2,false],[5,4,true]]){
   const s=day();s.resources.materials=stock;s.people[0].nightRole='support';
   const b=createBattle(act(s,{type:'prepare'}),'support-price',{autoPause:false});b.supportBudget.materials=budget;b.schedule=[{at:999,type:'walker',zone:'gate'}];b.paused=false;
   assert.doesNotThrow(()=>stepBattle(b));assert.equal(b.people[0].task?.type==='repair',allowed);assert.equal(b.resources.materials,allowed?stock-3:stock);
  }
 });
});
