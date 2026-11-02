import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID,createHash } from 'node:crypto';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openStore } from '../src/store.js';
import { openCampaignStore } from '../src/campaign-store.js';
import { settleNight,makePerson } from '../src/campaign.js';
import { createBattle,stepBattle,battleCommand } from '../src/battle.js';
function setup(t){const dir=mkdtempSync(join(tmpdir(),'dawn-v2-')),path=join(dir,'game.sqlite'),old=openStore(path),player=old.createPlayer(),store=openCampaignStore(path),observer=new DatabaseSync(path);store.ensure(player.userId,player.snapshot);t.after(()=>{observer.close();store.close();old.close();rmSync(dir,{force:true,recursive:true});});return {path,old,store,observer,user:player.userId};}
const act=(env,s,action)=>env.store.action(env.user,{runId:s.runId,revision:s.revision,requestId:randomUUID(),action});
const finish=(env,base,battle,user=env.user)=>env.store.finishClient(user,{runId:base.runId,revision:base.revision,nightId:`local-${base.runId}-${base.revision}`,result:settleNight(base.state,battle)});
test('old building durability loads without writes; damage, repair and retries persist and replay once',t=>{
 const env=setup(t);let snap=act(env,env.store.snapshot(env.user),{type:'chooseRole',role:'repairman'});snap=act(env,snap,{type:'build',building:'garden'});
 const legacy=structuredClone(snap.state);delete legacy.buildings[0].hp;env.observer.prepare('UPDATE campaigns SET state_json=?,dawn_json=? WHERE user_id=?').run(JSON.stringify(legacy),JSON.stringify(legacy),env.user);
 const version=env.observer.prepare('PRAGMA data_version').get().data_version;snap=env.store.snapshot(env.user);assert.equal(snap.state.buildings[0].hp,10);assert.equal(env.observer.prepare('PRAGMA data_version').get().data_version,version);assert.equal(JSON.parse(env.observer.prepare('SELECT state_json FROM campaigns WHERE user_id=?').get(env.user).state_json).buildings[0].hp,undefined);
 snap=act(env,snap,{type:'prepare'});const battle=createBattle(snap.state,'broken');battle.buildings[0].hp=0;let saved=finish(env,snap,battle);assert.equal(saved.state.buildings[0].hp,0);assert.equal(finish(env,snap,battle).revision,saved.revision);
 const reopened=openCampaignStore(env.path);assert.equal(reopened.snapshot(env.user).state.buildings[0].hp,0);reopened.close();
 const next=act(env,saved,{type:'nextDay'}),request={runId:next.runId,revision:next.revision,requestId:randomUUID(),action:{type:'rebuildBuilding',id:next.state.buildings[0].id,building:'garden'}},fixed=env.store.action(env.user,request);assert.equal(fixed.state.buildings[0].hp,10);assert.equal(fixed.state.resources.materials,next.state.resources.materials-5);assert.deepEqual(env.store.action(env.user,request).state,fixed.state);
 const ready=act(env,fixed,{type:'prepare'});saved=finish(env,ready,createBattle(ready.state,'quiet'));const retry=act(env,saved,{type:'retryDay'});assert.equal(retry.state.buildings[0].hp,0,'retry restores the damage present at dawn, before the repair');
 const oldReady=act(env,retry,{type:'prepare'}),result=settleNight(oldReady.state,createBattle(oldReady.state,'old-browser'));result.buildings.forEach(b=>{delete b.hp;delete b.plot;});const oldSaved=env.store.finishClient(env.user,{runId:oldReady.runId,revision:oldReady.revision,nightId:`local-${oldReady.runId}-${oldReady.revision}`,result});assert.equal(oldSaved.state.buildings[0].hp,0,'old browsers cannot revive a saved ruin');
});
test('permanent defense quotes protect old pages, charge the displayed new price once and persist after reopening',t=>{
 const env=setup(t);let snap=act(env,env.store.snapshot(env.user),{type:'chooseRole',role:'repairman'});
 for(const price of [undefined,{ap:1,materials:3},{ap:0,materials:10},{ap:1,materials:0}]){
  assert.throws(()=>act(env,snap,{type:'defense',zone:'gate',feature:'spikes',price}),/刷新页面确认新费用/);assert.deepEqual(env.store.snapshot(env.user),snap);
 }
 const request={runId:snap.runId,revision:snap.revision,requestId:randomUUID(),action:{type:'defense',zone:'gate',feature:'spikes',price:{ap:1,materials:10}}},before=snap;
 snap=env.store.action(env.user,request);assert.equal(snap.state.ap,before.state.ap-1);assert.equal(snap.state.resources.materials,before.state.resources.materials-10);assert.equal(snap.state.zones[0].spikes,true);
 const replay=env.store.action(env.user,request);assert.equal(replay.replayed,true);assert.deepEqual(replay.state,snap.state);assert.equal(replay.revision,snap.revision);
 assert.throws(()=>act(env,snap,{type:'defense',zone:'gate',feature:'mesh',price:{ap:1,materials:10}}),/物资不足/);assert.deepEqual(env.store.snapshot(env.user),snap);
 const reopened=openCampaignStore(env.path);t.after(()=>reopened.close());assert.deepEqual(reopened.snapshot(env.user),snap);
});
test('a previously accepted old-price defense request replays without charging again or demanding a new quote',t=>{
 const env=setup(t),before=act(env,env.store.snapshot(env.user),{type:'chooseRole',role:'repairman'}),action={type:'defense',zone:'gate',feature:'spikes'},requestId=randomUUID();
 const legacy=structuredClone(before.state);legacy.zones[0].spikes=true;legacy.ap--;legacy.resources.materials-=3;
 env.observer.prepare('UPDATE campaigns SET state_json=?,revision=? WHERE user_id=?').run(JSON.stringify(legacy),before.revision+1,env.user);
 env.observer.prepare('INSERT INTO campaign_requests VALUES (?,?,?)').run(before.runId,requestId,createHash('sha256').update(JSON.stringify(action)).digest('hex'));
 const saved=env.store.snapshot(env.user),replay=env.store.action(env.user,{runId:before.runId,revision:before.revision,requestId,action});
 assert.equal(replay.replayed,true);assert.deepEqual(replay.state,saved.state);assert.equal(replay.revision,saved.revision);assert.deepEqual(env.store.snapshot(env.user),saved);
});
test('entire running night including repairs, pause and resume performs zero SQLite writes; end commits once',t=>{const env=setup(t);let s=env.store.snapshot(env.user);s=act(env,s,{type:'chooseRole',role:'repairman'});s=act(env,s,{type:'prepare'});const version=()=>env.observer.prepare('PRAGMA data_version').get().data_version;const beforeVersion=version(),before=env.store.snapshot(env.user),battle=createBattle(s.state,'night-unique',{autoPause:false});battleCommand(battle,{type:'repair',person:'hero',target:'gate'});battleCommand(battle,{type:'resume'});for(let i=0;i<5000&&!battle.finished;i++)stepBattle(battle);assert.deepEqual(env.store.snapshot(env.user),before);assert.equal(version(),beforeVersion);assert.equal(env.observer.prepare('SELECT count(*) AS n FROM night_results').get().n,0);const result=finish(env,s,battle);assert.equal(result.revision,s.revision+1);assert.ok(version()>beforeVersion);const duplicate=finish(env,s,battle);assert.equal(duplicate.revision,result.revision);assert.equal(env.observer.prepare('SELECT count(*) AS n FROM night_results').get().n,1);});
test('preparation survives server restart, completed client result can still save, dawn retry restores whole day',t=>{const env=setup(t);let s=act(env,env.store.snapshot(env.user),{type:'chooseRole',role:'watchman'});s=act(env,s,{type:'search',site:'shed'});s=act(env,s,{type:'prepare'});const b=createBattle(s.state,'temporary',{autoPause:false});b.paused=false;for(let i=0;i<600;i++)stepBattle(b);const reopened=openCampaignStore(env.path);assert.deepEqual(reopened.snapshot(env.user),s);reopened.close();for(let i=0;i<5000&&!b.finished;i++)stepBattle(b);const end=finish(env,s,b),retry=act(env,end,{type:'retryDay'});assert.equal(retry.state.phase,'day');assert.deepEqual(retry.state.searched,[]);assert.equal(retry.state.ap,6);assert.ok(retry.revision>end.revision);});
test('failed transactions and conflicting settlement cannot overwrite current state',t=>{const env=setup(t);const s=env.store.snapshot(env.user);assert.throws(()=>act(env,s,{type:'build',building:'garden'}));assert.deepEqual(env.store.snapshot(env.user),s);const selected=act(env,s,{type:'chooseRole',role:'medic'});assert.throws(()=>act(env,s,{type:'chooseRole',role:'repairman'}),/修改/);assert.equal(env.store.snapshot(env.user).revision,selected.revision);});
test('a migrated mid-day legacy save keeps the original dawn checkpoint for whole-day retry',t=>{const env=setup(t),player=env.old.createPlayer();let legacy=player.snapshot;for(const action of [{type:'listen'},{type:'search',place:'shed'}])legacy=env.old.act(player.userId,{runId:legacy.runId,revision:legacy.revision,requestId:randomUUID(),action});let s=env.store.ensure(player.userId,legacy);assert.equal(s.state.ap,4);assert.equal(s.state.resources.materials,11);s=env.store.action(player.userId,{...s,requestId:randomUUID(),action:{type:'prepare'}});const b=createBattle(s.state,'legacy-night',{autoPause:false});b.paused=false;for(let i=0;i<5000&&!b.finished;i++)stepBattle(b);const end=finish(env,s,b,player.userId),retry=env.store.action(player.userId,{...end,requestId:randomUUID(),action:{type:'retryDay'}});assert.equal(retry.state.day,1);assert.equal(retry.state.ap,6);assert.equal(retry.state.resources.materials,6);assert.equal(retry.state.resources.food,3);assert.equal(retry.state.people.length,1);assert.deepEqual(env.old.snapshot(player.userId).state,legacy.state);assert.equal(env.old.snapshot(player.userId).revision,legacy.revision);});
test('legacy full stamina loads without writes, old open nights save once, and dawn retry uses personal capacities',t=>{
 const env=setup(t);let s=act(env,env.store.snapshot(env.user),{type:'chooseRole',role:'watchman'}),legacy=structuredClone(s.state);legacy.day=3;legacy.beds=3;legacy.people.push(makePerson('zhou','老周','维修师傅','engineering'));legacy.people.forEach(p=>p.stamina=100);
 env.observer.prepare('UPDATE campaigns SET state_json=?,dawn_json=? WHERE user_id=?').run(JSON.stringify(legacy),JSON.stringify(legacy),env.user);
 const raw=()=>JSON.parse(env.observer.prepare('SELECT state_json FROM campaigns WHERE user_id=?').get(env.user).state_json),version=()=>env.observer.prepare('PRAGMA data_version').get().data_version,beforeVersion=version();
 s=env.store.snapshot(env.user);assert.deepEqual(s.state.people.map(p=>p.stamina),[120,85]);assert.equal(version(),beforeVersion);assert.deepEqual(raw().people.map(p=>p.stamina),[100,100]);
 s=act(env,s,{type:'prepare'});const result=settleNight(s.state,createBattle(s.state,'old-open'));result.people.forEach(p=>p.stamina=100);
 const input={runId:s.runId,revision:s.revision,nightId:`local-${s.runId}-${s.revision}`,result},saved=env.store.finishClient(env.user,input);assert.deepEqual(saved.state.people.map(p=>p.stamina),[120,85]);assert.deepEqual(raw().people.map(p=>p.stamina),[120,85]);assert.equal(env.store.finishClient(env.user,input).revision,saved.revision);
 const retry=act(env,saved,{type:'retryDay'});assert.deepEqual(retry.state.people.map(p=>p.stamina),[120,85]);assert.deepEqual(raw().people.map(p=>p.stamina),[120,85]);
});
test('old numeric shortage nights still save once, then new condition damage persists without automatic morning healing',t=>{
 const env=setup(t);let s=act(env,env.store.snapshot(env.user),{type:'chooseRole',role:'repairman'}),state=structuredClone(s.state);state.resources.food=0;state.resources.water=0;state.people[0].health=80;
 env.observer.prepare('UPDATE campaigns SET state_json=? WHERE user_id=?').run(JSON.stringify(state),env.user);s=act(env,env.store.snapshot(env.user),{type:'prepare'});
 const legacy=settleNight(s.state,createBattle(s.state,'legacy-nutrition'));Object.assign(legacy.people[0],{hunger:28,thirst:32,health:80});delete legacy.report.nutritionDamage;
 const request={runId:s.runId,revision:s.revision,nightId:`local-${s.runId}-${s.revision}`,result:legacy};let saved=env.store.finishClient(env.user,request);assert.equal(saved.state.people[0].health,80);assert.equal(saved.state.people[0].hunger,true);assert.equal(saved.state.people[0].thirst,true);assert.equal(env.store.finishClient(env.user,request).revision,saved.revision);
 saved=act(env,saved,{type:'nextDay'});assert.equal(saved.state.people[0].health,80);saved=act(env,saved,{type:'prepare'});const result=finish(env,saved,createBattle(saved.state,'new-nutrition'));assert.equal(result.state.people[0].health,60);assert.equal(result.state.report.nutritionDamage,20);assert.equal(result.state.people[0].hunger,true);
});

