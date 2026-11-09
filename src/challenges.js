import {CHALLENGE_REWARD} from './balance.js';
import {formatDurability} from './format.js';
import { ZONES,ENEMIES,ENEMY_WINDUP } from './content.js';
import {bossForDay} from './boss-content.js';
import {NIGHT_PACING} from './night-pacing.js';
export const CHALLENGE_RULES={houseMinimum:70};
// These are encounters, not extra random enemies. They replace part of the normal
// invasion budget. Every objective accepts preparation as well as live commands.
const calendar=[
 ['门前的第一声','gate','walker',1,'hold','先守正门，熟悉修补与巡守。'],
 ['左右之间','left','walker',2,'split','左栏之后右栏来袭，提前换位或两边布防。'],
 ['墙头的长影','backLeft','climber',1,'exclude','翻刺可挡攀爬；也能集中驱赶，在翻入前解决。'],
 ['回头的脚步','gate','walker',2,'hold','留意两次试探之间的间隔。'],
 ['两处抓痕','right','climber',2,'split','右栏与后左栏先后出现攀爬者，陷阱能争取赶路时间。'],
 ['短促的围攻','left','walker',3,'hold','三只灰行者集中左栏，备好修补或分派成员重击重点目标。'],
 ['第一次迁徙','gate','walker',3,'house','正门集中迁徙；可守外栏，也可有计划退守小屋。'],
 ['晚来的攀爬者','backRight','climber',2,'exclude','后右栏的攀爬者较晚到达，给夜班留下体力。'],
 ['沉重的一击','gate','rammer',1,'exclude','用陷阱、顶住、重击或集中巡守应对重撞。'],
 ['前重后轻','gate','rammer',2,'split','正门重撞后，后左栏出现灰行者；不要只盯住正面。'],
 ['旧伤口的压力','right','rammer',1,'hold','重撞兽试探右栏。白天修好，再留出当夜维修材料。'],
 ['不能放任的叫声','left','caller',1,'silence','打断蓄叫，阻止增援。'],
 ['远处的回应','backLeft','caller',2,'silence','两只啼叫者先后到达，先处理正在蓄叫的一只。'],
 ['两个方向的迁徙','gate','rammer',3,'house','重撞在前、攀爬在后。分批防守，允许有控制地放弃围栏。'],
 ['接应路旁的围攻','right','climber',3,'hold','右栏连续攀爬，翻刺可长期抵挡，巡守与陷阱也能应对。'],
 ['松土下的第一道影','backLeft','burrower',1,'exclude','埋网阻止浅掘；无埋网时压实土道，再集中驱赶。'],
 ['另一侧的松土','backRight','burrower',2,'hold','后右栏连续浅掘，压实效果可维持整夜。'],
 ['先叫后掘','backLeft','caller',2,'silence','先打断后左栏叫声，再应对后右栏浅掘，别让增援滚大。'],
 ['围栏与土道','backRight','burrower',3,'split','后右栏掘行兽之后正门重撞；两种防线需要不同准备。'],
 ['火光里的湿影','right','quencher',1,'house','中央火塘可减轻喷污，清理可恢复火效；无火也可直接巡守。'],
 ['被压低的火光','left','quencher',3,'house','先压火再重撞。及时清理中央篝火，或转为陷阱防守。'],
 ['叫声掩护的挖掘','backLeft','caller',3,'silence','先叫后掘再叫，提前埋网能腾出人员打断召援。'],
 ['前门的三次试探','gate','rammer',3,'hold','三次重撞分批抵达，陷阱会用完；留出顶住或维修方案。'],
 ['信号下的来客','right','caller',3,'split','右栏叫声与后左栏攀爬交替，支援别全留在同一区。'],
 ['最后的松土','backRight','burrower',3,'exclude','最后一组掘行兽。埋网或压实后，留一人处理其他方向。'],
 ['火与重足迹','left','quencher',3,'house','涎囊兽与重撞兽配合，火不是唯一解；先保小屋。'],
 ['留给黎明的门','gate','climber',3,'hold','攀爬者反复试门，提前布防，把夜间时间留给最后补修。'],
 ['等到天亮','gate','rammer',4,'house','接应方向出现混合冲击。完成路线准备可额外布置陷阱。']
];
const secondaryZones={2:'right',5:'backLeft',10:'backLeft',14:'backLeft',18:'backRight',19:'gate',21:'backLeft',22:'backRight',24:'backLeft',26:'backLeft'};
const mixed={10:['rammer','walker'],14:['rammer','climber','walker'],18:['caller','burrower'],19:['burrower','rammer','burrower'],21:['quencher','rammer','climber'],22:['caller','burrower','caller'],24:['caller','climber','caller'],26:['quencher','rammer','quencher'],28:['rammer','caller','burrower','quencher']};
// Real outcomes, rather than a prescribed input sequence. Traps, good posting,
// fresh reserves and live orders remain interchangeable ways to solve a night.
const tactics={
 1:{floor:35,hint:'先把人留在正门，结束时正门至少35耐久；可白天修补，也可夜间补修。'},
 2:{floor:55,waves:[['walker','left',0],['walker','right',0]],hint:'左右同时受压：两侧留人，或一边陷阱、一边巡守。全挤正门会浪费往返时间。'},
 3:{hint:`攀爬者到达后左栏后，基础翻越耗时${ENEMY_WINDUP.climb}秒。提前派人拦截，或安装翻刺阻止翻越；临时从正门赶来很容易迟到。`},
 4:{floor:55,waves:[['walker','gate',0],['walker','gate',10]],hint:'正门两次试探相隔10秒；别见第一只倒下就把人调走，间隙可修补、恢复体力。'},
 5:{goal:'exclude',waves:[['climber','right',0],['climber','backLeft',1]],hint:'右栏、后左栏近乎同时攀爬：提前分站，或翻刺守一侧。赶路要计入翻越窗口。'},
 6:{floor:60,waves:[['walker','left',0],['walker','left',0],['walker','left',3]],hint:'左栏三只成团，单人会耗空体力。近侧两人配合、分派成员重击或多层陷阱可提高效率。'},
 8:{goal:'exclude',waves:[['bladebeast','backRight',0],['bladebeast','right',6]],hint:'新来的镰足兽会跳过翻刺。后右先拦、右栏接应；埋网拖慢蓄跳，低疲劳预备队换防更快。'},
 9:{goal:'hold',floor:70,hint:'正门至少保住70耐久；重撞4秒一次。提前陷阱、顶住或重击打断，比受撞后追着修更省时。'},
 10:{floor:55,waves:[['rammer','gate',0],['bladebeast','backLeft',3]],hint:'正门重撞牵制，3秒后后左镰足突袭；正面有人顶住时，另留一名后场接应。'},
 11:{floor:75,hint:'右栏最后至少75耐久。维修者别和驱赶者抢同一段时间，白天先修满可留下容错。'},
 12:{hint:'左栏啼叫只蓄3.5秒。人先到再驱赶，或在蓄叫开始时重击；赶路加作业才是真实用时。'},
 13:{waves:[['caller','backLeft',0],['caller','backRight',2]],hint:'两后栏仅隔2秒蓄叫；分站可免去往返。若用一人连续重击，应保持低疲劳，并提前靠近两栏之间。'},
 15:{floor:70,waves:[['shellcrab','right',0],['bladebeast','right',7],['shellcrab','right',14]],hint:'甲缝螯挡住正面驱赶，镰足随后突入。分开站位夹击甲缝，或重击破甲；同侧扎堆伤害只有30%。'},
 16:{hint:'后左栏浅掘只需3秒，看到开挖才从正门跑来已晚；提前埋网、压实，或派人驻后栏。'},
 17:{goal:'exclude',waves:[['burrower','backRight',0],['burrower','backLeft',2]],hint:'后右、后左接连浅掘；压实一边、守住另一边，别让所有人同时跑去压同一处土。'},
 18:{waves:[['caller','backLeft',0],['burrower','backRight',1]],hint:'左后叫声与右后浅掘同时推进；埋网替右后值守，腾出低疲劳的人处理3.5秒蓄叫。'},
 19:{floor:55,waves:[['burrower','backRight',0],['rammer','gate',4],['burrower','backLeft',8]],hint:'右后、正门、左后三段接力。两后栏提前防掘，留机动队处理中间重撞，避免整队来回跑。'},
 20:{goal:'cleanFire',waves:[['quencher','right',0]],hint:'不让涎囊喷污成功；右栏先截住，重击重置4秒蓄势。清理湿污只能补救火效，不能撤销已喷污的记录。'},
 22:{goal:'control',waves:[['sporetoad','backLeft',0],['burrower','backRight',2],['caller','backLeft',6]],hint:'后左先清雾囊蟾，再压叫声；后右预先防掘。整队挤在孢雾里会一起掉体力，轮休后的截击者更稳。'},
 23:{floor:65,waves:[['rammer','gate',0],['rammer','gate',9],['rammer','gate',18]],hint:'三次重撞相隔9秒；陷阱是消耗品，保留低疲劳维修者和顶住体力，结束时正门至少65耐久。'},
 24:{goal:'silence',waves:[['caller','right',0],['climber','backLeft',2],['caller','right',9]],hint:'右栏第一声与第二声之间夹着后左攀爬；右栏不能撤空，后左交给翻刺或预备队。'},
 25:{waves:[['burrower','backRight',0],['burrower','backLeft',2],['burrower','backRight',7]],hint:'两后栏交替三次浅掘；压实或埋网负责持续防掘，守卫负责击退，别只处理第一批。'},
 26:{house:85,waves:[['quencher','left',0],['rammer','gate',2],['sporetoad','backLeft',4]],hint:'喷污、重撞与孢雾三路牵制，小屋须剩85耐久。提前安排三处值守，疲劳队员别同时承担抢修和打断。'},
 27:{goal:'exclude',waves:[['climber','gate',0],['bladebeast','left',2],['climber','backRight',4]],hint:'正门、左栏、后右三路最后演练；翻刺挡攀爬、埋网拖镰足，把精力留给没有永久防御的方向。'}
};
export function dailyChallenge(s){
 const boss=bossForDay(s.day);if(boss){const zone=s.day===28&&s.flags.route==='river'?'backLeft':boss.zone,starts=NIGHT_PACING.challengeStart;return {id:`night-${s.day}`,day:s.day,required:true,title:`首领 · ${boss.name}`,zone,other:zone==='backLeft'?'backRight':'right',type:boss.id,count:1,replacementSlots:s.day===28?4:3,goal:'boss',boss:boss.id,hint:boss.warning+' 击退后还有一种新生物沿足迹接近。',starts,strength:1,objective:`击退${boss.name}及随后出现的新生物，全员无新增重伤并清除本夜来敌`,reward:`完成后建材+${CHALLENGE_REWARD.materials}、全员恐惧−${CHALLENGE_REWARD.fear}`,waves:[{at:starts,type:boss.id,zone}]};}
 const [title,defaultZone,type,count,defaultGoal,hint]=calendar[s.day-1],t=tactics[s.day],goal=t.goal||defaultGoal;
 const zone=s.day===28&&s.flags.route==='river'?'backLeft':defaultZone;
 const other=secondaryZones[s.day]||(zone==='gate'?'backLeft':zone==='backRight'?'gate':ZONES[(ZONES.findIndex(z=>z.id===zone)+2)%5].id);
 const c={
  id:`night-${s.day}`,day:s.day,required:true,title,zone,other,type,count,goal,hint:t.hint||hint,integrity:t.floor||0,houseMinimum:t.house||CHALLENGE_RULES.houseMinimum,
  starts:s.day===1?NIGHT_PACING.firstChallenge:NIGHT_PACING.challengeStart,
  strength:s.day<7?1:s.day<14?1.6:s.day<21?2:2.4,
  objective:goal==='silence'?'阻止本夜所有召援并清除来敌':
   goal==='exclude'?'拦住挑战生物，不让它们入院':
   goal==='house'?`房屋耐久至少保留${t.house||CHALLENGE_RULES.houseMinimum}`:
   goal==='cleanFire'?'阻止本夜所有喷污，并清除来敌':
   goal==='control'?'本夜无召援，孢雾最多释放1次，并清除来敌':
   goal==='split'?`两个重点防区全程不被打穿，结束时各至少${t.floor||0}耐久`:
   `守住${ZONES.find(z=>z.id===zone).name}，全程不被打穿，结束时至少${t.floor||0}耐久`,
  reward:`完成后建材+${CHALLENGE_REWARD.materials}、全员恐惧−${CHALLENGE_REWARD.fear}`
 };
 const types=mixed[s.day]||Array(c.count).fill(c.type);
 c.waves=types.map((type,i)=>{
  const destination=c.goal==='split'||mixed[s.day]?(i%2?c.other:c.zone):c.zone;
  return {at:c.starts+i*(c.count>=3?NIGHT_PACING.groupGap:NIGHT_PACING.pairGap),type,
   zone:type==='burrower'&&!destination.startsWith('back')?'backRight':destination};
 });
 if(t.waves)c.waves=t.waves.map(([type,zone,offset])=>({at:c.starts+offset,type,zone}));
 c.type=c.waves[0].type;c.zone=c.waves[0].zone;c.other=c.waves.find(w=>w.zone!==c.zone)?.zone||other;c.count=c.waves.length;
 if(s.day===8)c.title='镰足的接力';if(s.day===15)c.title='甲缝与侧翼';if(s.day===22)c.title='孢雾里的叫声';if(s.day===27)c.title='三面的最后演练';
 return c;
}
export function planChallenge(b,s){const c=dailyChallenge(s);b.challenge={...c,spawned:0,defeated:0,entered:0,broken:[],newSevere:0,status:'pending',feedback:''};

 // Keep the first reliably announced species. Replace the following budget slots.
 const start=s.day===1?0:1;b.schedule.splice(start,c.replacementSlots||c.count);
 for(const wave of c.waves)b.schedule.push({...wave,challenge:true});
 b.schedule.sort((a,d)=>a.at-d.at);
 // Replacing normal slots with an early challenge must not leave a long hole.
 let previous=0;for(const wave of b.schedule){wave.at=Math.min(wave.at,previous+NIGHT_PACING.maxGap);previous=wave.at;}
}
// Describe the checked outcomes separately from optional tactical advice.
export function challengeRequirements(c){
 const name=id=>ZONES.find(z=>z.id===id).name;
 const zones=[...new Set((c.waves||[{zone:c.zone}]).map(w=>w.zone))].map(name).join('、');
 const rules=[];
 if(c.goal==='hold'||c.goal==='split'){
  const targets=(c.goal==='split'?[c.zone,c.other]:[c.zone]).map(name).join('、');
  rules.push(`${targets}全程不能被打穿，结束时${c.goal==='split'?'各':''}至少${c.integrity||0}耐久；打穿后修好仍算失败。`);
 }else if(c.goal==='exclude'){
  const species=[...new Set((c.waves||[{type:c.type}]).map(w=>ENEMIES[w.type].name))].join('、');
  rules.push(`本夜挑战生物（${zones} · ${species}）不能入院；任何一只入院即失败，之后击退也不算。`);
 }else if(c.goal==='house')rules.push(`结束时小屋耐久至少${c.houseMinimum||CHALLENGE_RULES.houseMinimum}。`);
 else if(c.goal==='silence')rules.push('本夜不能发生任何召援；召援后再击退增援仍算失败。');
 else if(c.goal==='cleanFire')rules.push('本夜不能发生任何喷污；事后清理仍算失败。');
 else if(c.goal==='control')rules.push('本夜不能发生任何召援，孢雾最多释放1次。');
 else if(c.goal==='boss')rules.push(`击退${ENEMIES[c.boss].name}及随后出现的新生物。`);
 rules.push('全员无新增重伤、无人死亡，小屋耐久大于0；急救不能撤销重伤记录。');
 rules.push('击退全部来敌（含后续波次与增援）才结束，不是撑满固定时间。');
 return rules;
}
// Shared by the live objective notice and final feedback; never mutates battle state.
export function challengeProblems(b){
 const c=b.challenge;if(!c)return [];
 const problems=[];
 if(b.house<=0)problems.push({permanent:true,text:'小屋耐久归零'});
 if(c.newDeaths)problems.push({permanent:true,text:'有人死亡'});
 if(c.newSevere)problems.push({permanent:true,text:'本夜已有新增重伤，急救后也无法撤销记录'});
 const add=(test,text,permanent=true)=>{if(test)problems.push({text,permanent});};
 if(['hold','split'].includes(c.goal))for(const id of [...new Set(c.goal==='split'?[c.zone,c.other]:[c.zone])]){
  const z=b.zones.find(z=>z.id===id),name=ZONES.find(z=>z.id===id).name;
  if(c.broken.includes(id))add(true,`${name}曾被打穿，修好也无法撤销记录`);
  else add(z.hp<(c.integrity||0),`${name}耐久${formatDurability(z.hp)}，需至少${c.integrity||0}（还差${formatDurability((c.integrity||0)-z.hp)}）`,false);
 }
 add(['silence','control'].includes(c.goal)&&b.reinforcements>0,'已发生召援');
 add(c.goal==='exclude'&&c.entered>0,'挑战生物已入院');
 add(c.goal==='cleanFire'&&c.sprays>0,'喷污已经释放');
 add(c.goal==='control'&&c.sporeBursts>1,`孢雾已释放${c.sporeBursts}次，最多允许1次`);
 add(c.goal==='house'&&b.house<(c.houseMinimum||CHALLENGE_RULES.houseMinimum),`小屋耐久${formatDurability(b.house)}，需至少${c.houseMinimum||CHALLENGE_RULES.houseMinimum}`,false);
 return problems;
}
export function resolveChallenge(b){const c=b.challenge;if(!c)return;const survived=b.house>0&&c.newSevere===0&&!c.newDeaths;
 if(c.goal==='boss'){const success=survived&&b.boss?.defeated===true;c.status=success?'cleared':'missed';c.bossDefeated=b.boss?.defeated===true;c.feedback=success?`你击退了${c.title.replace('首领 · ','')}，并平安清除了本夜来敌。`:b.house<=0?'小屋失守；留出修补材料，并在首领露出弱点时集中攻击。':c.newDeaths?'有人在夜战中死亡；重伤后仍须撤退或急救。':c.newSevere?'有人新增重伤；完成机制时也要留意健康和撤退。':'首领尚未击退；查看机制提示，利用破绽再挑战。';return;}
 const intact=!c.broken.some(z=>z===c.zone||c.goal==='split'&&z===c.other)&&b.zones.filter(z=>z.id===c.zone||c.goal==='split'&&z.id===c.other).every(z=>z.hp>=(c.integrity||0));
 const success=survived&&(c.goal==='silence'?b.reinforcements===0:c.goal==='exclude'?c.entered===0&&c.spawned>0:c.goal==='house'?b.house>=(c.houseMinimum||CHALLENGE_RULES.houseMinimum):c.goal==='cleanFire'?!(c.sprays||0):c.goal==='control'?b.reinforcements===0&&(c.sporeBursts||0)<=1:intact);
 c.status=success?'cleared':'missed';c.feedback=success?(c.goal==='silence'?'你成功压住了叫声，没有让增援扩大这场围攻。':c.goal==='exclude'?'你拦住了挑战生物，没有让它们进入院子。':c.goal==='house'?`你在混合冲击中保住了${formatDurability(b.house)}点房屋耐久。`:c.goal==='cleanFire'?'你阻止了所有喷污。':c.goal==='control'?'你控制住了孢雾和召援。':'你守住了重点防区，并保留了要求的耐久。'):b.house<=0?'小屋失守；重试时先留维修材料。':c.newDeaths?'有人在夜战中死亡；重伤后仍须撤退或急救。':c.newSevere?'有人新增重伤；及时轮休、撤退或急救。':c.goal==='silence'?'叫声成功引来增援；下次优先打断正在蓄叫的生物。':c.goal==='exclude'?'挑战生物进入了院子；提前布防或在特殊动作完成前打断。':c.goal==='house'?`小屋不足${c.houseMinimum||CHALLENGE_RULES.houseMinimum}耐久；可提前修屋，或夜间加固。`:c.goal==='cleanFire'?'喷污已经释放；下次提前站在右栏，低疲劳人员重击更快。':c.goal==='control'?'孢雾超过1次或发生召援；分开值守，优先打断雾囊蟾和啼叫者。':`重点防区被打穿或结束时不足${c.integrity||0}耐久；分开值守、留出修补人员，避免整队无效赶路。`;
 if(!success&&['hold','split'].includes(c.goal)){const problems=challengeProblems(b);if(problems.length)c.feedback=problems.map(p=>p.text).join('；')+'。重试时提前分开布防，并留出修补人员。';}
}
