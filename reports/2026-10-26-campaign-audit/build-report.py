from pathlib import Path
import json,csv,statistics as st,collections,hashlib
root=Path(__file__).resolve().parent
rows=sum([json.loads((root/(f+'-results.json')).read_text())['rows'] for f in ['audit','care','mid']],[])
labels={'active':'主动指挥','idle':'仅自动布防','rotate':'主动＋同伴轮休','care':'主动＋优先护理治疗'}
roles={'repairman':'修理工','medic':'医护人员','watchman':'夜班保安'}
keys=['food','water','materials','fuel','medicine','parts']
mean=lambda xs:round(st.mean(xs),1) if xs else None
fmt=lambda x:'—' if x is None else f'{x:g}'
living=lambda r:[p for p in r['people'] if not p['dead']]
manifest=json.loads((root/'source-manifest.json').read_text())
workspace=root.parent.parent
changes=[p for p,h in manifest['files'].items() if hashlib.sha256((workspace/p).read_bytes()).hexdigest()!=h]
counts=collections.Counter(r['phase'] for r in rows)
nightcount=sum(len(r['nights']) for r in rows)
checks=json.loads((root/'replay-verification.json').read_text())
summary={'date':'2026-10-26','runs':len(rows),'phases':dict(counts),'simulatedNights':nightcount,'testErrors':sum(bool(r['error']) for r in rows),'sourceChanges':changes,'replayChecks':checks,'groups':[]}
for g in labels:
 for size in range(1,6):
  a=[r for r in rows if r['group']==g and r['size']==size]
  if not a:continue
  summary['groups'].append({'group':g,'size':size,'runs':len(a),'wins':sum(r['phase']=='rescued' for r in a),'meanLastDay':mean([r['day'] for r in a]),'finalLivingHealth':mean([p['health'] for r in a for p in living(r)]),'finalLivingFear':mean([p['fear'] for r in a for p in living(r)]),'finalLivingFatigue':mean([p['fatigue'] for r in a for p in living(r)]),'finalHeroFatigue':mean([r['people'][0]['fatigue'] for r in a]),'resources':{k:mean([r['resources'][k] for r in a]) for k in keys}})