test('restart clears progress and dawn once, persists, rejects stale writes and leaves other players alone',t=>{
 const env=setup(t),other=env.old.createPlayer();env.store.ensure(other.userId,other.snapshot);const untouched=env.store.snapshot(other.userId);
 let snap=act(env,env.store.snapshot(env.user),{type:'chooseRole',role:'repairman'});snap=act(env,snap,{type:'search',site:'shed',deep:true});assert.equal(snap.state.people[0].fatigue,15);
 snap=act(env,snap,{type:'prepare'});const stale=snap,oldResult={runId:snap.runId,revision:snap.revision,nightId:`local-${snap.runId}-${snap.revision}`,result:settleNight(snap.state,createBattle(snap.state,'restart'))};
 assert.throws(()=>act(env,snap,{type:'restart'}),/确认/);assert.deepEqual(env.store.snapshot(env.user),snap);
 const request={runId:snap.runId,revision:snap.revision,requestId:randomUUID(),action:{type:'restart',confirm:true}};
 const fresh=env.store.action(env.user,request);assert.equal(fresh.revision,snap.revision+1);assert.equal(fresh.state.phase,'prologue');assert.equal(fresh.state.day,1);assert.equal(fresh.state.ap,6);assert.deepEqual(fresh.state.people,[]);assert.deepEqual(fresh.state.searched,[]);assert.equal(fresh.state.role,null);assert.equal(fresh.state.report,null);assert.notEqual(fresh.state.seed,snap.state.seed);
 assert.deepEqual(JSON.parse(env.observer.prepare('SELECT dawn_json FROM campaigns WHERE user_id=?').get(env.user).dawn_json),fresh.state);
 assert.equal(env.store.action(env.user,request).replayed,true);assert.deepEqual(env.store.action(env.user,request).state,fresh.state);
 assert.throws(()=>act(env,stale,{type:'backDay'}),/修改/);assert.throws(()=>env.store.finishClient(env.user,oldResult),/改变/);assert.deepEqual(env.store.snapshot(env.user),fresh);
 const reopened=openCampaignStore(env.path);assert.deepEqual(reopened.snapshot(env.user),fresh);reopened.close();
 snap=act(env,fresh,{type:'chooseRole',role:'medic'});const dawn=snap.state;snap=act(env,snap,{type:'repair',zone:'gate'});assert.equal(snap.state.people[0].fatigue,5);
 snap=act(env,snap,{type:'prepare'});snap=finish(env,snap,createBattle(snap.state,'new'));snap=act(env,snap,{type:'retryDay'});assert.equal(snap.state.role,'medic');assert.equal(snap.state.people[0].fatigue,0);assert.deepEqual(snap.state.resources,dawn.resources);
 assert.deepEqual(env.store.snapshot(other.userId),untouched);
});

