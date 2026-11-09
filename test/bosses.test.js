import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,applyCampaignAction,settleNight} from '../src/campaign.js';
import {createBattle,stepBattle,battleCommand,inner} from '../src/battle.js';
import {BOSSES,BOSS_SPECIES,BOSS_FORM_HEALTH} from '../src/boss-content.js';
import {bossDamage,bossStatus} from '../src/bosses.js';
import {ENEMIES,ZONES,enemyTypes,dailyIntel} from '../src/content.js';
import {validateClientResult} from '../src/client-result.js';
import {leaveHouse} from '../src/shelter.js';
import {BOSS_RULES} from '../src/balance.js';
const advance=(b,n)=>{for(let i=0;i<Math.ceil(n*20)&&!b.finished;i++)stepBattle(b);};
function fixture(day){let state=applyCampaignAction(initialCampaign(53),{type:'chooseRole',role:'repairman'});state.day=day;state.resources.materials=100;state.flags.centralFire=false;state.zones.forEach(z=>z.hp=100);state.people[0].nightRole='sleep';state=applyCampaignAction(state,{type:'prepare'});const b=createBattle(state,'boss-test',{autoPause:false}),def=BOSSES[day];b.schedule=[{at:.05,type:def.id,zone:b.boss.zone,challenge:true}];b.paused=false;stepBattle(b);const e=b.enemies.find(e=>e.boss),z=ZONES.find(z=>z.id===e.zone);Object.assign(e,{x:z.x,y:z.y,mode:'attack'});return {b,e,state};}
function actor(b,point){const p=b.people[0];leaveHouse(b,p);Object.assign(p,{x:point.x,y:point.y,nightRole:'guard',cooldown:0,fear:0});return p;}

