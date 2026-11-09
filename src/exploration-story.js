import {SITES,COMPANIONS} from './content.js';
import {buildingOperational} from './building-health.js';

export const EXPLORATION_STORY_RULES={firstDay:2,chance:65,maxActive:2,replyDays:2,bondMax:6,trust:2,close:4,outingBond:1,storyBond:1};
const empty=()=>({version:1,pending:null,lastEncounterDay:0,seen:[],goals:[],bonds:{},outings:{},journal:[]});
export const explorationStory=s=>s.flags?.explorationStory||empty();
function writable(s){return s.flags.explorationStory||=(empty());}
const present=(s,id)=>s.people.find(p=>p.id===id&&!p.dead);
const bounded=(n,max=100)=>Math.max(0,Math.min(max,n));
function entry(s,text,person=null){const state=writable(s);state.journal.push({day:s.day,text,person});state.journal=state.journal.slice(-60);}
function memory(s,text){if(text&&!s.memories.includes(text))s.memories.push(text);}
export function bondStatus(s,id){
 const value=bounded(explorationStory(s).bonds[id]||0,EXPLORATION_STORY_RULES.bondMax);
 return {value,max:EXPLORATION_STORY_RULES.bondMax,label:value>=EXPLORATION_STORY_RULES.close?'彼此牵挂':value>=EXPLORATION_STORY_RULES.trust?'相互信赖':'慢慢熟悉'};
}
export function changeBond(s,id,amount,reason){
 if(!id||id==='hero'||!present(s,id))return;
 const state=writable(s),before=bondStatus(s,id).value;state.bonds[id]=bounded(before+amount,EXPLORATION_STORY_RULES.bondMax);
 if(before!==state.bonds[id])entry(s,`${present(s,id).name}：${reason}，关系${state.bonds[id]>before?'+':''}${state.bonds[id]-before}（${bondStatus(s,id).label}）。`,id);
}
export const activeExplorationGoals=s=>explorationStory(s).goals.filter(g=>g.status==='active');
export const EXPLORATION_GOALS={
 letter:{title:'替陌生人送一封家书',site:'contact',ap:0,cost:{},reward:{},memory:'真正送达的家书',reply:'联络点转来回信：写信的人已经和家人重逢。信封角落画着一盏亮着的灯。',task:'接受约定后，搜索社区联络点，再把信投入转交箱。'},
 medicine:{title:'把药送到桥边',site:'market',ap:0,cost:{medicine:1},reward:{medicine:2},memory:'桥边药房的谢笺',reply:'桥边药房留来一张谢笺，附上重新分装的护理用品。那位急需药物的邻居已稳定下来。',task:'接受约定后，搜索临时集市，带1药品给桥边药房。'},
 seeds:{title:'给后来者留一份种子',site:'pump',ap:1,cost:{water:1},reward:{food:2},memory:'写着来处的留种盒',reply:'试种的新芽立住了。你把少量收成和种子的来处一起记下，留给下一位照料菜畦的人。',task:'接受约定后，搜索泵站找干净育苗容器；院内还需一座可用菜畦，再花1行动、1净水试种。',garden:true},
 radio:{title:'让半截呼叫有回音',site:'contact',ap:1,cost:{parts:1},reward:{parts:2},memory:'被接住的呼叫',reply:'联络员转来答复：磁带里的小院已经收到接应信息。对方托人送回几件拆好的通信零件。',task:'接受约定后，搜索社区联络点，再花1行动、1零件修复并转交磁带。'},
 tools:{title:'循着箭头找工具箱',site:'shed',ap:0,cost:{},reward:{materials:2},memory:'陌生人画下的路',reply:'你沿标记找到了藏在屋檐下的工具箱。箱盖上还写着：拿走需要的，把路留下。',task:'接受约定后，搜索废弃工具棚，再沿墙上的箭头检查工具箱。',immediate:true},
 garden:{title:'循着花瓣找旧温室',site:'greenhouse',ap:0,cost:{},reward:{food:2},memory:'陌生人画下的路',reply:'花瓣标记通向一小片仍能采收的菜。你在旧地图上添了一个温室符号。',task:'接受约定后，搜索旧温室，再寻找花瓣标记留下的菜畦。',immediate:true}
};
const companionWords={
 lin:'林禾捡起一张印着花园名字的旧标签：“有人记得种子从哪里来，它们就不只是口粮。”',
 zhou:'老周收起一颗弯钉：“能修好的东西，最好别急着扔。人有时候也一样。”',
 chen:'陈岚看着路口的旧巡逻标记：“我想知道，当时留下这些记号的人后来去了哪里。”',
 xu:'许宁摸了摸磨损的药包：“有些名字，在登记册上只差一个收到的勾。”',
 yuan:'阿远把一条巷子描回地图：“每条绕路，起初都有人替后来的人试过。”',
 meng:'孟姐在空碗边抹去灰：“真正想带走的味道，往往不在食谱上。”'
};

