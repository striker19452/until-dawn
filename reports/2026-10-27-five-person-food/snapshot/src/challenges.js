import {formatDurability} from './format.js';
import { ZONES } from './content.js';
import {bossForDay} from './boss-content.js';
import {NIGHT_PACING} from './night-pacing.js';
// These are encounters, not extra random enemies. They replace part of the normal
// invasion budget. Every objective accepts preparation as well as live commands.
const calendar=[
 ['门前的第一声','gate','walker',1,'hold','先守正门，熟悉修补与巡守。'],
 ['左右之间','left','walker',2,'split','左栏之后右栏来袭，提前换位或两边布防。'],
 ['墙头的长影','backLeft','climber',1,'exclude','翻刺可挡攀爬；也能集中驱赶，在翻入前解决。'],
 ['回头的脚步','gate','walker',2,'hold','正门两次试探相隔8秒，别急着撤走守卫。'],
 ['两处抓痕','right','climber',2,'split','右栏与后左栏先后出现攀爬者，陷阱能争取赶路时间。'],
 ['短促的围攻','left','walker',3,'hold','三只灰行者集中左栏，备好修补或用投掷同时打断。'],
 ['第一次迁徙','gate','walker',3,'house','正门集中迁徙；可守外栏，也可有计划退守小屋。'],
 ['晚来的攀爬者','backRight','climber',2,'exclude','后右栏的攀爬者较晚到达，给夜班留下体力。'],
 ['沉重的一击','gate','rammer',1,'exclude','重撞每4秒一次：陷阱、顶住、投掷或集中巡守皆可。'],
 ['前重后轻','gate','rammer',2,'split','正门重撞后，后左栏出现灰行者；不要只盯住正面。'],
 ['旧伤口的压力','right','rammer',1,'hold','重撞兽试探右栏。白天修好，再留出当夜维修材料。'],
 ['不能放任的叫声','left','caller',1,'silence','蓄叫3.5秒会召援，攻击削减进度，投掷能清零。'],
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
export function dailyChallenge(s){
 const boss=bossForDay(s.day);if(boss){const zone=s.day===28&&s.flags.route==='river'?'backLeft':boss.zone,starts=NIGHT_PACING.challengeStart;return {id:`night-${s.day}`,day:s.day,title:`首领 · ${boss.name}`,zone,other:zone==='backLeft'?'backRight':'right',type:boss.id,count:1,replacementSlots:s.day===28?4:3,goal:'boss',boss:boss.id,hint:boss.warning,starts,strength:1,objective:`击退${boss.name}，全员无新增重伤并清除本夜来敌`,reward:'完成后建材+1、全员恐惧−4',waves:[{at:starts,type:boss.id,zone}]};}
 const [title,defaultZone,type,count,goal,hint]=calendar[s.day-1];
 const zone=s.day===28&&s.flags.route==='river'?'backLeft':defaultZone;
 const other=secondaryZones[s.day]||(zone==='gate'?'backLeft':zone==='backRight'?'gate':ZONES[(ZONES.findIndex(z=>z.id===zone)+2)%5].id);
 const c={
  id:`night-${s.day}`,day:s.day,title,zone,other,type,count,goal,hint,
  starts:s.day===1?NIGHT_PACING.firstChallenge:NIGHT_PACING.challengeStart,
  strength:s.day<7?1:s.day<14?1.6:s.day<21?2:2.4,
  objective:goal==='silence'?'阻止本夜所有召援并清除来敌':
   goal==='exclude'?'拦住挑战生物，不让它们入院':
   goal==='house'?'房屋耐久至少保留70':
   goal==='split'?'两个重点防区都没有被打穿':
   `守住${ZONES.find(z=>z.id===zone).name}，不被打穿`,
  reward:'完成后建材+1、全员恐惧−4'
 };
 const types=mixed[s.day]||Array(c.count).fill(c.type);
 c.waves=types.map((type,i)=>{
  const destination=c.goal==='split'||mixed[s.day]?(i%2?c.other:c.zone):c.zone;
  return {at:c.starts+i*(c.count>=3?NIGHT_PACING.groupGap:NIGHT_PACING.pairGap),type,
   zone:type==='burrower'&&!destination.startsWith('back')?'backRight':destination};
 });
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
export function resolveChallenge(b){const c=b.challenge;if(!c)return;const survived=b.house>0&&c.newSevere===0&&!c.newDeaths;
 if(c.goal==='boss'){const success=survived&&b.boss?.defeated===true;c.status=success?'cleared':'missed';c.bossDefeated=b.boss?.defeated===true;c.feedback=success?`你击退了${c.title.replace('首领 · ','')}，并平安清除了本夜来敌。`:b.house<=0?'小屋失守；留出修补材料，并在首领露出弱点时集中攻击。':c.newDeaths?'有人在夜战中死亡；重伤后仍须撤退或急救。':c.newSevere?'有人新增重伤；完成机制时也要留意健康和撤退。':'首领尚未击退；查看机制提示，利用破绽再挑战。';return;}
 const success=survived&&(c.goal==='silence'?b.reinforcements===0:c.goal==='exclude'?c.entered===0&&c.spawned>0:c.goal==='house'?b.house>=70:!c.broken.some(z=>z===c.zone||c.goal==='split'&&z===c.other));
 c.status=success?'cleared':'missed';c.feedback=success?(c.goal==='silence'?'你成功压住了叫声，没有让增援扩大这场围攻。':c.goal==='exclude'?'你拦住了挑战生物，没有让它们进入院子。':c.goal==='house'?`你在混合冲击中保住了${formatDurability(b.house)}点房屋耐久。`:'你守住了重点防区，没有留下破口。'):b.house<=0?'小屋失守；重试时先留维修材料。':c.newDeaths?'有人在夜战中死亡；重伤后仍须撤退或急救。':c.newSevere?'有人新增重伤；及时轮休、撤退或急救。':c.goal==='silence'?'叫声成功引来增援；下次优先打断正在蓄叫的生物。':c.goal==='exclude'?'挑战生物进入了院子；提前布防或在特殊动作完成前打断。':c.goal==='house'?'小屋不足70耐久；可提前修屋，或夜间加固。':'重点防区被打穿；分配维修人员、陷阱或提前转移巡守。';
}