test('four independent boss species occur only every seventh night, with no ordinary random spawn',()=>{
 assert.equal(new Set(Object.values(BOSSES).map(d=>d.id)).size,4);for(let day=1;day<=28;day++){let state=applyCampaignAction(initialCampaign(),{type:'chooseRole',role:'repairman'});state.day=day;const b=createBattle(applyCampaignAction(state,{type:'prepare'}),'plan');assert.equal(!!b.boss,day%7===0);assert.ok(enemyTypes(day).every(id=>!BOSS_SPECIES[id]));if(b.boss){assert.equal(b.challenge.boss,BOSSES[day].id);assert.equal(b.schedule.filter(s=>BOSS_SPECIES[s.type]).length,1);assert.equal(dailyIntel(state).type,BOSSES[day].id);}}
});
test('bastion armor, real brace counter and exposed attacks change actual damage',()=>{
 const {b,e}=fixture(7);advance(b,.1);assert.equal(b.boss.phase,'charge');assert.equal(bossDamage(b,e,10,'strike'),3.5);const p=actor(b,inner(ZONES[0]));p.cooldown=1.2;battleCommand(b,{type:'brace',person:p.id,target:'gate'});b.boss.clock=4.99;const hp=b.zones[0].hp;stepBattle(b);assert.equal(b.boss.phase,'exposed');assert.equal(b.zones[0].hp,hp);assert.ok(b.events.some(e=>e.text.includes('顶住成功')));assert.equal(b.people[0].task,null);assert.ok(b.people[0].stamina<100);assert.throws(()=>battleCommand(b,{type:'brace',person:p.id,target:'gate'}),/恢复/);assert.equal(bossDamage(b,e,10,'strike'),15);
});
test('unanswered bastion charge damages the wall then exposes its weak point; spike damage still works',()=>{
 const {b,e}=fixture(7);b.zones[0].spikes=true;advance(b,5.2);assert.equal(b.zones[0].hp,64);assert.equal(b.boss.phase,'exposed');assert.ok(e.hp<228-6);assert.ok(b.events.some(e=>e.type==='impact'||e.type==='hit'));
});
test('actual throwing interrupts a charge, consumes one material, and pausing freezes boss clocks',()=>{
 const {b,e}=fixture(7);advance(b,.05);const p=actor(b,inner(ZONES[0])),materials=b.resources.materials;battleCommand(b,{type:'throw',person:p.id,target:'gate'});advance(b,2.1);assert.equal(b.resources.materials,materials-1);assert.equal(b.boss.phase,'exposed');assert.ok(b.events.some(e=>e.text.includes('投掷打断')));battleCommand(b,{type:'pause'});const frozen=structuredClone(b);advance(b,10);assert.deepEqual(b,frozen);assert.ok(e.hp<=228);
});
test('brood mounds can be sealed with mesh or a real compaction task, causing sixteen damage',()=>{
 for(const method of ['mesh','compact']){const {b,e}=fixture(14);advance(b,.05);assert.equal(b.boss.mounds.length,1);if(method==='mesh')b.zones[3].mesh=true;else{const p=actor(b,inner(ZONES[3]));battleCommand(b,{type:'compact',person:p.id,target:'backLeft'});}advance(b,method==='mesh'?.05:5.1);assert.equal(b.boss.sealed,1);assert.equal(b.boss.summons,0);assert.ok(b.enemies.find(q=>q.id===e.id).hp<=242);assert.ok(b.events.some(e=>e.type==='boss-break'&&e.damage===16));}
});
test('a living broodmother keeps producing real offspring beyond two, even after entering the yard',()=>{
 const {b}=fixture(14);let count=0;for(let i=0;i<1600;i++){stepBattle(b);for(const child of b.enemies.filter(e=>e.bossBrood)){assert.equal(child.type,'broodmother');assert.equal(child.mode,'inside');assert.ok(!child.boss);assert.equal(child.max,42);assert.equal(child.hp,42);count++;}b.enemies=b.enemies.filter(e=>!e.bossBrood);}assert.equal(count,5);assert.equal(b.boss.summons,5);assert.equal(b.enemies.find(e=>e.boss).mode,'inside');assert.equal(b.boss.entityIds.length,1);
});
test('broodmother laying follows its life clock during approach, inside combat and stun, and pauses with the battle',()=>{
 for(const mode of ['approach','inside']){
  const {b,e}=fixture(14);e.mode=mode;e.stun=100;
  const zones=[];let previous=0;
  for(let i=0;i<800;i++){
   stepBattle(b);if(b.boss.moundSeq!==previous){zones.push(b.boss.moundSeq%2?'backLeft':'backRight');previous=b.boss.moundSeq;}
   b.enemies=b.enemies.filter(e=>!e.bossBrood);
  }
  // The first mound was laid as soon as the mother appeared, before contact.
  assert.equal(b.boss.moundSeq,3);assert.deepEqual(zones,['backLeft','backRight','backLeft']);assert.equal(b.boss.summons,3);assert.equal(e.mode,mode);assert.ok(e.stun>0);
  battleCommand(b,{type:'pause'});const frozen=structuredClone(b);advance(b,20);assert.deepEqual(b,frozen);
 }
});
test('sealed nests do not stop subsequent laying; killing the mother clears pending eggs but keeps hatched offspring',()=>{
 const sealed=fixture(14);sealed.b.zones[3].mesh=true;sealed.b.zones[4].mesh=true;sealed.e.stun=100;
 advance(sealed.b,BOSS_RULES.brood.interval*2+.1);assert.equal(sealed.b.boss.sealed,3);assert.equal(sealed.b.boss.summons,0);assert.equal(sealed.e.hp,BOSSES[14].hp-3*BOSS_RULES.brood.sealDamage);
 const {b,e}=fixture(14);advance(b,16.1);assert.equal(b.boss.summons,1);assert.equal(b.boss.mounds.length,1);
 e.hp=0;stepBattle(b);assert.equal(b.boss.defeated,true);assert.equal(b.boss.mounds.length,0);assert.equal(b.finished,false);
 advance(b,20);assert.equal(b.boss.summons,1);assert.equal(b.boss.moundSeq,2);assert.equal(b.enemies.filter(e=>e.bossBrood).length,1);
 assert.ok(b.enemies.some(e=>e.type==='shellcrab'),'the boss follower is a separate live threat');for(const e of b.enemies)e.hp=0;stepBattle(b);assert.equal(b.finished,true);
});
test('continuous brood counts remain saveable above two and reject invalid counters',()=>{
 const {b,e,state}=fixture(14);state.flags.seenTypes=Object.keys(ENEMIES);b.seen=Object.keys(ENEMIES);
 for(let i=0;i<1600;i++){stepBattle(b);b.enemies=b.enemies.filter(e=>!e.bossBrood);}
 assert.equal(b.boss.summons,5);e.hp=0;stepBattle(b);const result=settleNight(state,b);
 assert.equal(validateClientResult(state,result),result);assert.equal(result.report.boss.summons,5);
 for(const summons of [-1,1.5,Infinity,Number.MAX_SAFE_INTEGER+1]){const invalid=structuredClone(result);invalid.report.boss.summons=summons;assert.throws(()=>validateClientResult(state,invalid),/首领机制记录/);}
});
test('cinder siphon spends heat rather than fuel, actual extinguishing interrupts and exposes it',()=>{
 const {b,e}=fixture(21);b.fires=[{id:'central',x:240,y:390,heat:60,wood:1,wet:0,enabled:true,shade:true}];advance(b,1);assert.equal(b.boss.phase,'siphon');assert.equal(bossDamage(b,e,10,'strike'),5);assert.ok(Math.abs(b.fires[0].wood-(1-.006))<1e-8);assert.ok(Math.abs(b.fires[0].heat-(60-(b.weather==='rain'?2.65:2.36)))<1e-7);const p=actor(b,b.fires[0]);battleCommand(b,{type:'extinguish',person:p.id,target:'central'});advance(b,4.5);assert.equal(b.fires[0].heat,0);assert.equal(b.boss.phase,'exposed');assert.ok(b.events.some(e=>e.text.includes('火源切断')));assert.equal(bossDamage(b,e,10,'strike'),15);
});
test('an unanswered siphon switches from fire to one fence without also damaging or wetting the fire, and no-fire fights remain playable',()=>{
 const {b}=fixture(21);b.fires=[{id:'central',x:240,y:390,heat:80,wood:1,wet:0,enabled:true,shade:true}];advance(b,8.1);assert.equal(b.boss.phase,'exposed');assert.equal(b.fires[0].wet,0);assert.ok(Math.abs(b.zones[1].hp-83.2)<1e-8);assert.ok(b.events.some(e=>e.type==='boss-burst'));assert.equal(b.events.find(e=>e.type==='hit').damage,16.8);
 const dry=fixture(21);advance(dry.b,10);assert.equal(dry.b.boss.phase,'drained');assert.ok(dry.b.zones[1].hp<100);assert.ok(!dry.b.events.some(e=>e.type==='boss-burst'));
});
test('twinvein splits at half of 450 health into three 108-health bodies; two down cannot win while the third survives',()=>{
 const {b,e}=fixture(28);assert.equal(e.hp,450);e.hp=226;stepBattle(b);assert.equal(b.boss.split,false);
 e.hp=225;stepBattle(b);const twins=b.enemies.filter(e=>e.boss);
 assert.equal(twins.length,3);assert.deepEqual(twins.map(e=>e.bossForm),[1,2,3]);assert.ok(twins.every(e=>e.hp===108&&e.max===108));
 assert.deepEqual(twins.map(e=>e.zone),['gate','right','left']);assert.equal(new Set(b.boss.entityIds).size,3);
 assert.equal(bossStatus(b).hp,324);assert.equal(bossStatus(b).max,324);
 for(let cycle=0;cycle<2;cycle++){
  twins[0].mode='inside';twins[0].hp=twins[1].hp=0;stepBattle(b);assert.ok(twins.slice(0,2).every(e=>e.bossDormant));assert.equal(b.boss.defeated,false);
  const until=b.boss.downUntil;advance(b,12.1);assert.ok(b.elapsed>=until);assert.ok(twins.slice(0,2).every(e=>e.hp===54&&!e.bossDormant));assert.equal(twins[0].mode,'inside');assert.equal(b.boss.revives,cycle+1);
 }
 twins[0].hp=twins[1].hp=0;stepBattle(b);advance(b,12.1);assert.equal(twins[0].hp,0);assert.equal(twins[1].hp,0);assert.equal(b.boss.revives,2);assert.equal(b.boss.defeated,false);
 twins[2].hp=0;stepBattle(b);assert.equal(b.boss.defeated,true);assert.equal(b.challenge.bossDefeated,true);assert.equal(b.enemies.length,0);
});
test('defeating all three split bodies inside the shared window ends the fight without revival',()=>{
 const {b,e}=fixture(28);e.hp=225;stepBattle(b);const twins=b.enemies.filter(e=>e.boss);
 twins[0].hp=0;stepBattle(b);const window=b.boss.downUntil;advance(b,2);twins[1].hp=0;stepBattle(b);
 assert.equal(b.boss.downUntil,window);assert.equal(b.boss.defeated,false);advance(b,2);twins[2].hp=0;stepBattle(b);
 assert.equal(b.boss.revives,0);assert.equal(b.boss.defeated,true);assert.equal(b.enemies.length,0);
});
test('a live boss keeps fighting beyond the former dawn and dormant forms can revive',()=>{
 const {b,e}=fixture(28);e.hp=49;stepBattle(b);b.enemies[0].hp=0;stepBattle(b);b.elapsed=180;advance(b,13);assert.equal(b.finished,false);assert.equal(b.challenge.status,'pending');assert.equal(b.boss.defeated,false);assert.equal(b.enemies.filter(e=>e.boss&&e.hp>0).length,3);assert.equal(bossStatus(b).label,'分裂3体');
});
test('boss encounters and structured reports save without leaking runtime state or unknown plot fields',()=>{
 for(const day of [7,14,21,28]){const {b,e,state}=fixture(day);state.flags.seenTypes=Object.keys(ENEMIES);b.seen=Object.keys(ENEMIES);e.hp=0;stepBattle(b);if(day===28){for(const twin of b.enemies.filter(e=>e.boss))twin.hp=0;stepBattle(b);}b.enemies=[];b.elapsed=42;stepBattle(b);const result=settleNight(state,b);assert.equal(validateClientResult(state,result),result);assert.equal(result.report.boss.id,BOSSES[day].id);assert.equal(result.report.boss.defeated,true);assert.ok(!Object.hasOwn(result,'boss'));assert.ok(!Object.hasOwn(result.flags,'boss'));assert.equal(result.flags.seenTypes.length,Object.keys(ENEMIES).length);}
});
