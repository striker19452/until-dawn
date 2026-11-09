import json,gzip,collections,statistics
from pathlib import Path
root=Path(__file__).parent
names=['before','after','adaptive-before','adaptive-after']
data={name:json.loads((root/(name+'.json')).read_text()) for name in names}
summary={}
for name,rows in data.items():
 assert not any(r.get('error') for r in rows)
 assert all(r['s']['phase'] in ['failed','rescued'] for r in rows)
 assert all([n['day'] for n in r['nights']]==list(range(1,len(r['nights'])+1)) for r in rows)
 summary[name]={'attempts':len(rows),'rescued':sum(r['s']['phase']=='rescued' for r in rows),'earliestStop':min(r['s']['day'] for r in rows),'latestStop':max(r['s']['day'] for r in rows),'completedNights':sum(len(r['nights']) for r in rows),'stopDays':dict(collections.Counter(r['s']['day'] for r in rows))}
rows=data['adaptive-after']
r=next(r for r in rows if r['role']=='watchman' and r['size']==5 and r['seed']==97 and not r['rotate'])
summary['example']={'role':r['role'],'seed':r['seed'],'size':r['size'],'foodActuallyUsed':sum(d['settled']['report']['foodUsed'] for d in r['daily']),'waterActuallyUsed':sum(d['settled']['report']['waterUsed'] for d in r['daily']),'hungryDays':[d['day'] for d in r['daily'] if d['settled']['report']['hungry']],'resources':r['s']['resources'],'people':r['s']['people']}
(root/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
lines=['# 连续28天经营与夜战审计','', '2026-11-06。本次只增加审计脚本与报告，未改游戏数值或正式策略测试。','', '## 结论','', '**尚未找到从真实新档连续通关28天的路线。** 取消后测试126条路线，0条获救；取消前同条件也为0/126，不能把当前失败全部归因于取消普攻削减蓄力，也不能用此次样本证明游戏无解。此前独立夜战84/84只证明补给充足的单关战术可行，不证明连续经营可持续。','', '## 测试方法','', '- 从 initialCampaign 选择职业开始，逐日使用真实经营动作、AP和价格；通过真实招募取得成员，队伍规模为招募上限而非初始人数。','- 每夜通过 createBattle、stepBattle、settleNight 运行并校验 validateClientResult。资源、围栏、设施、生命、伤病、疲劳、恐惧与技能全部由结算传给翌日；没有补给注入、状态重置、跳关或失败后免费刷种子。','- 失败立即停止；没有为了“跑满28天”绕过每日必达目标。因此13～28天的连续状态未得到验证，不能外推。','- 三职业：保安／修理工／医护；三种子11／53／97。历史经营策略：目标人数1～5、轮休开关，共90次／规则版本。预告应对策略：目标人数3或5、轮休开关，共36次／版本。轮休开关在部分档案上不会触发，结果可能重复；这些不是独立真人胜率样本。','- 取消前使用上一轮隔离副本恢复普攻削减3进度、跳跃取消与旧陷阱处理，其他经营规则一致。','- 预告策略在旧经营脚本基础上，优先按每日公开预告安装翻刺／埋网，分配守卫、按疲劳安排同伴休息，并使用投掷、顶住与修补。所有操作仍需真实AP／物资。它不是穷尽或最优策略搜索。','', '| 经营与夜战方案 | 规则 | 获救 | 失败日范围 | 实际模拟夜数 |','| --- | --- | --- | --- | --- |']
for name,label,rule in [('before','历史策略','取消前'),('after','历史策略','取消后'),('adaptive-before','预告布防＋主动控制','取消前'),('adaptive-after','预告布防＋主动控制','取消后')]:
 s=summary[name];lines.append(f"| {label} | {rule} | {s['rescued']}/{s['attempts']} | {s['earliestStop']}～{s['latestStop']} | {s['completedNights']} |")
lines+=['','## 连续档实例：保安，种子97，目标五人','', '取消后该档通过第1～11天，第12夜失败。小屋100，全员存活，无破栏；失败原因为实际发生1次召援，违反当夜无召援目标。第12天末五人生命约66／28／30／30／50，主角疲劳98.3，药品0；水42、燃料31、建材19，食物0。','', '实际消耗与需求分开记录：食物不足时结算只扣现有数量，同时施加饥饿伤害；下表“实耗”不能视为足额满足需求。','', '| 日 | 夜末人数 | 食物余量／实际吃掉 | 水余量 | 建材余量 | 主角疲劳 | 主角生命 | 缺粮 |','| --- | --- | --- | --- | --- | --- | --- | --- |']
for d in r['daily']:
 s=d['settled'];p=s['people'][0];lines.append(f"| {d['day']} | {sum(not p['dead'] for p in s['people'])} | {s['resources']['food']}／{s['report']['foodUsed']} | {s['resources']['water']} | {s['resources']['materials']} | {p['fatigue']:.1f} | {p['health']:.1f} | {'是' if s['report']['hungry'] else '否'} |")
lines+=['','累计实际食物消耗'+str(summary['example']['foodActuallyUsed'])+'、净水'+str(summary['example']['waterActuallyUsed'])+'；第5、6、8、9、10、11、12天缺粮。水和燃料富余而食物不足，说明本策略生产与消费分配失衡。主角第4天疲劳已到100，反映白天搜索／建设与夜间值守缺少足够恢复。上述状态是连续经营风险的证据，不应据此把整局判为必败。','', '## 判断与后续优先项','', '取消普攻削减使旧打法更早暴露问题，但基础经营策略在取消前也不可持续。下一步应寻找并复核“食物收支平衡＋主角保留休息AP＋低疲劳成员负责短窗口打断”的真实经济路线，再判断是否需要调整游戏平衡；目前没有连续通关证据，不建议以单关全部可解作为整局已平衡的依据。','', '## 数据与复现','', '- summary.json：汇总及实例完整人员状态。','- before.json.gz / after.json.gz：历史经营策略原始记录。','- adaptive-before.json.gz / adaptive-after.json.gz：预告应对策略原始记录。','- 每条记录包含逐日清晨、准备后、结算后快照，白天动作及资源变化、失败指令原因、夜战劳动量和成员状态。','- campaign-route.mjs / adaptive-route.mjs：两种真实流程脚本。run.mjs / run-adaptive.mjs：测试矩阵。','- 当前规则复现：`node reports/2026-11-06-campaign/run-adaptive.mjs "$PWD/reports/2026-11-06-campaign/adaptive-route.mjs" /tmp/campaign-replay.json`。旧规则需在隔离副本使用相同策略模块。','']
(root/'report.md').write_text('\n'.join(lines))
for name in names:
 path=root/(name+'.json');(root/(name+'.json.gz')).write_bytes(gzip.compress(path.read_bytes(),mtime=0));path.unlink()
print(json.dumps(summary,ensure_ascii=False,indent=2)[:2600])
