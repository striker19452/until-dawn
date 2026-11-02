import {RATIONS} from '../src/balance.js';
import {rationDescription} from '../src/descriptions.js';
import {dailyConsumption} from '../src/rules.js';
import {dailyIntel} from '../src/content.js';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function rationState(state,battle=null){return {...state,...battle,weather:battle?.weather??dailyIntel(state).weather};}
export function rationsPanel(state,battle,resource){
 const view=rationState(state,battle),d=dailyConsumption(view),food=resource==='food',name=food?'食物':'净水',amount=d[resource];
 if(!d.people)return '<p class="copy">选择角色后开始计算每日消耗。</p>';
 const stock=view.resources[resource],days=Math.floor(stock/Math.max(1,amount));
 return `<section data-testid="daily-consumption"><div class="eyebrow">每天夜末结算 · 按当前存活人数计算</div><h2>${name}每日消耗 ${amount}</h2><dl class="exposure-sources"><div><dt>${d.people}人基础消耗</dt><dd>${food?d.people*RATIONS.baseFood:d.people*RATIONS.baseWater}${name}</dd></div>${food?`<div><dt>白天工作（${d.personMeals.filter(p=>p.work>0).length}人）</dt><dd>+${d.workExtra}食物</dd></div><div><dt>参与夜战（${d.personMeals.filter(p=>p.night>0).length}人）</dt><dd>+${d.nightExtra}食物</dd></div><div><dt>公共灶节省</dt><dd>−${d.stoveSaving}食物</dd></div><div><dt>孟姐掌灶节省（每人${RATIONS.cookSavingPerPerson}）</dt><dd>−${d.cookingSaving}食物</dd></div>`:`<div><dt>炎热天气额外消耗</dt><dd>+${d.hotExtra}净水</dd></div>`}${food&&d.dogFood?`<div data-testid="dog-rations"><dt>小麦 · 固定口粮（不减免）</dt><dd>+${d.dogFood}食物</dd></div>`:''}<div><dt>每日合计</dt><dd>${amount}${name}</dd></div></dl>${food?`<p class="mini">个人用量（全队减免前）：基础＋白天＋夜战</p><dl class="exposure-sources" data-testid="person-rations">${d.personMeals.map(p=>`<div data-person-ration="${escape(p.id)}"><dt>${escape(p.name)}</dt><dd>${p.base}＋${p.work}＋${p.night}＝${p.food}食物</dd></div>`).join('')}</dl><p class="mini">${rationDescription()}</p>`:''}<p class="copy">现有${stock}${name}，按当前消耗约可用${days}日。</p><p class="mini">${food?`掌灶按当前存活人数每人省${RATIONS.cookSavingPerPerson}食物，可与公共灶叠加，人员合计最低每天消耗${RATIONS.minimumFood}食物；小狗另固定消耗1食物。`:`炎热时每${RATIONS.hotPeoplePerWater}人额外消耗1净水，不足${RATIONS.hotPeoplePerWater}人按${RATIONS.hotPeoplePerWater}人计。`}人数、天气、工作、夜间安排或设施变化时重新计算；日数不含后续产出与搜索所得。</p></section>`;
}
