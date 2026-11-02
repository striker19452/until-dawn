import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,applyCampaignAction as act,settleNight} from '../src/campaign.js';
import {createBattle,stepBattle,battleCommand,inner} from '../src/battle.js';
import {ENEMIES,ZONES} from '../src/content.js';
import {BOSS_FORM_HEALTH} from '../src/boss-content.js';
import {bossStatus} from '../src/bosses.js';
import {validateClientResult} from '../src/client-result.js';
const day=()=>act(initialCampaign(53),{type:'chooseRole',role:'repairman'});
function fixture(){let s=day();s.day=24;s.resources.materials=100;s.people[0].nightRole='sleep';const base=act(s,{type:'prepare'}),b=createBattle(base,'loss',{autoPause:false});b.schedule=[{at:9999,type:'walker',zone:'gate'}];b.challenge=null;b.fires=[];b.paused=false;return {base,b};}
const enemy=(type,zone)=>({id:'attacker',type,zone:zone.id,x:zone.x,y:zone.y,hp:1000,max:1000,mode:'attack',attack:ENEMIES[type].interval,progress:0,stun:0,called:false});
test('spawn paths agree with the ordinary, boss and strengthened twin health values',()=>{
 const old={walker:23,climber:21,rammer:65,caller:26,burrower:30,quencher:32,bastion:76,broodmother:86,cinderwhale:96,twinvein:100};
 for(const [type,hp]of Object.entries(old)){
  assert.equal(ENEMIES[type].hp,hp*1.5*(ENEMIES[type].boss?2:1)*(type==='twinvein'?1.5:1),type);
  for(const challenge of [false,true]){const {b}=fixture();b.challenge={strength:2.4,spawned:0,defeated:0,entered:0,broken:[],status:'active',zone:'gate',starts:1000};b.schedule=[{at:0,type,zone:'gate',challenge}];stepBattle(b);assert.equal(b.enemies[0].hp,hp*1.5*(ENEMIES[type].boss?2:1)*(type==='twinvein'?1.5:1)*(challenge?2.4:1));assert.equal(b.enemies[0].max,b.enemies[0].hp);}
 }
 const {b}=fixture();b.enemies=[{...enemy('caller',ZONES[0]),progress:7}];stepBattle(b);const called=b.enemies.find(e=>e.type==='walker');assert.equal(called.hp,34.5);assert.equal(called.max,34.5);
 assert.deepEqual(BOSS_FORM_HEALTH,{brood:42,twin:108,revive:54});
});
test('destroying any fence removes all its attachments and traps immediately, without affecting neighboring zones or central fire',()=>{
 for(const zone of ZONES){const {b}=fixture();b.fires=[{id:'central',x:240,y:390,heat:0,wood:1,wet:0,enabled:false}];const z=b.zones.find(z=>z.id===zone.id);b.zones.forEach(q=>Object.assign(q,{spikes:true,mesh:true,bell:true,brazier:true,shade:true,traps:3}));z.hp=1;b.enemies=[enemy('walker',zone)];stepBattle(b);
  assert.equal(z.hp,0);for(const key of ['spikes','mesh','bell','brazier','shade'])assert.equal(z[key],false);assert.equal(z.traps,0);assert.equal(b.breaches,1);assert.equal(b.defenseLosses.length,1);assert.match(b.events.find(e=>e.type==='breach').text,/翻刺.*埋网.*铃绳.*陷阱×3.*损毁/);
  for(const q of b.zones.filter(q=>q!==z)){assert.equal(q.spikes,true);assert.equal(q.mesh,true);assert.equal(q.bell,true);assert.equal(q.traps,3);}
  assert.equal(b.fires[0].wood,1);stepBattle(b);assert.equal(b.defenseLosses.length,1);
 }
});
test('boss charge and burst use the same destruction rule; split HUD uses the increased body maxima',()=>{
 for(const day of [7,21]){let s=day===7?act(initialCampaign(53),{type:'chooseRole',role:'repairman'}):act(initialCampaign(97),{type:'chooseRole',role:'repairman'});s.day=day;s.people[0].nightRole='sleep';const b=createBattle(act(s,{type:'prepare'}),'boss-loss',{autoPause:false});b.schedule=[{at:0,type:day===7?'bastion':'cinderwhale',zone:b.boss.zone}];b.paused=false;stepBattle(b);const e=b.enemies.find(e=>e.boss),z=b.zones.find(z=>z.id===e.zone),p=ZONES.find(p=>p.id===z.id);Object.assign(e,{x:p.x,y:p.y,mode:'attack'});Object.assign(z,{hp:1,mesh:true,bell:true,spikes:true,traps:2});b.boss.phase=day===7?'charge':'siphon';b.boss.clock=day===7?4.99:7.99;stepBattle(b);assert.equal(z.hp,0);assert.equal(z.traps,0);assert.equal(z.spikes,false);assert.equal(z.mesh,false);assert.equal(z.bell,false);}
 let s=day();s.day=28;const b=createBattle(act(s,{type:'prepare'}),'hud');assert.equal(bossStatus(b).max,450);b.boss.split=true;assert.equal(bossStatus(b).max,324);
});
test('loss persists through settlement and morning; fence repair does not restore attachments and reinstall charges full price',()=>{
 const {base,b}=fixture();Object.assign(base.zones[0],{spikes:true,mesh:true,bell:true,traps:3});Object.assign(b.zones[0],base.zones[0],{hp:1});b.enemies=[enemy('walker',ZONES[0])];stepBattle(b);b.enemies=[];b.schedule=[{at:9999,type:'walker',zone:'gate'}];const saved=settleNight(base,b);validateClientResult(base,saved);assert.equal(saved.report.defenseLosses.length,1);const morning=act(saved,{type:'nextDay'});morning.resources.materials=100;
 for(const action of [{type:'defense',zone:'gate',feature:'spikes'},{type:'craft',item:'trap',zone:'gate'}])assert.throws(()=>act(morning,action),/先修补护栏/);
 const fixed=act(morning,{type:'repair',zone:'gate'});assert.equal(fixed.zones[0].spikes,false);assert.equal(fixed.zones[0].traps,0);const reinstalled=act(fixed,{type:'defense',zone:'gate',feature:'spikes'});assert.equal(reinstalled.zones[0].spikes,true);assert.equal(reinstalled.resources.materials,fixed.resources.materials-10);assert.equal(reinstalled.ap,fixed.ap-1);
});
test('night repairs and legacy zero-health preparations cannot revive destroyed attachments',()=>{
 const {base,b}=fixture();Object.assign(base.zones[0],{hp:0,spikes:true,mesh:true,bell:true,traps:2});const started=createBattle(base,'old');assert.equal(started.zones[0].spikes,false);assert.equal(started.zones[0].traps,0);
 Object.assign(b.zones[0],{hp:0,spikes:false,mesh:false,bell:false,traps:0});b.enemies=[];const p=b.people[0];Object.assign(p,inner(ZONES[0]));battleCommand(b,{type:'repair',person:p.id,target:'gate'});b.people[0].task.stage='work';for(let i=0;i<100;i++)stepBattle(b);assert.ok(b.zones[0].hp>0);assert.equal(b.zones[0].spikes,false);assert.equal(b.zones[0].traps,0);
 base.phase='day';const fixed=act(base,{type:'repair',zone:'gate'});assert.equal(fixed.zones[0].spikes,false);assert.equal(fixed.zones[0].traps,0);
});
test('save validation accepts losses, repairs after losses and legacy broken fences, but rejects new attachments at night',()=>{
 const {base,b}=fixture();Object.assign(base.zones[0],{spikes:true,mesh:true,bell:true,traps:2});Object.assign(b.zones[0],base.zones[0],{hp:20,spikes:false,mesh:false,bell:false,traps:0});const result=settleNight(base,b);assert.equal(validateClientResult(base,result).zones[0].spikes,false);
 const added=structuredClone(result);added.zones[1].spikes=true;assert.throws(()=>validateClientResult(base,added),/不能新建/);
 const legacy=structuredClone(result);Object.assign(legacy.zones[0],{hp:0,spikes:true,mesh:true,bell:true,traps:2});const fixed=validateClientResult(base,legacy);assert.equal(fixed.zones[0].spikes,false);assert.equal(fixed.zones[0].traps,0);
});
