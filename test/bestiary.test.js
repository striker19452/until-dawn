import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initialCampaign,applyCampaignAction,settleNight } from '../src/campaign.js';
import { createBattle,stepBattle } from '../src/battle.js';
import { ENEMIES } from '../src/content.js';
import { bestiaryEntries } from '../src/bestiary.js';
import { openStore } from '../src/store.js';
import { openCampaignStore } from '../src/campaign-store.js';

test('future availability, intel and planned attacks do not unlock unknown bestiary entries',()=>{
 let s=applyCampaignAction(initialCampaign(),{type:'chooseRole',role:'repairman'});s.day=28;
 s=applyCampaignAction(s,{type:'prepare'});const b=createBattle(s,'unknown');
 const before=structuredClone({s,b});
 assert.equal(bestiaryEntries(s,b).length,Object.keys(ENEMIES).length);
 for(const entry of bestiaryEntries(s,b))assert.deepEqual(entry,{id:entry.id,known:false});
 assert.deepEqual({s,b},before);
});

test('actual appearance instantly unlocks each species with its canonical combat stats',()=>{
 let s=applyCampaignAction(initialCampaign(),{type:'chooseRole',role:'repairman'});
 s=applyCampaignAction(s,{type:'prepare'});const b=createBattle(s,'encounters');
 b.challenge=null;
 for(const [id,enemy] of Object.entries(ENEMIES)){
  b.schedule=[{at:b.elapsed+.05,type:id,zone:'gate'}];b.paused=false;stepBattle(b);
  const entry=bestiaryEntries(s,b).find(e=>e.id===id);
  assert.equal(entry.known,true);assert.equal(entry.name,enemy.name);
  for(const key of ['hp','damage','interval','speed'])assert.equal(entry[key],enemy[key]);
 }
 assert.equal(bestiaryEntries(s,b).filter(e=>e.known).length,Object.keys(ENEMIES).length);
 const union=bestiaryEntries({flags:{seenTypes:['walker','walker','bogus']}},{seen:['climber']});
 assert.deepEqual(union.filter(e=>e.known).map(e=>e.id),['walker','climber']);
});

test('encounters stay in memory during the night and bestiary survives settlement and reopening SQLite',t=>{
 const dir=mkdtempSync(join(tmpdir(),'dawn-bestiary-')),file=join(dir,'game.sqlite');
 const legacy=openStore(file),player=legacy.createPlayer();let store=openCampaignStore(file);
 t.after(()=>{store.close();legacy.close();rmSync(dir,{recursive:true,force:true});});
 let snap=store.ensure(player.userId,player.snapshot);
 for(const action of [{type:'chooseRole',role:'watchman'},{type:'prepare'}])snap=store.action(player.userId,{runId:snap.runId,revision:snap.revision,requestId:randomUUID(),action});
 const b=createBattle(snap.state,'saved-encounter',{autoPause:false});b.paused=false;
 for(let i=0;i<200;i++)stepBattle(b);
 assert.ok(bestiaryEntries(snap.state,b).some(e=>e.known));
 assert.ok(bestiaryEntries(store.snapshot(player.userId).state).every(e=>!e.known));
 assert.equal(store.snapshot(player.userId).revision,snap.revision);
 for(let i=0;i<5000&&!b.finished;i++)stepBattle(b);assert.equal(b.finished,true);
 const saved=store.finishClient(player.userId,{runId:snap.runId,revision:snap.revision,nightId:`local-${snap.runId}-${snap.revision}`,result:settleNight(snap.state,b)});assert.ok(bestiaryEntries(saved.state).find(e=>e.id==='walker').known);
 store.close();store=openCampaignStore(file);
 const restored=store.snapshot(player.userId);
 assert.deepEqual(bestiaryEntries(restored.state),bestiaryEntries(saved.state));
 const next=applyCampaignAction(restored.state,{type:'nextDay'});
 assert.ok(bestiaryEntries(next).find(e=>e.id==='walker').known);
});
