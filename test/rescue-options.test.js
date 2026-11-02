import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {initialCampaign,applyCampaignAction as act,settleNight,makePerson} from '../src/campaign.js';
import {createBattle,stepBattle} from '../src/battle.js';
import {BOSS_SPECIES} from '../src/boss-content.js';
import {RESCUE_RULES,rescueBenefits} from '../src/rescue.js';
import {dayStory} from '../src/story.js';
import {broadcast} from '../src/content.js';
import {validateClientResult} from '../src/client-result.js';
import {openStore} from '../src/store.js';
import {openCampaignStore} from '../src/campaign-store.js';
import {actionAvailability,storyEffect,nightActionInfo} from '../client/action-help.js';

function day(n=18){const s=act(initialCampaign(53),{type:'chooseRole',role:'watchman'});s.day=n;s.resources={food:80,water:80,materials:120,fuel:30,medicine:20,parts:20};s.zones.forEach(z=>z.hp=100);return s;}
const battle=s=>createBattle(act(s,{type:'prepare'}),'rescue',{autoPause:false});
const ordinary=b=>b.schedule.filter(e=>!BOSS_SPECIES[e.type]).length;

test('route work buys one real preparation point for one action and three materials, capped at two',()=>{
 const s=day(15),before=structuredClone(s);let next=act(s,{type:'routeWork'});
 assert.equal(next.ap,5);assert.equal(next.resources.materials,117);assert.equal(next.flags.routeWork,1);assert.equal(next.people[0].fatigue,5);assert.deepEqual(s,before);
 next=act(next,{type:'routeWork'});assert.equal(next.flags.routeWork,2);const full=structuredClone(next);assert.throws(()=>act(next,{type:'routeWork'}),/无需/);assert.deepEqual(next,full);
 for(const bad of [{...day(14)},{...day(15),ap:0},{...day(15),resources:{...s.resources,materials:2}}]){const copy=structuredClone(bad);assert.throws(()=>act(bad,{type:'routeWork'}));assert.deepEqual(bad,copy);}
 const searched=act(day(15),{type:'search',site:'rescue'});assert.equal(searched.flags.routeWork,1);assert.equal(searched.resources.materials,124);assert.equal(searched.ap,4);
});

test('neighbor aid gives an immediate return with a real three-day cooldown, exposure cap and no double reward',()=>{
 const s=day(),next=act(s,{type:'help'});assert.equal(next.ap,5);assert.equal(next.resources.food,77);assert.equal(next.resources.materials,124);assert.equal(next.resources.medicine,21);assert.equal(next.people[0].fatigue,5);assert.equal(next.flags.helped,1);assert.equal(next.exposure,1);assert.equal(rescueBenefits(next).nextHelpDay,21);
 for(const n of [18,19,20])assert.throws(()=>act({...next,day:n},{type:'help'}),/三日/);
 const again=act({...next,day:21,exposure:6},{type:'help'});assert.equal(again.exposure,6);assert.equal(again.flags.helped,2);assert.equal(again.resources.materials,128);assert.equal(again.resources.medicine,22);
 const later=act({...again,day:24},{type:'help'});assert.equal(later.resources.materials,132);assert.equal(rescueBenefits(later).aid,2);
 assert.throws(()=>act(day(17),{type:'help'}),/尚未开始/);const poor=day();poor.resources.food=2;const copy=structuredClone(poor);assert.throws(()=>act(poor,{type:'help'}),/物资/);assert.deepEqual(poor,copy);
});

test('route and aid remove exactly four ordinary final-night arrivals at most, preserving the real boss',()=>{
 const base=day(28),unprepared=battle(base),n=ordinary(unprepared);
 for(const routeWork of [0,1,2,99])for(const helped of [0,1,2,99]){
  const s=structuredClone(base);Object.assign(s.flags,{routeWork,helped});const b=battle(s),expected=Math.min(2,routeWork)+Math.min(2,helped);
  assert.equal(n-ordinary(b),expected);assert.equal(b.schedule.filter(e=>BOSS_SPECIES[e.type]).length,1);assert.equal(b.schedule.find(e=>BOSS_SPECIES[e.type]).type,'twinvein');assert.equal(b.boss.defeated,false);
  assert.ok(b.schedule.every(wave=>unprepared.schedule.some(before=>JSON.stringify(before)===JSON.stringify(wave))),'relief removes arrivals without rerolling or rescheduling surviving enemies');
 }
 for(const n of [18,21,24,27]){const s=day(n),before=battle(s);s.flags.helped=99;assert.deepEqual(battle(s).schedule,before.schedule,'neighbor aid never permanently increases earlier attacks');}
});

test('route traps respect each direction, the three-trap cap and destroyed fences',()=>{
 for(const route of ['road','river']){
  const s=day(28);Object.assign(s.flags,{route,routeWork:2});const b=battle(s);
  assert.equal(b.zones.find(z=>z.id==='gate').traps,route==='road'?2:0);assert.equal(b.zones.find(z=>z.id==='backLeft').traps,route==='river'?1:0);assert.equal(b.zones.find(z=>z.id==='backRight').traps,route==='river'?1:0);assert.equal(b.boss.zone,route==='river'?'backLeft':'gate');
  s.zones.forEach(z=>z.traps=3);assert.ok(battle(s).zones.every(z=>z.traps===3));s.zones.forEach(z=>z.hp=0);assert.ok(battle(s).zones.every(z=>z.traps===0));
 }
});

