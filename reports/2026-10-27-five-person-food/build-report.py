from pathlib import Path
import json,csv,collections,statistics as st,hashlib
root=Path(__file__).resolve().parent
modes=['baseline','demand','food','search'];rows=sum([json.loads((root/(m+'-results.json')).read_text()) for m in modes],[])
labels={'baseline':'原补粮策略','demand':'原分工＋按口粮补给','food':'双种植＋护理＋交易补粮','search':'双种植＋护理＋不换食物'}
roleNames={'repairman':'修理工','medic':'医护人员','watchman':'保安'}
mean=lambda a:round(st.mean(a),1)
def income(r):
 out=collections.Counter();spent=0
 for a in r['actions']:
  for f in a['flows']:
   for c in f['changes']:
    if c['resource']=='food':
     if c['amount']>0:out[f['reason'] or a['request']['type']]+=c['amount']
     else:spent-=c['amount']
 return out,spent
def foodSearch(r):return [a for a in r['actions'] if a['request']['type']=='search' and a['resourcesAfter']['food']>a['resourcesBefore']['food']]
summary={'date':'2026-10-27','runs':len(rows),'nights':sum(len(r['nights']) for r in rows),'errors':sum(bool(r['error']) for r in rows),'groups':[]}
for mode in modes:
 rs=[r for r in rows if r['mode']==mode];ns=[n for r in rs for n in r['nights']]
 summary['groups'].append({'mode':mode,'label':labels[mode],'runs':len(rs),'wins':sum(r['phase']=='rescued' for r in rs),'lastDays':[r['day'] for r in rs],'hungryNights':sum(n['hungry'] for n in ns),'thirstyNights':sum(n['thirsty'] for n in ns),'finalFood':[r['final']['resources']['food'] for r in rs],'averageFoodSearchAP':mean([sum(a['apBefore']-a['apAfter'] for a in foodSearch(r)) for r in rs])})
for r in rows:
 inc,spent=income(r);assert 5+sum(inc.values())-spent-sum(n['foodUsed'] for n in r['nights'])==r['final']['resources']['food']
 assert r['error'] is None and len(r['nights'])==r['day']
 if r['phase']=='rescued':assert r['day']==28 and sum(not p['dead'] for p in r['final']['people'])==5
 assert all(n['foodUsed']<=n['foodDemand'] for n in r['nights'])