export function encounterView(s){
 const e=explorationStory(s).pending;if(!e)return null;
 const companion=present(s,e.person),name=companion?.name,choice=(id,label,effect,extra={})=>({id,label,effect,ap:0,cost:{},...extra});
 const bondEffect=n=>{const gain=Math.min(n,EXPLORATION_STORY_RULES.bondMax-bondStatus(s,e.person).value);return gain?`关系+${gain}`:'关系已达上限';};
 const leave=choice('leave','记下位置，先回院子','不耗物资，不接受约定；本次见闻记入手记。');
 const goal=(id,label,type)=>choice(id,label,`接受目标「${EXPLORATION_GOALS[type].title}」。${EXPLORATION_GOALS[type].task}${EXPLORATION_GOALS[type].immediate?'完成后立即取得标记里的物资。':`完成后等待${EXPLORATION_STORY_RULES.replyDays}天收到后续。`}`,{goal:type});
 let title,text,choices;
 if(e.kind==='letter'){
  title='门缝里的一封家书';text='旧信封上没有邮票，只有一句：“如果有人要去联络点，请替我把平安带到。”信还干燥，地址仍能辨认。';
  choices=[goal('deliver','答应替它走完最后一段路','letter'),choice('keep','把信妥善收进手记','不接受递送目标，留下纪念「未寄出的家书」。',{memory:'未寄出的家书'}),leave];
 }else if(e.kind==='medicine'){
  title='药房留下的请求';text='诊所的值班纸条提到桥边一位需要换药的邻居。柜角还留着一份备用护理用品；你可以带走，也可以把自己的药送过去。';
  choices=[goal('promise','留下一句“我会去看看”','medicine'),choice('take','把备用药留给院里的伤员','立即获得1药品，不接受送药目标。',{gain:{medicine:1}}),leave];
 }else if(e.kind==='seeds'){
  title='一盒写着来处的种子';text='温室柜里有一份可留作试种的旧菜种，旁边记着采收日期。先找到干净容器，再种下去，才能知道它们是否还能发芽。';
  choices=[goal('plant','把来处和种子一起留住','seeds'),choice('food','先带上柜边的储备口粮','立即获得2食物，不接受试种目标。',{gain:{food:2}}),leave];
 }else if(e.kind==='radio'){
  title='只有半截的呼叫';text='工具棚的收录机里卡着一段磁带。一座陌生小院问过接应时间，回答却被噪声吞掉了。联络点也许能辨认录音里的位置。';
  choices=[goal('restore','把呼叫交给真正能回复的人','radio'),choice('parts','拆下收录机里的可用零件','立即获得1零件，不接受转报目标。',{gain:{parts:1}}),leave];
 }else if(e.kind==='landmark'){
  title='旧墙上的两种记号';text='工具箱形状的箭头指向废弃工具棚，褪色花瓣指向旧温室。旁边写着：“两条路都能走，看你更缺什么。”';
  choices=[goal('tools','沿工具箱箭头走','tools'),goal('garden','沿褪色花瓣走','garden'),leave];
 }else{
  title=name?`${name}没说完的话`:'同行路上的片刻';text=companionWords[e.person]||'你们在回院子的路上停了一会儿，有些话在安静下来后才说得出口。';
  choices=companion?[
   choice('listen','留一点时间，听完这段往事',`消耗1行动；与${name}${bondEffect(2)}，你们两人恐惧各−4。`,{ap:1,bond:2,fear:4}),
   choice('share','分一口水，再慢慢往回走',`消耗1净水；与${name}${bondEffect(1)}，你们两人恐惧各−6。`,{cost:{water:1},bond:1,fear:6}),
   choice('trust','把自己的牵挂也说给对方听',`需关系达到${EXPLORATION_STORY_RULES.trust}；不耗行动或物资，${bondEffect(1)}，两人恐惧各−4，留下专属同行纪念。`,{requiresBond:EXPLORATION_STORY_RULES.trust,bond:1,fear:4,memory:`与${name}说过的牵挂`}),leave
  ]:[leave];
 }
 return {...e,title,text,choices};
}

