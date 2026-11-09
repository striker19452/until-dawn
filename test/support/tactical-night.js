import {createTestSession} from '../../src/test-mode.js';
import {createBattle,stepBattle,battleCommand,inner} from '../../src/battle.js';
import {settleNight} from '../../src/campaign.js';
import {validateClientResult} from '../../src/client-result.js';
import {ZONES} from '../../src/content.js';

// Isolated night fixtures: supplied resources are intentional. Campaign economy
// is covered separately; this audit measures posting, rest and real commands.
export function tacticalNight({day,seed=53,role='watchman',policy='prepared',fatigue=0,size=5,defenses=false,debug=false}={}){
 const base=structuredClone(createTestSession({day,seed,role,preset:size===1?'solo':'crew'}).snapshot.state);
 base.people=base.people.slice(0,size);base.flags.campfireWood=1;
 let postingSeed=(seed+day*7919)>>>0;
 for(const [i,p]of base.people.entries()){
  p.fatigue=fatigue;p.nightRole='guard';p.fear=8;
  postingSeed=(Math.imul(postingSeed,1664525)+1013904223)>>>0;
  p.zone=policy==='stacked'?'gate':policy==='random'?ZONES[Math.floor(postingSeed/4294967296*5)].id:ZONES[i].id;
 }
 if(policy==='prepared'){
  // Preparations use only the daily preview and each costs the ordinary
  // materials/AP. The isolated fixture starts at ready, so charge them here.
  const plans={8:[['backRight','mesh'],['right','mesh']],11:[['right','traps',2]],16:[['backLeft','mesh']],17:[['backRight','mesh'],['backLeft','mesh']],19:[['backRight','mesh'],['backLeft','mesh'],['gate','traps',2]],22:[['backRight','mesh'],['backLeft','spikes'],['backLeft','traps',2]],23:[['gate','traps',3]],24:[['backLeft','spikes'],['right','traps',2]],25:[['backRight','mesh'],['backLeft','mesh']]};
  for(const [id,feature,count]of plans[day]||[]){const z=base.zones.find(z=>z.id===id);z[feature]=count||true;base.resources.materials-=feature==='traps'?2*count:10;}
  if([12,13,18,20,22,24].includes(day)){
   const front=day===20||day===24?'right':day===12?'left':'backLeft',other=base.people.find(p=>p.zone===front),hero=base.people[0];if(other)other.zone=hero.zone;hero.zone=front;
  }
  if(day===23&&size>=3){base.people.find(p=>p.id==='chen').zone='gate';const repair=base.people.find(p=>p.id==='zhou');repair.zone='gate';repair.nightRole='support';}
 }
 if(defenses)for(const z of base.zones){z.spikes=true;z.mesh=true;z.traps=1;}
 const b=createBattle(base,'tactics-audit',{autoPause:false});b.paused=false;
 const commands=[],errors=[];let throws=0,repairs=0;
 const issue=(p,type,target)=>{try{battleCommand(b,{type,person:p.id,target});commands.push({at:Number(b.elapsed.toFixed(2)),person:p.id,type,target});if(type==='throw')throws++;if(type==='repair'||type==='barricade')repairs++;return true;}catch(error){errors.push(error.message);return false;}};
 for(let tick=0;tick<12000&&!b.finished;tick++){
  if(policy==='prepared'&&tick%10===0){
   for(const id of base.people.map(p=>p.id)){
    const p=b.people.find(p=>p.id===id);if(p.dead||p.wound==='severe'||p.task&&p.task.type!=='guard')continue;
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
 if(debug)return {base,b,commands,errors};
 const result=settleNight(base,b);validateClientResult(base,result);
 return {day,seed,role,policy,fatigue,size,defenses,finished:b.finished,phase:result.phase,cleared:b.challenge.status==='cleared',elapsed:Number(b.elapsed.toFixed(2)),house:Number(b.house.toFixed(1)),breaches:b.breaches,entered:b.challenge.entered,reinforcements:b.reinforcements,sprays:b.challenge.sprays||0,spores:b.challenge.sporeBursts||0,feedback:b.challenge.feedback,commands:commands.length,throws,errors,boss:b.boss?{defeated:b.boss.defeated,revives:b.boss.revives,sealed:b.boss.sealed,followerReleased:!!b.boss.followerReleased}:null,seen:result.flags.seenTypes};
}