test('breach destroys attached defenses durably, duplicate settlement cannot restore them, and rebuilding persists',t=>{
 const env=setup(t);let snap=act(env,env.store.snapshot(env.user),{type:'chooseRole',role:'repairman'});const funded=structuredClone(snap.state);funded.resources.materials=100;funded.people[0].nightRole='sleep';env.observer.prepare('UPDATE campaigns SET state_json=? WHERE user_id=?').run(JSON.stringify(funded),env.user);snap=env.store.snapshot(env.user);
 for(const feature of ['spikes','mesh','bell'])snap=act(env,snap,{type:'defense',zone:'gate',feature,price:{ap:1,materials:feature==='bell'?8:10}});snap=act(env,snap,{type:'craft',item:'trap',zone:'gate'});snap=act(env,snap,{type:'prepare'});
 const battle=createBattle(snap.state,'breach-save',{autoPause:false});battle.schedule=[];battle.challenge=null;battle.fires=[];battle.paused=false;battle.zones[0].hp=1;battle.enemies=[{id:'attack',type:'walker',zone:'gate',x:240,y:475,hp:100,max:100,mode:'attack',attack:4,stun:0,progress:0,called:false}];stepBattle(battle);assert.equal(battle.zones[0].hp,0);const saved=finish(env,snap,battle);
 for(const key of ['spikes','mesh','bell'])assert.equal(saved.state.zones[0][key],false);assert.equal(saved.state.zones[0].traps,0);assert.equal(saved.state.report.defenseLosses.length,1);assert.deepEqual(finish(env,snap,battle).state,saved.state);
 const reopened=openCampaignStore(env.path);assert.deepEqual(reopened.snapshot(env.user).state.zones,saved.state.zones);reopened.close();let next=act(env,saved,{type:'nextDay'});next=act(env,next,{type:'repair',zone:'gate'});assert.equal(next.state.zones[0].spikes,false);const before=next;next=act(env,next,{type:'defense',zone:'gate',feature:'spikes',price:{ap:1,materials:10}});assert.equal(next.state.resources.materials,before.state.resources.materials-10);assert.equal(next.state.zones[0].spikes,true);
});

