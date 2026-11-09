import {explorationStory,encounterView,bondStatus,activeExplorationGoals,explorationGoalStatus,EXPLORATION_GOALS,EXPLORATION_STORY_RULES} from '../src/exploration-story.js';
import {SITES} from '../src/content.js';
import {resourceText} from '../src/descriptions.js';
import {actionAvailability,costText} from './action-help.js';
import {dayActionFatigue} from '../src/fatigue.js';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rewardText=def=>`${Object.keys(def.reward).length?`${resourceText(def.reward)}，并`:'纯叙事后续，'}留下纪念「${def.memory}」`;
export function explorationSummary(s,{button,attrs}){
 const state=explorationStory(s),active=activeExplorationGoals(s).length,waiting=state.goals.filter(g=>g.status==='awaiting').length;
 return `<div class="journey-summary"><p>${state.pending?`发现待回应的见闻「${escape(encounterView(s).title)}」`:active||waiting?`${active}个约定待履行 · ${waiting}封回音在途中`:'每次外出，都可能遇到物资以外的故事。'}</p>${button(state.pending?'回应这段见闻':'见闻与约定','explore-stories','','small')}</div>`;
}
export function relationshipPanel(s,p){
 if(p.id==='hero')return '';
 const bond=bondStatus(s,p.id),recent=explorationStory(s).journal.filter(e=>e.person===p.id).slice(-2);
 return `<section class="relationship-panel" data-testid="relationship-panel"><h3>与你 · ${bond.label}<span>${bond.value}/${bond.max}</span></h3><p>共同外出、认真回应往事和兑现约定，会留下新的信赖。关系达到${EXPLORATION_STORY_RULES.trust}，在同行见闻里可以交换彼此的牵挂。</p>${recent.length?`<ul>${recent.map(e=>`<li>第${e.day}天 · ${escape(e.text)}</li>`).join('')}</ul>`:'<p>你们还没有一起出过门，故事可以慢慢开始。</p>'}</section>`;
}
export function explorationPanel(s,{button,attrs,readOnly=false}){
 const state=explorationStory(s),encounter=encounterView(s),active=activeExplorationGoals(s),waiting=state.goals.filter(g=>g.status==='awaiting'),finished=state.goals.filter(g=>g.status==='completed'||g.status==='abandoned');
 let html=`<section class="exploration-story" data-testid="exploration-story"><h2>路上的见闻，记下的约定</h2><p class="copy">有的路通向补给，有的路通向一个等回音的人。约定都可放下，同时最多记${EXPLORATION_STORY_RULES.maxActive}个；未回应的见闻到次日归入手记，不影响入夜。</p>`;
 if(readOnly)html+='<p class="notice">现在可以翻阅，白天再决定如何回应或继续约定。</p>';
 if(encounter){html+=`<section class="journey-encounter" data-testid="exploration-encounter"><h3>${escape(encounter.title)}</h3><p class="journey-location">第${encounter.day}天 · ${SITES[encounter.site].name}</p><p class="journey-prose">${escape(encounter.text)}</p><div class="journey-choices">${encounter.choices.map(choice=>{
  const action={type:'explorationChoice',encounter:encounter.id,choice:choice.id},available=readOnly?{allowed:false}:actionAvailability(s,action),def=EXPLORATION_GOALS[choice.goal];
  return `<section><h4>${escape(choice.label)}</h4><p>${escape(choice.effect)}</p>${choice.ap?`<p>主角行动疲劳+${dayActionFatigue(choice.ap)}。</p>`:''}${def?`<p class="journey-reward">后续：${rewardText(def)}${s.day+EXPLORATION_STORY_RULES.replyDays>28&&!def.immediate?'；已接近救援，晚到的回信不计入本轮物资':''}。</p>`:''}${button(choice.label,'explore-choice',attrs({encounter:encounter.id,choice:choice.id})+(!available.allowed?' disabled':''),choice.id==='leave'?'small':'')}${!available.allowed&&!readOnly?`<p class="journey-unavailable">${escape(available.reason)}</p>`:''}</section>`;
 }).join('')}</div></section>`;}else html+='<p class="journey-empty">此刻没有待回应的见闻。完成一次搜索后，留意路上出现的人和字条。</p>';
 html+=`<section class="journey-goals" data-testid="exploration-goals"><h3>记下的约定 · ${active.length}/${EXPLORATION_STORY_RULES.maxActive}</h3>${active.length?active.map(g=>{
  const def=EXPLORATION_GOALS[g.type],status=explorationGoalStatus(s,g),available=readOnly?{allowed:false}:actionAvailability(s,{type:'explorationGoal',goal:g.id});
  return `<article data-goal="${g.id}"><h4>${def.title}</h4><p>${def.task}</p><p class="journey-next">${escape(status.text)}</p><p>履行：${costText(def.ap,def.cost)}${def.ap?`，主角疲劳+${dayActionFatigue(def.ap)}`:''}。${def.immediate?'完成后立即得到：':`履行后等待${EXPLORATION_STORY_RULES.replyDays}个清晨，收到：`}${rewardText(def)}。</p><div class="actions">${button(def.immediate?'沿标记寻找':'履行这份约定','explore-goal',attrs({goal:g.id})+(!available.allowed?' disabled':''),'primary')}${button('放下约定 · 本局不再继续','explore-abandon',attrs({goal:g.id})+(readOnly?' disabled':''),'small')}</div>${!available.allowed&&!readOnly&&status.ready?`<p class="journey-unavailable">${escape(available.reason)}</p>`:''}${s.day+EXPLORATION_STORY_RULES.replyDays>28&&!def.immediate?'<p class="journey-unavailable">回信将晚于救援，本轮不领取物资回礼。</p>':''}</article>`;
 }).join(''):'<p>还没有未完成的约定。可以先守好院子，再决定为谁走一趟路。</p>'}</section>`;
 if(waiting.length)html+=`<section class="journey-waiting" data-testid="exploration-replies"><h3>回音在路上</h3><ul>${waiting.map(g=>`<li><b>${EXPLORATION_GOALS[g.type].title}</b><span>${explorationGoalStatus(s,g).text}</span></li>`).join('')}</ul></section>`;
 if(finished.length)html+=`<section class="journey-finished"><h3>已经留下的足迹</h3><ul>${finished.map(g=>`<li>${EXPLORATION_GOALS[g.type].title}<span>${g.status==='completed'?'后续已收到':'已放下'}</span></li>`).join('')}</ul></section>`;
 html+=`<section class="journey-journal" data-testid="exploration-journal"><h3>翻一翻路上的记录</h3>${state.journal.length?`<ol>${state.journal.slice(-8).reverse().map(e=>`<li><time>第${e.day}天</time><p>${escape(e.text)}</p></li>`).join('')}</ol>`:'<p>还没有见闻记录，下一趟外出会留下新的足迹。</p>'}</section></section>`;
 return html;
}
