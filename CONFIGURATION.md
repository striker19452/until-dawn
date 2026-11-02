# 数值配置与自动说明

游戏结算和界面说明读取同一份配置。修改数字后，无需再手写一份说明；重新构建会同时更新页面和 [当前规则](RULES_CURRENT.md)。

|要调整的内容|配置入口|
|---|---|
|每日行动、队伍人数上限|`src/balance.js` → `CAMPAIGN_RULES`|
|设施产量、天气加成、高产／耐候、发电、工作棚、交换|`src/balance.js` → `PRODUCTION`|
|食水需求、工作和夜战加餐、掌灶节省、饥渴伤害|`src/balance.js` → `RATIONS`|
|白天动作行动数、配方、治疗、休整、修栏、扩床|`src/balance.js` → `DAY_ACTIONS`|
|同伴分工收益、岗位疲劳、技能成长|`src/balance.js` → `WORK`、`GROWTH`|
|攻击伤害、陷阱、投掷、诱饵、压实、火效、夜战耗时／成本|`src/balance.js` → `COMBAT`、`NIGHT_ACTIONS`|
|夜末和清晨恢复、暴露、故事奖励、挑战奖励、首领阶段|`src/balance.js` → `RECOVERY`、`EXPOSURE`、`STORY_RULES`、`CHALLENGE_REWARD`、`BOSS_RULES`|
|搜索地点掉落、设施造价与数量上限、职业和同伴体力|`src/content.js` → `SITES`、`BUILDINGS`、`ROLES`、`COMPANIONS`|
|深搜和随行加成、风险、行动数|`src/search.js` → `SEARCH_RULES`|
|普通生物生命、速度、围栏伤害、特殊动作蓄势|`src/content.js` → `ENEMIES`、`ENEMY_WINDUP`|
|生物对人的伤害和伤害反馈节奏|`src/enemy-damage.js` → `ENEMY_DAMAGE`、`enemyDamageProfile`|
|首领基础数值、分裂体生命／速度／数量与标识、爆囊伤害|`src/boss-content.js`|
|篝火火势、衰减、余柴、烧柴速度|`src/campfire.js`|
|小狗每日口粮、吠叫概率与间隔、普通生物短退时间与速度|`src/dog.js` → `DOG_RULES`|
|恐惧情境、门槛；疲劳效率、白天／清晨／睡眠恢复|`src/fear.js`、`src/fatigue.js`|
|设施耐久、维修成本、经营位置|`src/building-health.js`|
|人物攻击距离、普通攻击眩晕、生物近战距离|`src/rules.js`|
|接应配方、冷却、准备与援助上限|`src/rescue.js` → `RESCUE_RULES`|
|出怪时间、挑战间隔、每日挑战目标|`src/night-pacing.js`、`src/challenges.js`|

例如调整工具棚搜索燃料，只改 `SITES.shed.loot.fuel`；深搜和随行预览、实际收获、手记日志及规则文档会使用该掉落配置。调整集水分支则改 `PRODUCTION.water`：产量由基础量、等级增量、分支加成和天气加成计算，耐候读取 `steady`。

## 生成与验证

```sh
npm run docs:rules  # 单独更新规则文档
npm run docs:check  # 只检查文档是否与配置一致
npm run check      # 语法检查
npm test           # 先生成规则，再跑测试
npm run build      # 先生成规则，再构建页面
```

`src/descriptions.js` 生成设施、升级、配方和基础规则说明；`client/rule-help.js`、`client/action-help.js`、`client/skills.js` 等根据人物与院落状态生成实际收益。搜索预览与结算共用 `searchPlan`，夜战耗时共用 `orderDuration`；不要在界面另写一套公式。

`scripts/generate-rules.js` 使用这些相同的配置和说明函数生成 `RULES_CURRENT.md`，不要直接修改生成文件。`test/generated-descriptions.test.js` 会临时改变配置，执行真实动作并对照说明、结算和存档校验；测试结束恢复配置，不写玩家存档。

修改后需要重新构建前端、重启正在运行的 Node 服务，再刷新已打开的游戏页面，使浏览器和服务端采用同一版配置。历史战报、平衡报告、设计稿记录当时版本，不会被生成流程追溯改写。