test('legacy firewood is capped without read writes and old-browser excess settles once at the new capacity',t=>{
 const env=setup(t);let snap=act(env,env.store.snapshot(env.user),{type:'chooseRole',role:'repairman'});const legacy=structuredClone(snap.state);legacy.flags.campfireWood=3;env.observer.prepare('UPDATE campaigns SET state_json=?,dawn_json=? WHERE user_id=?').run(JSON.stringify(legacy),JSON.stringify(legacy),env.user);
 const version=env.observer.prepare('PRAGMA data_version').get().data_version;snap=env.store.snapshot(env.user);assert.equal(snap.state.flags.campfireWood,1);assert.equal(env.observer.prepare('PRAGMA data_version').get().data_version,version);assert.equal(JSON.parse(env.observer.prepare('SELECT state_json FROM campaigns WHERE user_id=?').get(env.user).state_json).flags.campfireWood,3);
 snap=act(env,snap,{type:'prepare'});const battle=createBattle(snap.state,'old-wood');assert.equal(battle.fires[0].wood,1);const result=settleNight(snap.state,battle);result.resources.materials--;result.flags.campfireWood=1.5;
 const request={runId:snap.runId,revision:snap.revision,nightId:`local-${snap.runId}-${snap.revision}`,orderModel:'temporary-v1',result},saved=env.store.finishClient(env.user,request);assert.equal(saved.state.flags.campfireWood,1);assert.deepEqual(env.store.finishClient(env.user,request).state,saved.state);
 const reopened=openCampaignStore(env.path);assert.equal(reopened.snapshot(env.user).state.flags.campfireWood,1);reopened.close();const next=act(env,saved,{type:'nextDay'});assert.equal(next.state.flags.campfireWood,1);
});

test('an already running old night can return its pre-cap pile and keep exactly one after saving',t=>{
 const env=setup(t);let snap=act(env,env.store.snapshot(env.user),{type:'chooseRole',role:'repairman'});snap=act(env,snap,{type:'prepare'});const raw=structuredClone(snap.state);raw.flags.campfireWood=3;env.observer.prepare('UPDATE campaigns SET state_json=? WHERE user_id=?').run(JSON.stringify(raw),env.user);snap=env.store.snapshot(env.user);assert.equal(snap.state.flags.campfireWood,1);
 const result=settleNight(snap.state,createBattle(snap.state,'old-full-pile'));result.flags.campfireWood=2.8;const request={runId:snap.runId,revision:snap.revision,nightId:`local-${snap.runId}-${snap.revision}`,orderModel:'temporary-v1',result};const saved=env.store.finishClient(env.user,request);assert.equal(saved.state.flags.campfireWood,1);assert.equal(saved.state.resources.materials,snap.state.resources.materials);assert.equal(env.store.finishClient(env.user,request).revision,saved.revision);
});