test('only an actual contact visit after selecting the current route can deliver it; fallback remains available',()=>{
 let s=act(day(15),{type:'search',site:'contact'});assert.ok(s.flags.registeredDay);s=act(s,{type:'route',route:'road'});assert.ok(!s.flags.routeDelivered);const prepared=act(s,{type:'prepare'});assert.ok(!prepared.flags.routeDelivered,'dusk cannot remotely submit a route chosen after the visit');
 s=act(day(15),{type:'route',route:'river'});s=act(s,{type:'search',site:'contact'});s.flags.routeWork=2;assert.equal(rescueBenefits(s).closePickup,true);
 s=act(s,{type:'route',route:'road'});assert.equal(s.flags.routeDelivered,null);assert.equal(rescueBenefits(s).closePickup,false);
 const base=act({...s,day:28},{type:'prepare'}),b=createBattle(base,'fallback');b.finished=true;b.house=80;b.enemies=[];const done=settleNight(base,b);assert.equal(done.phase,'rescued');assert.equal(done.ending.closePickup,false);validateClientResult(base,done);
});

test('expanded signal grants real team calm and capped final-night aid, with its stated resource and exposure costs',()=>{
 const s=day(24);s.people[0].fear=5;const ally=makePerson('lin','林禾','园艺师','survival');ally.fear=30;s.people.push(ally);s.flags.helped=1;s.exposure=5;
 const choice=dayStory(s).choices.find(c=>c.effect==='signal'),text=storyEffect(s,choice),next=act(s,{type:'event',choice:'signal'});
 assert.match(text,/恐惧−12/);assert.match(text,/第28夜再少来1只/);assert.deepEqual(next.people.map(p=>p.fear),[0,18]);assert.equal(next.flags.helped,2);assert.equal(next.resources.fuel,28);assert.equal(next.resources.parts,19);assert.equal(next.ap,5);assert.equal(next.exposure,6);assert.throws(()=>act(next,{type:'event',choice:'signal'}));
 const full=day(24);full.flags.helped=2;assert.match(storyEffect(full,choice),/已达上限/);
});

test('story and night-action help describe actual recipes, registration timing and fatigue-adjusted durations',()=>{
 for(const n of [8,10,17,19,24,27]){const s=day(n),c=dayStory(s).choices[0];assert.ok(storyEffect(s,c).length>10);}
 let s=day(10);s.buildings.push({id:'mail',type:'exchange',level:1,hp:10});s=act(s,{type:'event',choice:'delegate'});assert.equal(s.flags.pendingRegistration,11);s=act({...s,phase:'report'},{type:'nextDay'});assert.equal(s.flags.registeredDay,10);assert.match(broadcast(s),/登记已收到/);
 s=day(17);const kit=act(s,{type:'event',choice:'kit'}),p=kit.people[0];p.skills.medical=2;let info=nightActionInfo({aidKit:true},p,'aid');assert.equal(info.cost,'1药品');assert.match(info.effect,/健康至少42/);assert.equal(info.time,'4.08秒');p.fatigue=0;assert.equal(nightActionInfo({aidKit:true},p,'aid').time,'4秒');assert.equal(nightActionInfo({aidKit:false},p,'aid').time,'6秒');assert.match(nightActionInfo({},p,'throw').effect,/基础10伤害/);
 const blocked=day(10),copy=structuredClone(blocked);assert.equal(actionAvailability(blocked,{type:'event',choice:'delegate'}).allowed,false);assert.deepEqual(blocked,copy,'reading help never mutates a campaign');
});

test('persisted aid requests replay once and a rejected cooldown preserves the stored progress',t=>{
 const dir=mkdtempSync(join(tmpdir(),'rescue-options-')),path=join(dir,'game.sqlite'),legacy=openStore(path),player=legacy.createPlayer(),store=openCampaignStore(path),db=new DatabaseSync(path);t.after(()=>{db.close();store.close();legacy.close();rmSync(dir,{recursive:true,force:true});});
 const before=store.ensure(player.userId,player.snapshot),state=day();db.prepare('UPDATE campaigns SET state_json=?,dawn_json=? WHERE user_id=?').run(JSON.stringify(state),JSON.stringify(state),player.userId);
 const request={runId:before.runId,revision:before.revision,requestId:randomUUID(),action:{type:'help'}},done=store.action(player.userId,request),replay=store.action(player.userId,request);assert.equal(done.state.resources.materials,124);assert.equal(replay.revision,done.revision);assert.deepEqual(replay.state,done.state);assert.equal(replay.replayed,true);
 assert.throws(()=>store.action(player.userId,{...request,revision:done.revision,requestId:randomUUID()}),/三日/);assert.deepEqual(store.snapshot(player.userId),done);assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
});
