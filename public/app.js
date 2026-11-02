import { createScene } from './scene.js';
import { paintIcons } from './icons.js';
const root=document.getElementById('first-light-game');
const q=selector=>root.querySelector(selector);
const scene=createScene(root);
let s=null, snapshot=null, busy=false, pending=null, timer=null, retryConfirm=false;
let statusError='', view='radio';
const STORAGE_KEY='dawn-pending-action-v1';
try { pending=JSON.parse(sessionStorage.getItem(STORAGE_KEY)||'null'); view=sessionStorage.getItem('dawn-view')||'radio'; } catch {}
const VIEWS=['radio','yard','members','explore','journal','gate','garden','workbench','home','visitor','story'];
if(!VIEWS.includes(view))view='radio';
 const btn=(action,label,primary=false,disabled=false)=>`<button class="fl-button cursor-interaction ${primary?'fl-emphasis':''}" data-do="${action}" ${disabled?'disabled':''}>${label}</button>`;
 const heading=(small,title,text='')=>`<div class="fl-eyebrow">${small}</div><h2>${title}</h2>${text?`<p class="fl-copy">${text}</p>`:''}`;
 const editable=()=>s.phase==='day';
 const people=()=>s.recruited?2:1;
 function yardPanel(){return heading('白天 · 慢慢安排','先把今晚过好',s.gate<60?'院门的木板有些松。附近的小巷还有物资，先出去看看，回来再修门。':'院门已经加固。还可以开垦菜地，或准备一只陷阱。今晚不会太平，但你有时间准备。')+`<div class="fl-row"><span>今晚预计来袭</span><strong>少量游荡生物</strong></div><div class="fl-row"><span>每日食物 / 饮水消耗</span><strong>各 ${people()} 份</strong></div><div class="fl-actions">${btn('explore','外出找物资',true)}${btn('gate','检查院门')}</div>`;}
 function memberPanel(){let html=heading('成员 '+people()+' / 5','一起把这里守住')+`<div class="fl-person"><div class="fl-avatar">你</div><div><strong>你 · 修理工</strong><p>白天行动 ${s.ap}/6 · 夜间负责守门</p></div></div>`;
 if(!s.recruited)return html+`<p class="fl-copy">另一个床位还空着。外出时，也许会遇见愿意同行的人。</p><div class="fl-actions">${btn('explore','去附近看看',true)}</div>`;
 html+=`<div class="fl-person"><div class="fl-avatar">禾</div><div><strong>林禾 · 社区园艺师</strong><p>擅长种植 · ${s.allyTired?'有些疲惫':'精神尚好'}</p></div></div>`;
 if(editable())html+=`<label>白天安排 · 黄昏统一结算<select id="fl-job"><option value="rest" ${s.job==='rest'?'selected':''}>休息 · 无额外消耗</option><option value="plant" ${s.job==='plant'?'selected':''} ${!s.garden?'disabled':''}>种植 · ${s.garden?'播下种子，后续收成':'需要先开垦菜地'}</option><option value="craft" ${s.job==='craft'?'selected':''} ${s.trap?'disabled':''}>制作陷阱 · 预留 2 材料</option><option value="repair" ${s.job==='repair'?'selected':''}>维修院门 · 预留 1 材料，耐久 +20</option></select></label><label>夜间安排<select id="fl-night-job"><option value="support" ${s.nightJob==='support'?'selected':''}>支援守门 · 稍微疲劳</option><option value="guard" ${s.nightJob==='guard'?'selected':''}>并肩守夜 · 防守更强，疲劳更多</option><option value="sleep" ${s.nightJob==='sleep'?'selected':''}>睡眠休息 · 由主角独自守夜</option></select></label><p class="fl-small" style="margin-top:8px">${s.reserved?'已预留 '+s.reserved+' 材料，换岗会返还。':'安排会持续生效，不消耗你的行动点。'}</p>`;
 else html+=`<p class="fl-copy">日间：${{rest:'休息',plant:'种植',craft:'制作陷阱',repair:'维修院门'}[s.job]} · 夜间：${{support:'支援',guard:'守夜',sleep:'睡眠'}[s.nightJob]}</p>`;
 return html+`<button class="fl-link cursor-interaction" data-do="story">聊聊她带来的种子 ›</button>`;}
 function explorePanel(){return heading('院子附近 · 每处搜索一次','出门前，看看缺什么','首日搜索安全；没有限时操作。每次花费 2 点行动，回来后会显示实际收获。')+[['alley','居民小巷','食物 +3 · 饮水 +2 · 材料 +2'],['shed','废弃工具棚','材料 +5'],['clinic','街角诊所','药品 +2 · 饮水 +1']].map(([id,title,detail])=>`<button class="fl-location cursor-interaction" data-do="search-${id}" ${s.ap<2||s.searched.includes(id)?'disabled':''}><i data-lucide="${id==='clinic'?'cross':'map-pin'}" aria-hidden="true"></i><span>${title}<small>${s.searched.includes(id)?'今天已经搜索过了':detail}</small></span><strong>${s.searched.includes(id)?'已完成':'2 行动'}</strong></button>`).join('');}
 function panel(){
 if(retryConfirm)return heading('清晨检查点','重新安排这一天？','将还原当天的物资、建筑、招募和故事进度。无需付费，也没有次数限制。')+`<div class="fl-actions">${btn('confirm-retry','确认重试',true)}${btn('cancel-retry','保留当前进度')}</div>`;
 if(s.phase==='wave1')return heading('夜间 · 第一波','墙外传来了脚步声','你守在门后。生物被灯光引来，正试探围墙。防守会按安排自动进行。')+'<div class="fl-progress"><div style="width:45%"></div></div><p class="fl-small">自动防守中 · 切到后台会暂停</p>'+`<div class="fl-actions">${btn('resolve-wave','跳过这段动画')}</div>`;
 if(s.phase==='event')return heading('关键事件 · 已自动暂停','门闩正在松动','最后一只生物撞向院门。你能看清木板上的裂纹，还有时间做决定。')+`<div class="fl-notice">${s.mat>=1?'可以用 1 材料紧急加固，挡下这一轮冲击。':'材料不足，无法紧急加固。仍可以坚守，或退回小屋。'}</div><p class="fl-small">坚守预计损失 ${s.recruited&&s.nightJob!=='sleep'?12:16} 院门耐久；被突破后，房屋受损且主角轻伤。</p><div class="fl-actions">${btn('brace','加固门闩 · 1 材料',true,s.mat<1)}${btn('hold','按原计划坚守')}</div><div class="fl-actions">${btn('retreat','退回小屋 · 房屋损失 10')}</div>`;
 if(s.phase==='wave2')return heading('夜间 · 最后一波','灯还亮着','你已经作出决定。守卫各就各位，门外的动静渐渐稀疏。')+'<div class="fl-progress"><div style="width:85%"></div></div><p class="fl-small">正在结算防守 · 没有需要抢点的操作</p>'+`<div class="fl-actions">${btn('resolve-wave','查看天亮结果')}</div>`;
 if(s.phase==='report'||s.phase==='complete')return heading(s.phase==='complete'?'第 2 天 · 清晨预览':'第 1 夜 · 战报','我们撑过来了',s.recruited?'林禾把一杯热水放在窗台上：“等菜长出来，咱们就不用天天找吃的了。”':'你给炉子添了一小块木头。窗外开始泛白，这个院子还在。')+`<div class="fl-row"><span>幸存人数</span><strong>${people()} / 5 · 无人死亡</strong></div><div class="fl-row"><span>院门耐久</span><strong>${s.gateBefore} → ${s.gate} / 100</strong></div><div class="fl-row"><span>食物 / 饮水</span><strong>各消耗 ${s.nightCost} 份</strong></div><div class="fl-row"><span>房屋 / 主角</span><strong>${s.house<100?'受损 '+(100-s.house):'完好'} · ${s.lightWound?'轻伤':'平安'}</strong></div>${s.planted?'<p class="fl-small" style="margin-top:9px">菜畦已经播种。成长需要几天，今天没有立即收成。</p>':''}${s.phase==='complete'?'<div class="fl-notice">第 1 天已完成，进度已保存。后续天数尚未开放，可以重试当天，比较不同安排。</div>':''}<div class="fl-actions">${btn('retry','从第 1 天清晨重试')}</div>`;
 if(s.phase==='dusk')return heading('黄昏 · 入夜前确认','把灯留给归来的人',`今晚 ${people()} 人留在院内，食物和饮水将各消耗 ${people()} 份。${s.ap?'你还剩 '+s.ap+' 点行动，提前入夜也可以。':'今天的行动已经用完了。'}`)+`<div class="fl-row"><span>院门 / 陷阱</span><strong>${s.gate}/100 · ${s.trap||s.job==='craft'?'已准备':'未准备'}</strong></div><div class="fl-row"><span>同伴日间安排</span><strong>${s.recruited?{rest:'休息',plant:'种植',craft:'制作陷阱',repair:'维修院门'}[s.job]:'尚无同伴'}</strong></div><div class="fl-notice">${s.gate<60?'院门偏弱，今晚可能被突破。建议回去维修。':'院门已有加固。仍可留一些材料用于夜间应急。'}${s.visitor==='waiting'?' 门外的来访者还在等答复。':''}</div><div class="fl-actions">${btn('back-day','再准备一下')}${btn('start-night','确认入夜',true)}</div>`;
 switch(s.view){
 case 'radio':return heading('收音机 · 紧急广播','请保持希望',s.heard?'“联合救援将在二十八天后抵达本区域。请留在安全住所，减少夜间外出。我们会持续广播。”':'旋钮有些松。你转了几下，沙沙声里终于传来一个人的声音。')+(s.heard?`<div class="fl-notice">今晚预警：少量游荡生物。先检查院门，准备第一夜。</div><div class="fl-actions">${btn('yard','开始安排今天',true)}</div>`:`<div class="fl-actions">${btn('listen','收听广播',true)}</div>`);
 case 'members':return memberPanel();
 case 'explore':return explorePanel();
 case 'journal':return heading('手记 · 第 1 天','今天发生的事')+`<ol class="fl-journal">${s.logs.map(t=>'<li>'+t+'</li>').join('')}</ol>`;
 case 'gate':return heading('防御 · 院门','旧木板也能挡一挡',`当前耐久 ${s.gate}/100。每次维修消耗 1 行动、2 材料，恢复 40 耐久，最多 100。`)+`<div class="fl-progress"><div style="width:${s.gate}%"></div></div><div class="fl-actions">${btn('repair','修补院门 · 1 行动',true,s.ap<1||s.mat<2||s.gate>=100)}${btn('yard','回到院子')}</div>`;
 case 'garden':return heading('经营 · 菜畦',s.garden?'给明天留点绿色':'角落里有一块好土',s.garden?(s.planted?'种子已经播下，之后几天才会收成。':'地已经翻好，可以安排同伴种植；今天不会立即产出食物。'):'花费 2 行动、3 材料开垦菜畦。安排擅长种植的同伴后，它会成为稳定的食物来源。')+`<div class="fl-actions">${s.garden?btn('members','安排成员',true):btn('build-garden','开垦菜畦 · 2 行动',true,s.ap<2||s.mat<3)}${btn('yard','回到院子')}</div>`;
 case 'workbench':return heading('制作 · 简易工作台','先做一件能派上用场的东西',s.trap?'一只简易陷阱已经摆在门边，首夜可削弱第一波冲击。':'用 1 行动、2 材料制作一只陷阱；也可以安排同伴制作，黄昏统一完成。')+`<div class="fl-actions">${btn('craft','制作陷阱 · 1 行动',true,s.ap<1||s.mat<2||s.trap||s.job==='craft')}${btn('members','交给同伴')}</div><p class="fl-small" style="margin-top:9px">药品 ${s.medicine} 份 · 第一天不消耗弹药</p>`;
 case 'home':return heading('房屋 · 两个临时床位','今晚先在这里落脚','屋顶还算完整，旧炉子也能用。你把剩下的杯子擦干净，放在第二个床位旁。')+`<div class="fl-row"><span>床位</span><strong>${people()} / 2 · 总人数上限 5</strong></div><div class="fl-row"><span>房屋耐久</span><strong>${s.house} / 100</strong></div><div class="fl-actions">${btn('members','查看成员',true)}</div>`;
 case 'visitor':return heading('来访者 · 可以收留或拒绝','“我会种菜，也能搭把手。”','林禾把背包抱在胸前，里面装着几包种子。她说自己从附近的社区逃来，一路都没有敢生火。')+`<div class="fl-notice">收留后人数 2/5，床位 2/2。每天多消耗 1 食物和 1 饮水，可安排工作与守夜。</div><div class="fl-actions">${btn('accept','开门，让她进来',true)}${btn('decline','今天无法收留')}</div>`;
 case 'story':return heading('林禾 · 第一段故事','背包里的种子','“这些原本要种在社区的小花园里。其他东西丢了，这几包一直没舍得扔。”她想了想，又说：“等安全了，我还想回去看看。”')+`<p class="fl-small">人物线索已记入手记，后续可展开寻找种子箱的任务。</p><div class="fl-actions">${btn('members','回到成员',true)}</div>`;
 default:return yardPanel();
 }
 }
 function render(){
 if(!s)return; const night=['wave1','event','wave2'].includes(s.phase);q('.fl-phone').classList.toggle('fl-night',night);q('.fl-day>div').innerHTML=`<i data-lucide="${night?'moon':'sun'}" aria-hidden="true"></i><strong id="fl-date"></strong>`;
 q('#fl-date').textContent={morning:'第 1 天 · 清晨',day:'第 1 天 · 白天',dusk:'第 1 天 · 黄昏',wave1:'第 1 夜 · 自动防守',event:'第 1 夜 · 决策暂停',wave2:'第 1 夜 · 自动防守',report:'第 1 夜 · 天亮了',complete:'第 2 天 · 清晨预览'}[s.phase];
 q('#fl-ap').textContent=['morning','day','dusk'].includes(s.phase)?'行动 '+s.ap+' / 6':'时间由你掌握';
 q('#fl-resources').innerHTML=[['wheat','食物',s.food],['droplets','饮水',s.water],['package','材料',s.mat],['shield','院门',s.gate]].map(([icon,name,value])=>`<div class="fl-resource"><i data-lucide="${icon}" aria-hidden="true"></i><span>${name}</span><strong>${value}</strong></div>`).join('');
 q('#fl-radio-text').textContent=s.heard?'救援约定：二十八天后。今晚先守住这里。':'有一段微弱的广播。听听看。';
 q('#fl-message').textContent=s.message;q('#fl-crew').textContent=people()+'/5';q('#fl-gate-label').textContent=s.gate+' / 100';
 q('.fl-garden').innerHTML=s.garden?'菜畦 <span>'+(s.planted?'已播种':'等待播种')+'</span>':'空地 <span>可开垦</span>';
 q('.fl-visitor').hidden=!(s.visitor==='waiting'&&editable());
 q('#fl-scene-note').textContent=night?'门外很冷，屋里还有灯。':s.phase==='dusk'?'天色暗了，把门关好。':s.recruited?'从一盏灯，到两个人的家。':'一盏灯，还亮着。';
 q('#fl-sheet').innerHTML=panel();
 q('#fl-primary-area').innerHTML=s.phase==='morning'?'<p class="fl-main-note">听完广播后开始安排今天</p>':editable()?'<button class="fl-main cursor-interaction" data-do="prepare">准备入夜</button><div class="fl-main-note">会先检查准备情况，不会立即开战</div>':s.phase==='report'?'<button class="fl-main cursor-interaction" data-do="finish">迎接第 2 天</button>':s.phase==='complete'?'<p class="fl-main-note">第 1 天可玩版 · 后续天数尚未开放</p>':'';
 const tab=s.view==='members'||s.view==='story'?'members':s.view==='explore'?'explore':s.view==='journal'?'journal':'yard';
 q('.fl-nav').querySelectorAll('button').forEach(el=>{el.setAttribute('aria-current',el.dataset.do===tab?'page':'false');el.disabled=!['morning','day'].includes(s.phase);});
 q('.fl-scene').querySelectorAll('button').forEach(el=>el.disabled=!editable());q('.fl-radio').disabled=!['morning','day'].includes(s.phase);
 
 paintIcons(root);
 scene.render(s);
 renderSaveStatus();
 if(statusError){
   const warning=document.createElement('div');warning.className='fl-notice';warning.setAttribute('role','alert');
   const text=document.createElement('p');text.textContent=statusError;warning.append(text);
   const retry=document.createElement('button');retry.type='button';retry.className='fl-button';retry.dataset.do=pending?'retry-save':'reconnect';retry.textContent=pending?'重试刚才的操作':'重新连接';retry.disabled=busy;warning.append(retry);q('#fl-sheet').append(warning);
 }
 if(busy||pending)root.querySelectorAll('button,select').forEach(el=>{if(!['retry-save','reconnect'].includes(el.dataset.do))el.disabled=true;});
 }

