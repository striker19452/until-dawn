# 当前技术栈：浏览器本地存档与夜战

2026-10-28：正式进度迁入浏览器 IndexedDB；夜战仍由浏览器计算。历史服务器方案见 TECH_STACK_SERVER_V2.md。

## 职责

|组件|职责|
|---|---|
|HTML/CSS/JavaScript|经营界面与输入；白天直接调用共享规则并提交本地存档|
|IndexedDB|状态、清晨检查点、修订号、操作去重、夜战结算编号；提交完成后才确认保存|
|Web Worker|运行 src/local-night.js，以固定0.05秒步长模拟整夜并生成一次最终结果|
|Phaser 4|院子绘制、平滑步行与战斗反馈|
|Node HTTP / SQLite|静态资源、已有身份的旧档迁入导出、保留旧版 API；新客户端不向其提交动作与结算|
|Vite|模块与 Worker 构建、引擎异步加载及带哈希资源|

## 数据与运行

`client/campaign-storage.js` 使用 `dawn-browser-saves` 数据库（结构版本1），存储 campaign 规则版本2。`campaign` 保存当前状态与原始清晨检查点，`requests` 保存已应用的请求与动作，`nights` 保存已结算夜战编号。所有修改使用跨这三张表的读写事务，事务内同步执行规则与校验，等待 oncomplete 后才返回结果；读取不回写。数据库不可用、版本不兼容、事务失败时保留原档并报错，不回退到内存假装保存。

初次无本地档时，读取 `/api/campaign/export`，将同一旧 Cookie 对应的状态、runId、revision、updatedAt 与 dawn 一起迁入。并发打开时 ensure 再次检查已有记录，防止覆盖。读取失败提示重试或显式创建新档；迁入成功后不再访问存档 API，过期的旧 sessionStorage 请求不重放。旧服务器数据保留。

白天直接运行 applyCampaignAction；retryDay 恢复本地清晨检查点，nextDay／chooseRole／restart 更新检查点。请求编号与完整动作在事务中去重；修订号不符时返回最新状态供界面刷新。永久防御造价仍校验页面报价。

入夜前获取 Web Lock 并读取最新修订号，防止以过期准备开战。Worker 初始暂停，输入、后台暂停、时钟缺口处理与原有模拟保持一致。完成后在本地运行 validateClientResult，状态和唯一夜战编号一次提交；重复结算返回当前存档，不重复扣食水或发奖。存储失败保留本页结果并退避重试；冲突停止自动重试，提供手动重试和明确放弃。

中途战局不持久化。刷新、关闭或浏览器回收后从入夜前准备重开；尚未提交的结果也随页面丢失。正式存档无需 Cookie，按浏览器与 origin 隔离；清除网站数据会删除进度。没有跨设备同步或离线网页缓存。测试模式仍只用页面内存。

## 性能与画面

- 逻辑20Hz在Worker运行；场景约60Hz独立平滑显示；HUD合并到约5Hz，暂停/关键交互立即显示。
- 原生像素比例起步；可见且持续4秒平均帧间隔>34毫秒时降低到2倍、再到1.5倍，游戏坐标和按钮文字不缩小。暂停与闲置不计入降级判断。
- 关闭WebGL多重采样，保留贴图线性过滤与高清文字；暂停和静止白天停止Phaser循环，输入、场景更新和尺寸变化时唤醒。
- WebP和HTTP缓存/压缩沿用ASSET_OPTIMIZATION.md，夜间没有WebSocket或服务器心跳。

## 验证

`npm run check`、`npm run build`、`npm test` 保留语法、规则与旧版兼容回归。浏览器本地存档专项为 `npm run test:browser -- browser-test/browser-storage.spec.js`：真实 IndexedDB 事务、离线白天与结算、刷新恢复、Cookie 独立性、旧档与 dawn 迁入、重复提交、并发冲突、失败回滚、空间不足、版本保护与多标签页开战保护。