manifest=json.loads((root/'source-manifest.json').read_text());workspace=root.parent.parent
summary['sourceChanges']=[p for p,h in manifest['files'].items() if hashlib.sha256((workspace/p).read_bytes()).hexdigest()!=h];assert not summary['sourceChanges']
(root/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
def csvfile(name,head,data):
 with (root/name).open('w',newline='') as f:w=csv.writer(f);w.writerow(head);w.writerows(data)
keys=['food','water','materials','fuel','medicine','parts']
csvfile('runs.csv',['strategy','role','seed','phase','day','living',*keys,'hungryNights','thirstyNights','foodUsed','foodIncome','otherFoodSpend','foodSearchActions','health','fear','fatigue'],[[labels[r['mode']],r['role'],r['seed'],r['phase'],r['day'],sum(not p['dead'] for p in r['final']['people']),*[r['final']['resources'][k] for k in keys],sum(n['hungry'] for n in r['nights']),sum(n['thirsty'] for n in r['nights']),sum(n['foodUsed'] for n in r['nights']),sum(income(r)[0].values()),income(r)[1],sum(a['apBefore']-a['apAfter'] for a in foodSearch(r)),*[mean([p[k] for p in r['final']['people'] if not p['dead']]) for k in ['health','fear','fatigue']]] for r in rows])
daily=[]
for r in rows:
 start=5
 for n in r['nights']:
  acts=[a for a in r['actions'] if a['day']==n['day']];gain=cost=0
  for a in acts:
   for f in a['flows']:
    for c in f['changes']:
     if c['resource']=='food':
      if c['amount']>0:gain+=c['amount']
      else:cost-=c['amount']
  assert start+gain-cost-n['foodUsed']==n['resources']['food']
  daily.append([r['mode'],r['role'],r['seed'],n['day'],sum(not p['dead'] for p in n['people']),start,gain,cost,n['foodDemand'],n['foodUsed'],n['resources']['food'],n['hungry'],n['thirsty'],n['resources']['water'],n['house']]);start=n['resources']['food']
csvfile('daily-food.csv',['mode','role','seed','day','living','startFood','foodGain','otherSpend','foodDemand','foodUsed','endFood','hungry','thirsty','water','house'],daily)
csvfile('people.csv',['mode','role','seed','person','dead','health','wound','fear','fatigue'],[[r['mode'],r['role'],r['seed'],p['name'],p['dead'],p['health'],p['wound'],p['fear'],p['fatigue']] for r in rows for p in r['final']['people']])
text=[]
def add(x=''):text.append(x)
add('# 新口粮规则：五人队28天生存测试')
add('\n测试日期：2026-10-27。当前源代码快照覆盖39个文件，运行期间原文件哈希未变化。')
add('\n**结论：五人队能在新规则下吃够并完成28天，但需要按实际需求安排种植、搜索或交易。沿用旧补粮策略会连续缺粮。**')
add('\n共24个正式样本、570次真实夜战结算。原策略9局全部失败；补粮策略调整后的15局全部5人通关，饥饿、缺水均为0。所有夜战都实际生成、战斗、清场和结算，并通过 `validateClientResult`，没有修改资源、删除敌人或跳过失败。原策略另重放9局以补全精确口粮需求，最终状态全部一致；重复不计入24局。')
add('\n## 当前规则与覆盖')
add('\n- 口粮：每人基础1、白天工作额外1、夜间值勤额外1；普通／耐候公共灶全队省1，高产省2。主角劳动也计工作加餐。')
add('- 种植岗位已更新为：生存技能不足2产2食物，达到2产3；不是前次评估使用的1／2／3。')
add('- 孟姐掌灶现为每名存活成员省1食物，不是原先全队只省1。本次15局成功路线均未招募孟姐，表明成功不依赖厨师。')
add('- 集水高产二级雨天4、晴热2、其他3，耐候固定3。此次策略主要使用一级集水，因此不能用这批结果单独评价集水升级削弱的影响。')
add('- 随机种子11、53、97；主要两组覆盖修理工、医护人员、保安。所有人从第1天初始资源起步，第8天才招满5人，没有开局赠送满编。')
add('\n## 对比结果')
add('\n| 策略 | 样本 | 通关 | 饥饿夜数 | 结束时食物 |')
add('|---|---:|---:|---:|---|')
for g in summary['groups']:
 end=f'{min(g["finalFood"])}—{max(g["finalFood"])}'
 add(f'| {g["label"]} | {g["runs"]} | {g["wins"]}/{g["runs"]} | {g["hungryNights"]} | {end} |')
add('\n“饥饿夜数”是该组所有局的合计，不是每局。原策略在第14—20天失败；其余组完整经历28天。主测试覆盖三职业共9局；保留原分工、不换食物两个补测组各仅修理工3局，不能将小样本结果当成总体概率。')
add('\n### 原策略为什么不够')
add('\n原策略仍按库存低于7才去小巷快搜，且优先搜建材和安排建设。新规则下，满编全工作值勤、使用普通／耐候灶时通常需要14食物。一名种植者加两块一级菜畦不足以覆盖缺口；每次小巷仅带回4食物，又常因剩余行动不足没能搜索，缺粮多从第5—7天开始。')
add('\n原策略9局合计150夜中有100夜饥饿，口粮需求1696，实际只能提供1352，缺口344。饥饿还暂停自动回血，随后人员受伤和防线问题相互叠加。不能把所有失败都归因食物，但缺粮是明确的持续压力。原策略虽有不保护口粮的卖粮条件，这9局实际未发生卖粮，不能把其失败归因于“把粮卖掉”。')
add('\n### 新策略具体改了什么')
add('\n1. 先估计当晚人数、工作和值勤需求，再减去预计黄昏产出的菜畦和种植食物，额外准备约2份余粮。')
add('2. 优先用有库存的零件换食水，再去温室／小巷补足；补粮优先于非紧急建设，不再把今晚需要的口粮卖给留言处。')
add('3. 主测试将岗位改为林禾种植、老周取水、陈岚种植、许宁护理；保持两块一级菜畦、一级集水和耐候公共灶，夜战策略沿用原主动指挥。')
add('4. 单独补测“保留原岗位、仅改变补粮策略”3局，以及“不许零件换食物、其余同主测试”3局。前者仍使用种植／取水／搜燃料／做陷阱分工，3局也全部通关，说明并非只有改成双种植才能成功。')
add('\n所有改变仅在测试控制器中，生产代码与数值未改；资料中的 snapshot/src 是真实规则，snapshot/test/support 内的不同控制器用于比较合法玩法。')
add('\n## 主测试：28天食物从哪里来')
rs=[r for r in rows if r['mode']=='food'];details=[]
for r in rs:
 inc,sp=income(r);crop=sum(v for k,v in inc.items() if k=='菜畦收获');farm=sum(v for k,v in inc.items() if '照料种植' in k);search=sum(v for k,v in inc.items() if k.startswith('搜索'));trade=inc['物资交换所得'];details.append((crop,farm,search,trade,sp,sum(n['foodUsed'] for n in r['nights'])))
add('\n主测试9局，每局28天的平均值：')
add('\n| 渠道 | 食物 |')
add('|---|---:|')
for label,i in [('菜畦自动收获',0),('同伴种植',1),('外出搜索',2),('零件换食水',3),('交换等其他食物消耗',4),('实际口粮消耗',5)]:add(f'| {label} | {mean([x[i] for x in details]):g} |')
add('\n菜畦和种植约提供216食物，占新获得食物约61%；交易约113、搜索约27。其余差额由初始5食物和最后余粮对应。**这是一条农业＋零件交易的混合路线，不能宣称“单靠种植够五人吃”。**')
add('\n主测试每局实际吃掉356—359食物，最终还剩2—4；9局最低夜末库存均为2。余粮低与控制器刻意只备约2份有关，不代表系统无法额外囤粮。')
add('\n## 不换食物是否仍然能过')
add('\n可以：修理工3个种子全部5人通关，28夜均无饥饿、缺水。每局执行23次温室快搜和1次小巷快搜，合计获得142搜索食物、花48行动，约占28天168行动的28.6%；其余主要由菜畦和双种植岗位供应。')
add('\n这说明五人不是必须依赖零件交易才能生存，但不交易时会明显占用搜索行动。该组存活者最终平均疲劳29.2，主测试为14.6；样本量和策略交互有限，不能把差值全归因于搜索。')
add('\n## 最终人物与资源')
add('\n主测试9局最终均5人存活，每人健康100、恐惧0，房屋耐久100；平均个人疲劳14.6。没有靠减员来降低口粮成本。')
add('\n| 职业 | 种子 | 食物 | 净水 | 建材 | 燃料 | 药品 | 零件 |')
add('|---|---:|---:|---:|---:|---:|---:|---:|')
for r in rs:add('| '+roleNames[r['role']]+' | '+str(r['seed'])+' | '+' | '.join(str(r['final']['resources'][k]) for k in keys)+' |')
add('\n## 一局逐日食物账：修理工、种子53、主测试')
add('\n“其他消耗”不含夜末吃饭；当日获得包括菜畦、工作、搜索和交易。')
add('\n| 天 | 存活人数 | 日初库存 | 当日获得 | 其他消耗 | 当晚需求／实际吃掉 | 夜末库存 |')
add('|---:|---:|---:|---:|---:|---|---:|')
for d in daily:
 if d[0]=='food' and d[1]=='repairman' and d[2]==53:add(f'| {d[3]} | {d[4]} | {d[5]} | {d[6]} | {d[7]} | {d[8]}/{d[9]} | {d[10]} |')
add('\n## 判断与限制')
add('\n- 当前五人食物**可持续，但需要主动补给**。原来的“库存少于人数＋2才搜食物”已经不适用，应按下一晚的完整需求和黄昏产出判断。')
add('- 两块一级菜畦加两名种植者，在晴天平均约8食物／天；五人全工作值勤、耐候公共灶时通常吃14，约6份缺口由搜索或交易补足。')
add('- 公共灶并没有单独解决五人口粮，主测试用耐候灶只省1食物，但同时提供疲劳恢复。没有招募孟姐，尚未评价“按人数节粮”的掌灶路线是否过强。')
add('- 搜索与零件交易具有真实取舍：前者消耗行动、后者消耗零件。交易路线后期仍有10—16零件库存，但具体取决于职业与种子，完整数值见上表。')
add('- 本次是实际引擎的自动玩法测试，不是真人点击或最优策略证明。没有观察玩家服务界面、没有读写玩家数据库，不把通关样本率当作真人难度概率。')
add('\n## 数据和复现')
add('\n- [逐局结果：runs.csv](runs.csv)；[逐日食物账：daily-food.csv](daily-food.csv)；[最终人物：people.csv](people.csv)')
add('- [汇总：summary.json](summary.json)；[源码哈希：source-manifest.json](source-manifest.json)')
add('- 原始记录：baseline-results.json、demand-results.json、food-results.json、search-results.json，均保存在本报告目录。')
add('\n```sh\nnode reports/2026-10-27-five-person-food/run.mjs baseline\nnode reports/2026-10-27-five-person-food/run.mjs demand\nnode reports/2026-10-27-five-person-food/run.mjs food\nnode reports/2026-10-27-five-person-food/run.mjs search\npython3 reports/2026-10-27-five-person-food/build-report.py\n```')
add('\n统计校验：24局逐日食物账平衡；每夜通过客户端结算校验；全部流程从第1天连续推进，成功局均28夜且5人获救；源代码在测试期间未变化。')
(root/'report.md').write_text('\n'.join(text)+'\n')
print(json.dumps(summary,ensure_ascii=False))
