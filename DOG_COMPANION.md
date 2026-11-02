# 小院伙伴 · 小麦

通过「菜单 → 小院伙伴 · 小狗」或「经营」收留。免费、不耗行动、不占人员与床位，本局最多一只；收留记录保存在 `flags.dog`，旧存档不自动领养。清晨回档沿用既有规则。

每天夜末固定消耗1食物，不消耗净水，不受公共灶或掌灶减免。食物预览、日耗详情、黄昏准备和战报均计入；刷新和重复上传不会额外扣粮。

白天完全自主，随机小跑、嗅闻、摇尾、歪头、伸懒腰、露肚皮打滚、蜷睡，并随机选择人员靠近、仰头撒娇。人员轻微俯身回应，出现柔和的小爱心；不改变人员数值或任务。小狗遵循小院寻路与设施遮挡。

夜间每9～16秒随机选择一只存活、未退却、未倒地的生物吠叫；35%几率使普通生物以14单位/秒后退2秒，随后恢复进攻。**不造成伤害，不使生物离场，首领完全不受影响**；仍会随机叫到首领。没有可下达的小狗指令、目标选择或人员分工。首声检查在入夜6秒，无目标则等待下次检查。随机数独立于敌人生成，领养不会改动来袭计划。

画面使用16帧手绘姿势，加上呼吸、耳身轻颠、打滚摇摆、睡眠提示、人员回应与爱心。夜战暂停冻结全部动作；支持减少动态效果。打开音效时，吠叫播放两声轻柔的程序合成短音。

配置入口：[src/dog.js](src/dog.js) 中的 `DOG_RULES`。渲染入口：[client/dog-art.js](client/dog-art.js)。

## 素材

使用内置 `image_gen.imagegen`，透明背景，未使用 CLI。

- 原始图集：[client/assets/puppy-v1.png](client/assets/puppy-v1.png)
- 运行素材：[client/assets/puppy-v1.webp](client/assets/puppy-v1.webp)
- 16帧注册：[client/assets/puppy-v1.json](client/assets/puppy-v1.json)
- 完整实际提示词：[client/assets/puppy-v1.prompt.json](client/assets/puppy-v1.prompt.json)
- 重建注册与WebP：[scripts/register-puppy.py](scripts/register-puppy.py)，保留原始alpha并验证转换前后一致。

## 验证

`test/dog.test.js` 覆盖单只收留、日耗独立计算、随机动作和寻路、单目标随机吠叫、失败概率、首领免疫、短退后继续进攻、暂停、首夜／首领夜／最终夜结算与存档校验。`browser-test/dog.spec.js` 覆盖收留后刷新、日耗展示、手机和桌面撒娇互动、夜战吠叫及暂停画面。

## 互动朝向与行走步态

小狗主动靠近人员时，人物先转向小狗，再做俯身回应；小狗位于左侧或右侧均适用，走开后恢复原来的日常站姿与移动逻辑。新绘制的四帧步态区分后腿抬起、向后伸展和落地，步频随场景中的实际移动距离变化，慢走更慢，停下或夜战暂停时不空踩。使用独立行走图集，其他撒娇、打滚和休息姿势继续使用原图集。

新图集由内置 `image_gen.imagegen` 参考原小麦图集生成：

- 原始图集：[client/assets/puppy-walk-v2.png](client/assets/puppy-walk-v2.png)
- 运行素材：[client/assets/puppy-walk-v2.webp](client/assets/puppy-walk-v2.webp)
- 帧注册与生成提示词：[client/assets/puppy-walk-v2.json](client/assets/puppy-walk-v2.json)、[client/assets/puppy-walk-v2.prompt.json](client/assets/puppy-walk-v2.prompt.json)
- 重建与透明度校验：[scripts/register-puppy-walk.py](scripts/register-puppy-walk.py)
