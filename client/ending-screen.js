import {formatDurability} from '../src/format.js';
import {deathReason} from '../src/health.js';
import victoryArt from './assets/endings-v1/victory.webp';
import defeatArt from './assets/endings-v1/defeat.webp';
import './ending-screen.css';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=value=>Number.isFinite(value)?Number(value.toFixed(1)):0;
export const isEnding=state=>['rescued','failed'].includes(state?.phase);
const cachedArt=[];
export function preloadEndingArt(){
 if(cachedArt.length)return;
 for(const url of [victoryArt,defeatArt]){const img=new Image();img.decoding='async';img.fetchPriority='low';img.src=url;cachedArt.push(img);}
}
export function endingScreen(s,{button,portrait,testing=false,pending=false,saving=false}={}){
 const victory=s.phase==='rescued',people=(s.people||[]).filter(p=>!p.dead),r=s.report||{},hero=s.people?.find(p=>p.id==='hero'),ending=s.ending||{};
 const reason=[s.house<=0?'小屋耐久归零，院子失守。':'',hero?.dead?deathReason(hero):''].filter(Boolean).join('')||'这一夜没能平安度过。';
 const advice=hero?.dead?(hero.deathCause==='deadline'||!hero.deathCause&&hero.health>0?'重试当天，在入夜前稳定主角的重伤。':'重试当天，准备药品，并及时撤回屋内或急救。'):'重试当天，留足修补材料，并及时处理入院生物。';
 const status=testing?'测试结局 · 不写入正式进度':pending?'结果待保存 · 请保持页面':'本局结果已保存到本机浏览器';
 const stats=victory?[[s.day,'度过的昼夜'],[people.length,'获救成员'],[formatDurability(s.house)+'/100','小屋耐久'],[(s.achievements?.length||0)+'/28','完成挑战']]:[[s.day,r.period==='day'?'止步之日':'止步之夜'],[people.length,'存活成员'],[formatDurability(s.house),'小屋耐久 /100'],r.period==='day'?['白天','发生时段']:[number(r.elapsed)+'秒','守夜用时']];
 const crew=people.length?people.map(p=>`<span class="ending-person">${portrait(p.id,p.name)}<span>${escape(p.name)}</span></span>`).join(''):'<p class="ending-note">这一回，没有人等到接应。</p>';
 const memories=Array.isArray(s.memories)&&s.memories.length?s.memories:['二十八日手记'];
 const period=r.period==='day'?'天':'夜';
 const heading=victory?(people.length>1?'我们等到了':'终于等到了'):r.period==='day'?'没能等到接应':'天还没有亮';
 const subtitle=victory?'门外的脚步，终于来自人类。':'院子静了下来。你还可以重新安排这一天。';
 const pickup=ending.closePickup?'救援队抵近小院接应。':'按广播前往公共集合点。';
 const main=pending?button(saving?'正在保存结果…':'重试保存结果','retry-save',saving?'disabled':'','primary ending-primary'):victory?button(testing?'重开本关':'开启新的二十八天','restart','','primary ending-primary'):button(`重试第 ${s.day} 天`,'retry','','primary ending-primary');
 const secondary=pending?button('返回战场','ending-yard','','ending-secondary'):button('查看本夜战报','ending-report','','ending-secondary')+(testing?button('退出测试','test-exit','','ending-secondary'):victory?button('查看院子','ending-yard','','ending-secondary'):button('重新开始','restart','','ending-secondary'));
 return `<article class="ending-screen ${victory?'ending-victory':'ending-defeat'}" data-testid="ending-screen" data-outcome="${victory?'victory':'defeat'}" data-pending="${pending}">
  <div class="ending-art"><img src="${victory?victoryArt:defeatArt}" alt="${victory?'晨光照进小院，敞开的门外有人前来接应':'雨夜的小院里，破开的木门旁只剩一簇余烬'}" decoding="async"><div class="ending-art-shade"></div>
   <div class="ending-wordmark">等到天亮<small>一座小院 · 二十八个昼夜</small></div>
   <div class="ending-heading"><p class="ending-kicker"><span>${victory?'生存成功':'生存失败'}</span>第 ${s.day} ${period} · ${victory?'救援黎明':'未完的手记'}</p><h1 id="ending-title" tabindex="-1">${heading}</h1><p>${subtitle}</p><span class="ending-rule" aria-hidden="true"></span></div>
  </div>
  <section class="ending-panel" aria-label="本局结果"><div class="ending-details" tabindex="0" aria-label="本局记录，可滚动查看">
   <p class="ending-record-label">${victory?'留给黎明的记录':'这一夜的记录'}<span>${escape(status)}</span></p>
   ${victory?'':`<div class="ending-cause"><span>失败原因</span><p data-testid="ending-reason">${escape(reason)}</p></div>`}
   <div class="ending-stats">${stats.map(([value,label])=>`<div><strong>${escape(value)}</strong><span>${label}</span></div>`).join('')}</div>
   ${victory?`<p class="ending-story">${escape(ending.text||'你收好炉边的杯子，带着这本手记走向晨光。')}</p><p class="ending-note">${pickup}帮助邻里 ${number(ending.helped??s.flags?.helped)} 次。</p>`:`<p class="ending-note">${advice}</p>`}
   <section class="ending-crew"><h2>${victory?'一起离开的人':'仍在院子里的人'}</h2><div>${crew}</div></section>
   ${victory?`<section class="ending-memories"><h2>带走的纪念</h2><div>${memories.map(m=>`<span>${escape(m)}</span>`).join('')}</div></section>`:''}
  </div><footer class="ending-actions">${pending?'<p>请允许浏览器存储数据并重试保存；保存完成后可重试或重玩。</p>':!victory?'<p>免费重试会还原当天清晨的物资、建设和成员状态。</p>':'<p>这一页已经写完，下一座小院的灯还等着亮起。</p>'}<div>${main}${secondary}</div></footer></section>
 </article>`;
}