(root/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
def csvfile(name,header,data):
 with (root/name).open('w',newline='') as f:
  w=csv.writer(f);w.writerow(header);w.writerows(data)
csvfile('runs.csv',['id','group','role','targetPeople','seed','phase','lastDay','living','dead','severe','house',*keys,'meanHealth','meanFear','meanFatigue','rejectedActions'],[[r['id'],labels[r['group']],roles[r['role']],r['size'],r['seed'],r['phase'],r['day'],len(living(r)),len(r['people'])-len(living(r)),sum(p['wound']=='severe' for p in living(r)),round(r['house'],1),*[r['resources'][k] for k in keys],*[mean([p[k] for p in living(r)]) for k in ['health','fear','fatigue']],len(r['rejections'])] for r in rows])
csvfile('people.csv',['run','phase','lastDay','personId','name','dead','deathCause','health','wound','deadline','fear','fatigue','stamina','nightRole','job'],[[r['id'],r['phase'],r['day'],p['id'],p['name'],p['dead'],p['deathCause'],p['health'],p['wound'],p['deadline'],p['fear'],p['fatigue'],p['stamina'],p['nightRole'],p['job']] for r in rows for p in r['people']])
csvfile('nights.csv',['run','day','phase','elapsed','house','living','dead','meanHealth','meanFear','meanFatigue','heroFatigue',*keys,'hungry','thirsty','breaches','challenge','challengeStatus'],[[r['id'],n['day'],n['phase'],n['elapsed'],n['house'],sum(not p['dead'] for p in n['people']),sum(p['dead'] for p in n['people']),*[mean([p[k] for p in n['people'] if not p['dead']]) for k in ['health','fear','fatigue']],n['people'][0]['fatigue'],*[n['resources'][k] for k in keys],n['hungry'],n['thirsty'],n['breaches'],n['challenge']['title'],n['challenge']['status']] for r in rows for n in r['nights']])
text=[]
def add(s=''):text.append(s)
add('# 60局完整流程测试：人物状态与资源报告')
add('\n日期：2026-10-26（北京时间）。代码以测试开始时的快照为准；测试期间原始源文件哈希未变化。')
add(f'\n共运行 **{len(rows)}局正式样本、{nightcount}次夜战结算**：**{counts["rescued"]}局通关、{counts["failed"]}局失败**，无模拟超时、异常中断或客户端结果校验失败。另将独居失败、三人失败、五人通关各重放一次，终局人物、资源、房屋及逐夜耗时一致；这3次重复不计入60局。')
add('\n本次使用游戏实际的 `applyCampaignAction → createBattle → stepBattle → settleNight` 流程，每夜执行 `validateClientResult`。全部从第1天初始存档出发，通关局连续完成28天，失败局停在真实失败点；不重试、不改资源、不跳波次、不删除敌人。未连接玩家数据库，也未修改游戏数值。')
add('\n## 一、测试策略与覆盖')
add('\n- 随机种子：11、53、97。基础主动组覆盖修理工、医护人员、夜班保安，招募目标为1、3、5人，共27局。另补修理工2、4人，各3局，共6局。人数是招募目标，同伴按游戏开放日期逐渐加入。')
add('- 主动指挥：沿用现有压力测试策略。白天搜索、建设菜畦／集水／公共灶／留言处，修栏和布设翻刺／埋网；夜间每2游戏秒检查一次，主要由主角下达修补、投掷、自救和驱赶，付费干预次数有上限。成员保留游戏自带自动行为。')
add('- 仅自动布防：相同白天准备，入夜后不再手动下令。共9局，仅修理工、1／3／5人。它有白天准备和自动巡守，不等于毫无准备的新手。')
add('- 同伴轮休：修理工1／3／5人各3局；同伴疲劳达到25时安排白天休息和夜间睡眠。其他策略一致。')
add('- 护理补测：修理工1／3／5人各3局；改为优先处理所有重伤、将第三和第四名同伴的固定燃料／陷阱岗位改为护理、主角更早休整。其他战术沿用原策略。这是多项调整的组合测试，不能把结果单独归因于护理岗位。')
add('\n**限制：这是规则知情的自动操作测试，不是真人点击试玩，也不是最优策略搜索。失败只证明这套策略未成功，不证明对应人数无法通关。整体19/60受样本组合影响，不能当成真人通关概率。**')
add('\n## 二、通关情况')
add('\n| 策略 | 目标人数 | 通关／局数 | 最终日期：平均（范围） |')
add('|---|---:|---:|---|')
for g in labels:
 for z in range(1,6):
  a=[r for r in rows if r['group']==g and r['size']==z]
  if a:add(f'| {labels[g]} | {z} | {sum(r["phase"]=="rescued" for r in a)}/{len(a)} | {mean([r["day"] for r in a]):g}（{min(r["day"] for r in a)}—{max(r["day"] for r in a)}） |')
add('\n观察：主动组4、5人样本全部通关；1—3人样本未通关。四人组仅有修理工3局，不能把它和五人组三职业9局视为同等覆盖。主动指挥明显改善了同种子修理工组的进展：独居平均从2.3天到7天、三人从11.3天到20.3天、五人从1/3通关到3/3通关。')
add('\n## 三、最终人物状态')
add('\n下面只统计主动指挥组；健康、恐惧、疲劳为终局存活者的平均值，死人单独记录在明细中。独居至三人是在失败日取值，四、五人是在第28夜后取值，不能理解为所有组都活到了第28天。')
add('\n| 目标人数 | 结局 | 存活者健康 | 存活者恐惧 | 存活者疲劳 | 主角疲劳 |')
add('|---|---|---:|---:|---:|---:|')
for q in summary['groups']:
 if q['group']=='active':add(f'| {q["size"]} | {q["wins"]}/{q["runs"]}通关 | {q["finalLivingHealth"]:g} | {q["finalLivingFear"]:g} | {q["finalLivingFatigue"]:g} | {q["finalHeroFatigue"]:g} |')
add('\n- **五人主动组**：9局全部5人获救，最终每个人健康100、恐惧0；个人疲劳范围5.3—71.6。整个252次夜战结算后房屋均为100；最终健康很漂亮，但中途仍有个体健康降至约67.4、主角疲劳到100的记录，并非整局完全无压力。')
a4=[r for r in rows if r['group']=='active' and r['size']==4]
add(f'- **四人主动组**：3局均4人获救，终局房屋均为100；存活者健康均值{mean([p["health"] for r in a4 for p in living(r)]):g}，主角疲劳均值{mean([r["people"][0]["fatigue"] for r in a4]):g}。比五人组更吃主角状态。')
add('- **独居和三人主动组**：终局主角疲劳接近100，恐惧约92—100，健康约13—14，表现为战线失守后回屋保命、小屋继续被拆。高疲劳和高恐惧与失败同时出现，但不能仅凭终局数据判定谁是最初原因。')
add('\n全60局共出现5人次死亡，全部标记为重伤救治期限到期；没有记录到健康归零导致的攻击、缺补给或搜索死亡。5人次来自4局不同流程，不能当成5个不同角色。护理补测9局没有重伤到期死亡，但三人组仍在第20—22天房屋失守，说明治疗改进没有单独解决防线问题。')
add('\n## 四、最终资源')
add('\n主动指挥组终局资源均值（同样包含提前失败的局）：')
add('\n| 目标人数 | 食物 | 净水 | 建材 | 燃料 | 药品 | 零件 |')
add('|---|---:|---:|---:|---:|---:|---:|')
for q in summary['groups']:
 if q['group']=='active':add('| '+str(q['size'])+' | '+' | '.join(fmt(q['resources'][k]) for k in keys)+' |')
add('\n- 全60局、1074次夜末结算，**饥饿0次、缺水0次**。这套策略能主动补齐食水，因此样本中生存瓶颈不是口粮；这不等于玩家可以不经营补给。')
add('- 五人主动组通关时平均仍有53食物、176.7燃料、44.4零件，建材仅12、药品3。四人组平均剩77.7食物、173燃料、42.7零件，建材8.7。资源压力明显不均衡。')
add('- **燃料和零件结余受策略强烈影响**：基础策略反复深搜工具棚，同时有人固定搜集燃料，却不造发电机，也不大量花零件换食水。因此这些数字说明“这条成功路线不需要消耗它们”，不能直接证明燃料／发电机在所有玩法中无价值。')
add('- 护理补测的五人通关组不再固定搜燃料，平均燃料从同职业基准组的175降至73，仍有较多积累。该补测同时调整了治疗与休整，不能当成单一变量的因果实验。')
add('\n### 五人主动组的阶段状态')
add('\n以下均为同一批9局在指定夜末的平均值：')
add('\n| 夜晚 | 存活者健康 | 恐惧 | 主角疲劳 | 同伴疲劳 | 食物 | 净水 | 建材 | 燃料 | 零件 |')
add('|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|')
for d in [1,7,14,21,28]:
 ns=[n for r in rows if r['group']=='active' and r['size']==5 for n in r['nights'] if n['day']==d];ps=[p for n in ns for p in n['people'] if not p['dead']];crew=[p for p in ps if p['id']!='hero']
 vs=[mean([p['health'] for p in ps]),mean([p['fear'] for p in ps]),mean([n['people'][0]['fatigue'] for n in ns]),mean([p['fatigue'] for p in crew]),*[mean([n['resources'][k] for n in ns]) for k in ['food','water','materials','fuel','parts']]]
 add('| '+str(d)+' | '+' | '.join(fmt(x) for x in vs)+' |')
add('\n## 五、失败位置与过程证据')
losses=[r for r in rows if r['phase']=='failed']
add(f'\n**{len(losses)}局失败的直接条件全部是房屋耐久归零**，没有以主角死亡结束的样本。角色可能先重伤或恐惧退却，但最终失败触发点是小屋失守。失败时主角疲劳≥90的有{sum(r["people"][0]["fatigue"]>=90 for r in losses)}局。')
add('\n- 独居主动组：修理工、医护人员均在第7夜棘冠背兽处失败；保安可到第9—10夜。职业优势能延缓失败，但原策略未形成独居通关路线。')
add('- 三人主动组：失败集中在第19—23夜，另有医护种子53在第14夜失守。并不是都卡在同一个首领。')
add('- 例：修理工／三人／种子53，第19夜失守时仍有59食物、29净水、9建材、64燃料、2药品、34零件；林禾和老周此前因重伤期限到期死亡。资源在库，不代表已及时投入治疗和防守。')
add('- 同种子五人组：完成28夜，5人全部健康100、恐惧0，房屋100；说明额外人手带来的分担，在这套岗位和自动协防策略中远大于新增口粮压力。')
add('\n旧策略还出现行动力不足、设施损毁后操作失败等合法拒绝。基础45局共有402次“行动力不足”的白天操作尝试，失败操作没有执行或扣资源；策略随后继续。这些是测试控制器的取舍／缺陷，不是游戏接口异常。基础策略每天只优先治疗一人、主要操作主角，也没有充分利用当前所有首领机制，因此不能以这些失败直接断言游戏不可解。')
add('\n## 六、轮休与护理补测的含义')
add('\n- **轮休不是越多越好**：三人修理工轮休组全部失败，日期为20、18、22；相同种子的基础组为21、19、21。按疲劳25就同时安排白天休息和夜间睡眠，容易把稀缺战斗人手撤掉，没有稳定收益。')
add('- 五人修理工轮休组3/3通关，但终局平均疲劳17.5，与同职业基础五人组约16相比没有更好。应优先考虑错峰、按下一夜威胁轮休，而不是固定阈值批量休眠。')
add('- 护理组合改进使三人组没有同伴到期死亡，并把同种子流程延续到第20—22天，但仍未通关。回血和情绪恢复有价值，不能替代临场防线与人手分配。')
add('\n## 七、建议优先级（本次未修改平衡）')
add('\n1. **先查1—3人防守容量与第7夜过渡**：补做针对首领机制、低人数集结和退守的合法通关路线；再决定是否调怪，避免按旧脚本的失误直接削弱首领。')
add('2. **让疲劳与轮休更可控**：主角白天行动与夜间劳动叠加显著。对睡眠损失战斗人手的成本做清晰预告，给低人数队伍可执行的恢复窗口。')
add('3. **检查多人后期压力**：主动五人9局通关且逐夜结算房屋始终满耐久，后期资源与健康形成良性循环；应观察真人是否仍有需要临场选择的局面，而不是只提高怪物数量。')
add('4. **调整资源用途前先看来源**：这条路线食物充裕、燃料／零件沉淀；先减少无意义固定搜集，再比较发电、交易、营养恢复等路线，避免简单把口粮消耗翻倍。')
add('5. **加强重伤提醒与治疗优先级**：样本有“库存有药、同伴却到期”的情况。提示距离死亡结算还有多久、当前行动是否足以治疗，以及夜战自救入口，比强迫玩家多囤药更直接。')
add('\n## 八、数据与复现')
add('\n- [逐局结果与最终资源：runs.csv](runs.csv)')
add('- [每名人物最终状态：people.csv](people.csv)')
add('- [每夜人物均值、资源与挑战：nights.csv](nights.csv)')
add('- [汇总：summary.json](summary.json)')
add('- [基础45局完整记录：audit-results.json](audit-results.json)；[护理9局：care-results.json](care-results.json)；[2／4人补测6局：mid-results.json](mid-results.json)')
add('- [源代码哈希清单：source-manifest.json](source-manifest.json)；[重复运行一致性：replay-verification.json](replay-verification.json)')
add('\n执行位置为项目根目录；模拟使用保留在 `.local/campaign-state-audit-20261026/` 的源代码快照：')
add('\n```sh\nnode reports/2026-10-26-campaign-audit/run-audit.mjs\nnode reports/2026-10-26-campaign-audit/run-audit.mjs --care\nnode reports/2026-10-26-campaign-audit/run-audit.mjs --mid\npython3 reports/2026-10-26-campaign-audit/build-report.py\n```')
add('\n快照中的基础控制器只增加观察回调；护理控制器保存在同一快照的 `test/support/care-route.js`，差异为前述治疗、岗位和休整阈值。代码哈希清单针对测试前原始源文件，不含观察插桩与补测策略。初始3局试跑不计入正式样本。')
add('\n未验证的部分：真人操作体验、移动端界面可见性、网络断线保存、多种子总体难度概率、最优独居策略以及发电机专门经营路线。本报告不对此作成功声明。')
(root/'report.md').write_text('\n'.join(text)+'\n')
assert len(rows)==60 and len({r['id'] for r in rows})==60
assert nightcount==1074 and counts['rescued']==19 and counts['failed']==41
assert not changes and all(not r['error'] for r in rows)
assert all(len(r['nights'])==r['day'] and (r['phase']!='rescued' or r['day']==28) for r in rows)
assert all(all(v>=0 for v in r['resources'].values()) for r in rows)
print(json.dumps({'runs':len(rows),'wins':counts['rescued'],'losses':counts['failed'],'nights':nightcount,'sourceChanges':changes,'report':str(root/'report.md')},ensure_ascii=False))
