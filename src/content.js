import {facilityDescription} from './descriptions.js';
import {RATIONS,PRODUCTION,WORK,DAY_ACTIONS} from './balance.js';
import {SEARCH_RULES} from './search.js';
import {BOSS_SPECIES,bossForDay,BOSS_FORM_SPEED} from './boss-content.js';
import {weakestZone} from './skitter.js';
import {PHASE_CREATURES} from './phase-creatures.js';
export const RESOURCE_NAMES={food:'食物',water:'净水',materials:'建材',fuel:'燃料',medicine:'药品',parts:'零件'};
export const SKILLS=['survival','engineering','guard','exploration','medical'];
export const SKILL_NAMES={survival:'生存',engineering:'工程',guard:'守卫',exploration:'探索',medical:'护理'};
export const ROLES={repairman:{name:'修理工',skill:'engineering',intro:'会修补，也相信旧东西还有用。',bonus:{materials:4},maxStamina:110,staminaNote:'长期搬运和修理，耐力扎实。'},medic:{name:'医护人员',skill:'medical',intro:'先让人平安，再把日子过下去。',bonus:{medicine:3},maxStamina:100,staminaNote:'以救护为专长，体力保持标准水平。'},watchman:{name:'夜班保安',skill:'guard',intro:'熟悉夜里的动静，知道何时该退。',bonus:{fuel:3},maxStamina:120,staminaNote:'习惯长时间巡逻和值夜，体力充足。'}};
export const COMPANIONS=[
 {id:'lin',name:'林禾',role:'园艺师',skill:'survival',day:1,maxStamina:105,staminaNote:'长期打理菜畦，适应户外劳作。',get trait(){return `生存达到${WORK.farm.skill}级时，照料种植产${WORK.farm.skilled}食物`;},story:['她一直护着背包里的种子。','旧温室还留着社区共享的种子箱。','她把一包种子留在窗台：给下一个来到这里的人。'],site:'greenhouse',reward:'留种箱'},
 {id:'zhou',name:'老周',role:'维修师傅',skill:'engineering',day:3,maxStamina:85,staminaNote:'擅长维修，连续重体力作业需要轮休。',trait:'修补速度更快',story:['他带着一盏坏掉的应急灯。','工具棚里有修好旧灯的配件。','旧灯重新亮了。他终于把那张维修图画完。'],site:'shed',reward:'旧应急灯'},
 {id:'chen',name:'陈岚',role:'实习警察',skill:'guard',day:5,maxStamina:115,staminaNote:'有巡逻与体能训练基础。',trait:'驱赶更有效',story:['她在广播的救助名单里听到了带教警察的名字。','去联络点找找旧巡逻值班记录，也许能留下消息。','她在接应名单上为失联的带教警察留下了可追踪的线索。'],site:'contact',reward:'值班手记'},
 {id:'xu',name:'许宁',role:'社区护士',skill:'medical',day:8,maxStamina:95,staminaNote:'专长护理与急救，适合支援和轮休。',get trait(){return `稳定重伤少用${DAY_ACTIONS.treatment.discount}药`;},story:['未送达的药包已经有些磨损。','诊所留下的登记册也许记着收件人。','她把回信折好，压在急救包下面：总有人接住了这份心意。'],site:'clinic',reward:'急救手册'},
 {id:'yuan',name:'阿远',role:'快递员',skill:'exploration',day:10,maxStamina:130,staminaNote:'常年奔走送件，长途耐力最好。',get trait(){return `探索达到${SEARCH_RULES.skill}级时，随行主要物资再多${SEARCH_RULES.escortSkilledBonus}份；非雾天深搜擦伤降至${SEARCH_RULES.escortSkilledInjury}%`;},story:['他随身带着折过很多次的旧城地图。','那些没送完的信，也许还能在小巷里找到去处。','他在墙上画出一条安全路线，把最后一封信放进登记箱。'],site:'alley',reward:'安全路线图'},
 {id:'meng',name:'孟姐',role:'食堂厨师',skill:'survival',day:13,maxStamina:100,staminaNote:'习惯灶台持续劳作，体力稳健。',get trait(){return `有公共灶时夜末全员额外恐惧−${PRODUCTION.stove.mengFear}；白天掌灶当晚每人再省${RATIONS.cookSavingPerPerson}食物（全队最低需${RATIONS.minimumFood}）`;},story:['她问这里能不能借一个炉子。','集市里也许还剩一点调料和一口好锅。','撤离前，她给大家留了一顿热饭，也把食谱留在了墙上。'],site:'market',reward:'墙上的食谱'}
];
export const ZONES=[{id:'gate',name:'正门',x:240,y:475,ox:240,oy:625},{id:'left',name:'左栏',x:70,y:310,ox:-65,oy:310},{id:'right',name:'右栏',x:410,y:310,ox:545,oy:310},{id:'backLeft',name:'后左栏',x:145,y:170,ox:105,oy:25},{id:'backRight',name:'后右栏',x:335,y:170,ox:375,oy:25}];
export const BUILDINGS={
 garden:{name:'异变菜畦',cost:5,limit:2,get desc(){return facilityDescription('garden');}},
 water:{name:'集水过滤',cost:5,limit:2,get desc(){return facilityDescription('water');}},
 workshop:{name:'工作棚',cost:6,limit:1,get desc(){return facilityDescription('workshop');}},
 generator:{name:'发电设施',cost:7,limit:1,get desc(){return facilityDescription('generator');}},
 infirmary:{name:'医务角',cost:5,limit:1,get desc(){return facilityDescription('infirmary');}},
 watchtower:{name:'观察哨',cost:5,limit:1,get desc(){return facilityDescription('watchtower');}},
 stove:{name:'公共灶',cost:4,limit:1,get desc(){return facilityDescription('stove');}},
 exchange:{name:'互助留言处',cost:4,limit:1,get desc(){return facilityDescription('exchange');}}
};
export const JOBS={rest:'休息',farm:'照料种植',water:'过滤取水',craft:'制作陷阱',repair:'修补围栏',care:'照料伤员',scout:'侦察巡查',forage:'搜集燃料',get cook(){return `掌灶 · 孟姐专属，每人再省${RATIONS.cookSavingPerPerson}食物`;}};
export const NIGHT_ROLES={guard:'巡守',support:'支援修补添火',sleep:'睡眠'};
export const DEFENSES={spikes:{name:'翻刺',ap:1,cost:{materials:10}},mesh:{name:'埋网',ap:1,cost:{materials:10}},bell:{name:'铃绳',ap:1,cost:{materials:8}}};
export const SITES={
 alley:{name:'居民小巷',day:1,loot:{food:4,water:3,materials:2},desc:'基础食水，路程较短；雾天出行仍有风险。'},
 shed:{name:'废弃工具棚',day:1,loot:{materials:7,parts:1,fuel:1},desc:'木板、铁丝和可拆解零件。'},
 clinic:{name:'街角诊所',day:1,loot:{medicine:3,water:2},desc:'药品有可靠保底，深搜前会告知风险。'},
 greenhouse:{name:'旧温室',day:3,loot:{food:6,fuel:1},desc:'藤蔓已经爬满屋顶，可找到留种。'},
 market:{name:'临时集市',day:5,loot:{food:4,water:3,fuel:2},desc:'有限库存，可交换或寻找旧物。'},
 pump:{name:'泵站',day:7,loot:{water:7,materials:2,parts:1},desc:'旧蓄水仍可处理，修复后帮助邻里。'},
 contact:{name:'社区联络点',day:4,loot:{materials:2,fuel:1},desc:'登记箱与公告板；没有住宿和充足补给。'},
 rescue:{name:'北堤接应区',day:15,loot:{materials:4,fuel:3,parts:1},desc:'清理接应路线，按广播留下可见标记。'}
};
export const ENEMY_WINDUP={climb:6,dig:3,call:3.5,spray:4};
export const ENEMIES={
 walker:{name:'灰行者',day:1,hp:34.5,speed:18,damage:3,interval:1.55,warning:'巷口有成群脚印。中央篝火能在全场削弱普通生物的伤害。',color:0x657369},
 climber:{name:'攀爬者',day:3,hp:31.5,speed:44,agile:true,damage:2,interval:1.5,warning:'墙头有细长抓痕；翻刺和及时驱赶能阻止攀爬。',color:0x8d9271},
 rammer:{name:'重撞兽',day:9,hp:97.5,speed:12,damage:15,interval:4,warning:'发现重足迹，冲撞前会明显蓄力。路障可以打断冲势。',color:0x9d806a},
 caller:{name:'啼叫者',day:12,hp:39,speed:16,damage:2,interval:2,warning:'远处有反复叫声；重击或触发陷阱可打断蓄叫，普通攻击只造成短暂眩晕。',color:0x9b8a98},
 burrower:{name:'掘行兽',day:16,hp:45,speed:34,agile:true,damage:3,interval:2,warning:'松土有隆起。埋网、石板和压实土道可以阻挡浅掘。',color:0x9e8b6a},
 quencher:{name:'涎囊兽',day:20,hp:48,speed:15,damage:1.8,interval:2.5,warning:'湿冷黏液会压低中央篝火、暂停全场增益；及时驱赶、重击打断或清理湿污。',color:0x789a96},
 skitter:{name:'裂隙鼠',day:5,hp:12,speed:66,agile:true,damage:1.5,interval:1,warning:'细碎爪印绕着院墙寻找缺口：体型小、跑得极快、生命很低，偏爱破口、低耐久和少人少陷阱的防区。',color:0xc3ab80},
 ...PHASE_CREATURES,...BOSS_SPECIES
};
export function enemySpeed(enemy){
 if(enemy.type==='broodmother'&&enemy.bossBrood)return BOSS_FORM_SPEED.brood;
 if(enemy.type==='twinvein'&&enemy.bossForm>0)return BOSS_FORM_SPEED.twin;
 return ENEMIES[enemy.type].speed;
}
export function weather(day,seed=1){const n=(day*13+seed)%11;return n===2||n===7?'rain':n===4?'fog':n===9?'hot':'clear';}
export const WEATHER_NAMES={rain:'小雨',fog:'薄雾',hot:'晴热',clear:'晴间多云'};
export function enemyTypes(day){return Object.keys(ENEMIES).filter(k=>!ENEMIES[k].boss&&ENEMIES[k].day<=day);}
export function dailyIntel(s){const boss=bossForDay(s.day);if(boss)return {type:boss.id,name:boss.name,boss:true,confidence:'首领确认',text:boss.warning,direction:s.day===28&&s.flags.route==='river'?'backLeft':boss.zone,weather:weather(s.day,s.seed)};const kinds=enemyTypes(s.day),introduced=kinds.filter(k=>s.day-ENEMIES[k].day<2);const key=introduced.at(-1)||kinds[(s.day-1)%kinds.length],direction=key==='skitter'?weakestZone(s,ZONES):ZONES[(s.day+s.seed)%5].id;return {type:key,name:ENEMIES[key].name,confidence:'巡查确认',text:ENEMIES[key].warning,direction,weather:weather(s.day,s.seed)};}
export function broadcast(s){
 const d=s.day;let text=d===1?'这里是北堤救援频道。接应预计在二十八天后开启。保存体力，留在安全住所。我们会持续广播。':d<7?'各院落请维持警戒。异变植物生长加快，种植前请辨认种类，勿食来历不明的果实。':d<12?'社区登记箱正在收集住址、人数与需求。志愿者会转报，广播不提供即时回复。':d<15?'清障仍在继续。请保存登记编号，关注后续接应公告。':d<22?'旧路因暴雨受损。北堤公路与河岸便道均将设接应点，请选择路线并递交登记。':d<28?'接应窗口已经确认。请完成治疗、储备和轮休，二十八夜之后我们会抵达。':'最后一段广播：北堤队伍已经出发。天亮时按约定接应，请守好这一夜。';
 if(s.flags.registeredDay&&d>s.flags.registeredDay)text+=` 十七号院，${s.people.filter(p=>!p.dead).length}人，登记已收到。`;
 return text;
}