function roll(seed,day,site){let value=2166136261;for(const c of `${seed}:${day}:${site}:encounter`)value=Math.imul(value^c.charCodeAt(0),16777619);value^=value>>>16;return value>>>0;}
export function recordExplorationSearch(s,site,escort=null){
 if(!present(s,'hero')||s.people.find(p=>p.id==='hero')?.health<=0)return;
 const existing=s.flags.explorationStory;
 if(existing)for(const g of existing.goals)if(g.status==='active'&&EXPLORATION_GOALS[g.type].site===site&&!g.visited){g.visited=true;entry(s,`「${EXPLORATION_GOALS[g.type].title}」：已到访${SITES[site].name}，可在“见闻与约定”继续处理。`,g.person);}
 if(escort&&escort.health>0){const state=writable(s);if(state.outings[escort.id]!==s.day){state.outings[escort.id]=s.day;changeBond(s,escort.id,EXPLORATION_STORY_RULES.outingBond,`一起从${SITES[site].name}平安回来`);}}
 const state=explorationStory(s),rules=EXPLORATION_STORY_RULES;
 if(s.day<rules.firstDay||state.pending||state.lastEncounterDay===s.day)return;
 const bySite={alley:['letter','landmark'],shed:['radio','landmark'],clinic:['medicine'],greenhouse:['seeds'],market:['landmark'],pump:['landmark'],contact:['letter'],rescue:['landmark']};
 let pool=(bySite[site]||[]).filter(kind=>!state.seen.includes(kind));
 if(escort&&escort.health>0&&!state.seen.includes('shared-'+escort.id))pool.push('shared');
 if(!pool.length)return;const value=roll(s.seed,s.day,site);
 // The first eligible discovery is guaranteed; later discoveries use one fixed
 // outing roll. Reloading, deep/quick search and changing escort cannot reroll it.
 if(state.seen.length&&value%100>=rules.chance)return;
 const kind=pool[Math.floor(value/100)%pool.length],key=kind==='shared'?'shared-'+escort.id:kind;
 const target=writable(s);target.pending={id:`${s.day}-${site}-${key}`,kind,day:s.day,site,person:escort?.id||null};target.lastEncounterDay=s.day;target.seen.push(key);
 entry(s,`在${SITES[site].name}发现「${encounterView(s).title}」，还没有决定如何回应。`,escort?.id);
}

export function resolveExplorationChoice(s,a,{requireRule,useAP,gain,log}){
 const encounter=encounterView(s);requireRule(encounter&&encounter.id===a.encounter&&encounter.day===s.day,'这段见闻已经处理，或不属于今天。');
 const choice=encounter.choices.find(c=>c.id===a.choice);requireRule(choice,'没有这项见闻选择。');
 if(choice.goal)requireRule(activeExplorationGoals(s).length<EXPLORATION_STORY_RULES.maxActive,`最多同时记下${EXPLORATION_STORY_RULES.maxActive}个约定，可先完成或放下一个。`);
 if(choice.requiresBond)requireRule(bondStatus(s,encounter.person).value>=choice.requiresBond,'还需要多些共同经历，才能谈起这份牵挂。');
 useAP(choice.ap,choice.cost);
 if(choice.gain)gain(choice.gain,`见闻 · ${choice.label}`);
 if(choice.goal)writable(s).goals.push({id:encounter.id,type:choice.goal,person:encounter.person,acceptedDay:s.day,status:'active',visited:false});
 if(choice.memory)memory(s,choice.memory);
 if(choice.bond)changeBond(s,encounter.person,choice.bond,'认真回应了那段往事');
 if(choice.fear)for(const p of s.people)if(!p.dead&&(p.id==='hero'||p.id===encounter.person))p.fear=bounded(p.fear-choice.fear);
 entry(s,`「${encounter.title}」：${choice.label}。`,encounter.person);log(`见闻「${encounter.title}」：${choice.label}。`);writable(s).pending=null;
}