function renderSaveStatus() {
  const bar=q('#fl-savebar'), label=q('#fl-save-status'), controls=q('#fl-save-actions');
  bar.dataset.status=statusError?'error':busy?'saving':'saved';
  if(busy)label.textContent=snapshot?'正在保存，请稍等…':'正在读取你的存档…';
  else if(statusError)label.textContent=statusError;
  else if(snapshot)label.textContent='进度已保存 · '+new Intl.DateTimeFormat('zh-CN',{hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'Asia/Shanghai'}).format(new Date(snapshot.updatedAt));
  controls.innerHTML=statusError?`<button data-do="${pending?'retry-save':'reconnect'}" ${busy?'disabled':''}>${pending?'重试刚才的操作':'重新连接'}</button>`:'';
}
function refresh() {
  if(s)render();
  else { root.querySelectorAll('button,select').forEach(el=>el.disabled=true); renderSaveStatus(); paintIcons(root); }
}
function storePending() {
  try { if(pending)sessionStorage.setItem(STORAGE_KEY,JSON.stringify(pending));else sessionStorage.removeItem(STORAGE_KEY); } catch {}
}
function setView(next) {
  view=next;
  if(s)s.view=next;
  try { sessionStorage.setItem('dawn-view',next); } catch {}
}
function adopt(next) {
  if(snapshot&&snapshot.runId===next.runId&&snapshot.revision>next.revision)return;
  snapshot=next;
  if(next.state.phase==='morning')setView('radio');
  if(view==='visitor'&&next.state.visitor!=='waiting')setView('yard');
  if(view==='story'&&!next.state.recruited)setView('yard');
  s={...next.state,view};
}
function requestId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
}
async function request(path,options={}) {
  const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),9000);
  try {
    const response=await fetch(path,{...options,signal:controller.signal,credentials:'same-origin',cache:'no-store'});
    let data;
    try { data=await response.json(); } catch { throw new Error('连接中断，尚未确认操作结果。'); }
    return {response,data};
  } finally {clearTimeout(timeout);}
}
function followAction(action) {
  if(action.type==='listen')setView('radio');
  if(action.type==='search')setView(s.visitor==='waiting'?'visitor':'explore');
  if(action.type==='recruit')setView(action.accept?'members':'yard');
  if(action.type==='story')setView('story');
  if(action.type==='startNight'||action.type==='backDay')setView('yard');
  if(action.type==='retry'){setView('radio');retryConfirm=false;}
}
async function flushPending() {
  if(busy||!pending)return;
  busy=true;statusError='';clearTimeout(timer);refresh();
  const sent=pending;
  try {
    const {response,data}=await request('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:sent.runId,revision:sent.revision,requestId:sent.requestId,action:sent.action})});
    if(response.ok) {adopt(data);followAction(sent.action);pending=null;storePending();}
    else if(response.status>=400&&response.status<500) {
      pending=null;storePending();
      if(data.snapshot)adopt(data.snapshot);
      statusError=data.error||'操作没有执行，请重新检查。';
      if(s)s.message=statusError;
    } else throw new Error(data.error||'保存暂时失败，尚未确认操作结果。');
  } catch {
    // Keep exactly the same ID across retries, including a response lost after COMMIT.
    statusError='连接中断，刚才的操作结果尚未确认。请重试。';
  } finally {busy=false;refresh();schedule();}
}
async function perform(action) {
  if(busy||pending||!snapshot)return;
  pending={runId:snapshot.runId,revision:snapshot.revision,requestId:requestId(),action};storePending();
  await flushPending();
}
async function connect() {
  if(busy)return;
  busy=true;statusError='';clearTimeout(timer);refresh();
  try {
    const {response,data}=await request('/api/game');
    if(!response.ok)throw new Error(data.error||'暂时无法读取存档。');
    adopt(data);
    if(pending&&pending.runId!==data.runId){pending=null;storePending();}
  } catch {statusError='暂时无法连接存档服务。请检查连接后重试。';}
  finally {busy=false;refresh();}
  if(pending&&!statusError)await flushPending();else schedule();
}
function schedule() {
  clearTimeout(timer);timer=null;
  if(!s||busy||pending||statusError||document.hidden)return;
  if(s.phase==='wave1'||s.phase==='wave2') {
    const phase=s.phase;
    timer=setTimeout(()=>{if(!document.hidden&&s.phase===phase)perform({type:phase});},phase==='wave1'?1800:1500);
  }
}
async function act(action) {
  if(action==='retry-save'){await flushPending();return;}
  if(action==='reconnect'){await connect();return;}
  if(!s||busy||pending)return;
  if(action==='retry'){retryConfirm=true;refresh();return;}
  if(action==='cancel-retry'){retryConfirm=false;refresh();return;}
  if(action==='confirm-retry'){await perform({type:'retry'});return;}
  if(action==='resolve-wave'&&['wave1','wave2'].includes(s.phase)){await perform({type:s.phase});return;}
  if(action==='radio'){setView('radio');refresh();return;}
  if(['yard','members','explore','journal','gate','garden','workbench','home'].includes(action)) {
    if(s.phase==='morning'&&action!=='journal'){s.message='先收听广播，了解外面的情况。';refresh();return;}
    setView(action);refresh();return;
  }
  if(action==='visitor'&&s.visitor==='waiting'){setView('visitor');refresh();return;}
  if(action==='story'){await perform({type:'story'});return;}
  const commands={listen:{type:'listen'},accept:{type:'recruit',accept:true},decline:{type:'recruit',accept:false},repair:{type:'repair'},'build-garden':{type:'buildGarden'},craft:{type:'craft'},prepare:{type:'prepare'},'back-day':{type:'backDay'},'start-night':{type:'startNight'},brace:{type:'decide',choice:'brace'},hold:{type:'decide',choice:'hold'},retreat:{type:'decide',choice:'retreat'},finish:{type:'finish'}};
  if(action.startsWith('search-'))await perform({type:'search',place:action.slice(7)});
  else if(commands[action])await perform(commands[action]);
}
root.addEventListener('click',event=>{const button=event.target.closest('button[data-do]');if(button&&!button.disabled)void act(button.dataset.do);});
root.addEventListener('change',event=>{
  if(event.target.id==='fl-job')void perform({type:'setJob',job:event.target.value});
  if(event.target.id==='fl-night-job')void perform({type:'setNightJob',job:event.target.value});
});
document.addEventListener('visibilitychange',()=>{
  clearTimeout(timer);
  // Refresh authoritative state on returning, so another tab cannot leave stale resources.
  if(!document.hidden&&!busy)void connect();
});
window.addEventListener('online',()=>{if(!busy)void connect();});
window.addEventListener('offline',()=>{clearTimeout(timer);statusError='网络已断开。已保存的进度仍在，请恢复连接后继续。';refresh();});
void connect();
