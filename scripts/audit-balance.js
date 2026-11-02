import { writeFileSync } from 'node:fs';
import { run } from '../test/support/campaign-route.js';
const roles=['repairman','medic','watchman'],seeds=[11,53,97],rows=[];
for(const policy of ['active','idle'])for(const role of roles)for(const size of [1,2,3,4,5])for(const seed of seeds){const r=run(role,size,seed,{policy});rows.push({policy,role,size,seed,phase:r.s.phase,minHouse:r.minHouse,nights:r.nights});}
const noFire=seeds.map(seed=>{const r=run('repairman',1,seed,{fire:false});return {seed,phase:r.s.phase,minHouse:r.minHouse,cleared:r.nights.filter(n=>n.cleared).length};});
writeFileSync('.local/balance-challenges.json',JSON.stringify({rows,noFire},null,2));
const pct=(n,d)=>(n/d*100).toFixed(1)+'%',avg=arr=>(arr.reduce((n,x)=>n+x,0)/Math.max(1,arr.length)).toFixed(1);
let md='# 28日难度推演报告\n\n日期：2026-10-22。由 `node scripts/audit-balance.js` 生成。\n\n';
md+='两组均使用相同经济、修栏、安装翻刺／埋网、路线准备与岗位策略。主动组每2游戏秒检查局势，执行有材料成本的维修、添火、打断、转移；固定组整夜不下新命令。两组均不重试、不修改物资或敌人。固定组仍有自动巡守，不能当成完全不准备的新手。\n\n';
md+='|策略|人数|救援路线|完成挑战／实际经历夜晚|房屋最低值|平均每夜付费干预|\n|---|---:|---:|---:|---:|---:|\n';
for(const policy of ['active','idle'])for(const size of [1,2,3,4,5]){const group=rows.filter(r=>r.policy===policy&&r.size===size),nights=group.flatMap(r=>r.nights);md+=`|${policy==='active'?'主动指挥':'固定布防'}|${size}|${group.filter(r=>r.phase==='rescued').length}/${group.length}|${nights.filter(n=>n.cleared).length}/${nights.length}（${pct(nights.filter(n=>n.cleared).length,nights.length)}）|${Math.min(...group.map(r=>r.minHouse)).toFixed(1)}|${avg(nights.map(n=>n.interventions))}|\n`;}
md+='\n干预列统计花费物资／体力的应急动作上限内调用，不含换防命令与自动巡守。\n\n|日|夜间难题|主动组完成／45|主动组房屋平均／最低|固定组完成／抵达该夜|\n|---:|---|---:|---:|---:|\n';
for(let day=1;day<=28;day++){const active=rows.filter(r=>r.policy==='active').flatMap(r=>r.nights).filter(n=>n.day===day),idle=rows.filter(r=>r.policy==='idle').flatMap(r=>r.nights).filter(n=>n.day===day);md+=`|${day}|${active[0]?.challenge}|${active.filter(n=>n.cleared).length}/45|${avg(active.map(n=>n.house))} / ${Math.min(...active.map(n=>n.house))}|${idle.filter(n=>n.cleared).length}/${idle.length}|\n`;}
md+='\n无火独居专项（修理工）：\n\n';for(const r of noFire)md+=`- 种子${r.seed}：${r.phase}，最低房屋${r.minHouse.toFixed(1)}，完成挑战${r.cleared}/28。\n`;
md+='\n解释与限制：主动策略有公开规则知识，结果证明存在合法可解路线，不代表新手成功率或真人乐趣。多人比独居更容易，这是额外人手与食水成本的收益，没有按人数暗中加怪。挑战可选，未得奖励不阻止救援。第7、14、21、28夜集中考验；第9、12、16、20天教学新威胁。下一步真人试玩应记录暂停次数、临场指令次数、失败原因理解和重复游玩意愿，不能用自动推演宣称成就感已验证。\n';
writeFileSync('BALANCE_REPORT.md',md);
console.log(md.slice(0,md.indexOf('\n干预列')));console.log('无火独居',noFire);