export function explorationGoalStatus(s,g){
 const def=EXPLORATION_GOALS[g.type];
 if(g.status==='awaiting')return {ready:false,text:`已完成，等待第${g.dueDay}天回音${g.dueDay>28?'（晚于救援，本轮不领取物资回礼）':''}`};
 if(g.status==='completed')return {ready:false,text:'后续已经记入手记'};
 if(g.status==='abandoned')return {ready:false,text:'已放下这份约定'};
 if(!g.visited)return {ready:false,text:`下一步：搜索${SITES[def.site].name}；接受之前的到访不计入这次约定`};
 if(def.garden&&!s.buildings.some(b=>b.type==='garden'&&buildingOperational(b)))return {ready:false,text:'容器已经找到，还需要一座可用菜畦'};
 return {ready:true,text:'地点条件已满足，可以履行约定'};
}
export function resolveExplorationGoal(s,a,{requireRule,useAP,gain,log}){
 const goal=explorationStory(s).goals.find(g=>g.id===a.goal);requireRule(goal&&goal.status==='active','这份约定已经处理，或不存在。');const def=EXPLORATION_GOALS[goal.type];
 if(a.abandon===true){goal.status='abandoned';entry(s,`放下「${def.title}」：先照顾眼前的生活，也是一项决定。`,goal.person);log(`放下约定「${def.title}」，不额外扣除物资或关系。`);return;}
 const status=explorationGoalStatus(s,goal);requireRule(status.ready,status.text);useAP(def.ap,def.cost);
 goal.completedDay=s.day;goal.dueDay=s.day+(def.immediate?0:EXPLORATION_STORY_RULES.replyDays);goal.status=def.immediate?'completed':'awaiting';
 changeBond(s,goal.person,2,'一起兑现了约定');
 if(def.immediate){gain(def.reward,`兑现约定 · ${def.title}`);memory(s,def.memory);entry(s,def.reply,goal.person);}
 else entry(s,`已履行「${def.title}」，第${goal.dueDay}天再等一等回音${goal.dueDay>28?'；晚于救援，本轮不领取物资回礼':''}。`,goal.person);
 log(`已履行约定「${def.title}」${def.immediate?'，收获已带回':`，回音预计第${goal.dueDay}天抵达`}。`);
}

export function advanceExplorationMorning(s,{gain,log}){
 const state=s.flags.explorationStory;if(!state)return;
 if(state.pending&&state.pending.day<s.day){entry(s,`没有在「${encounterView(s).title}」停留，回院后的生活先占满了这一天。`,state.pending.person);state.pending=null;}
 for(const goal of state.goals)if(goal.status==='awaiting'&&goal.dueDay<=s.day){
  const def=EXPLORATION_GOALS[goal.type];goal.status='completed';gain(def.reward,`见闻回音 · ${def.title}`);memory(s,def.memory);entry(s,def.reply,goal.person);log(`见闻回音「${def.title}」：${def.reply}`);
 }
}

export function explorationEnding(s){
 const state=explorationStory(s);
 return {completed:state.goals.filter(g=>g.status==='completed').map(g=>EXPLORATION_GOALS[g.type].title),waiting:state.goals.filter(g=>g.status==='awaiting').map(g=>EXPLORATION_GOALS[g.type].title),unfinished:state.goals.filter(g=>g.status==='active').map(g=>EXPLORATION_GOALS[g.type].title),bonds:COMPANIONS.filter(c=>(state.bonds[c.id]||0)>=EXPLORATION_STORY_RULES.trust).map(c=>({name:c.name,...bondStatus(s,c.id)}))};
}
