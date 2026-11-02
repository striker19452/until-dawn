# 素材与页面加载优化（2026-10-22）

10张常用图片总量从 18,117,550 字节降到 3,453,630 字节，减少 80.9%。原PNG保留在 client/assets，运行版本改用WebP。人物、生物、设施、道具与昼夜背景保持原尺寸，图集透明通道逐像素一致；色彩采用quality=90的WebP有损编码。仅被高透明遮罩覆盖的装饰纸纹缩至680×680。

|素材|原始KB|网页KB|网页尺寸|
|---|---:|---:|---|
|yard-day-hd-v4|3875.7|733.6|1122×1402|
|yard-night-hd-v4|3088.8|472.3|1122×1402|
|survivors-walk-a-v4|1519.7|419.6|1254×1254|
|survivors-walk-b-v4|1652.8|437.8|1254×1254|
|creatures-walk-a-v4|924.1|277.8|1448×1086|
|creatures-walk-b-v4|1064.7|310.0|1448×1086|
|buildings-v3|929.5|237.6|1774×887|
|props-v3|805.9|208.8|1254×1254|
|survivors-portraits-v1|1088.1|232.0|1774×887|
|paper-wasteland-v1|3168.3|124.3|680×680|

## 加载策略

- 界面主脚本约62KB原始、23.6KB Brotli；大型Phaser场景模块异步下载，读取存档与选择角色不等待引擎。
- 夜间背景在黄昏准备时才开始下载，入夜前等待解码完成；音效开启后才下载3个WAV，不阻塞场景初始化。
- HTML继续no-cache并支持ETag；带内容哈希的素材缓存一年且immutable。修改资源生成新URL；玩家状态API仍no-store。
- JS、CSS、HTML和SVG按Accept-Encoding选择Brotli/Gzip，尊重q=0；服务端缓存编码结果，支持304与正确HEAD响应。

## 实测

Chrome，390×844，本机独立4187 QA服务；网络模拟2Mbps下载、100ms RTT。每次测试使用独立匿名测试存档。

|指标|结果|
|---|---:|
|冷加载DOM就绪|0.40秒|
|冷加载完整院子就绪（含解码/渲染初始化）|13.51秒|
|冷加载静态资源传输|3.12MB|
|同浏览器缓存后DOM就绪|0.13秒|
|同浏览器缓存后院子就绪|0.63秒|
|缓存后静态资源再次传输|0字节|

冷加载数字不包含未打开的头像面板、尚未进入的夜景和关闭的音效。缓存后0字节指静态资源；页面与存档API仍正常联网。这不是公网隧道或实体手机的实测速度。

## 验证与重现

- npm run check、npm run build通过，72项自动测试通过（含压缩协商、缓存、ETag、HEAD与存档网络回归）。
- 11项浏览器检查通过：4种单屏视口、2倍/3倍高清、人物与生物平滑步态、夜间接敌、引擎被阻塞时界面仍可操作、音效与夜景按需下载、慢网及缓存测量。
- 已查看优化后夜战截图，未见透明底、图集错位或画布缺图。
- 证据：.local/validation/assets/loading-metrics.json、optimized-night.png。
- 重建WebP：用含Pillow和WebP支持的Python运行 scripts/optimize-assets.py；原画和裁帧JSON不变。
- 重测：TEST_URL=http://127.0.0.1:4187 npm run test:browser -- browser-test/loading.spec.js。

## V5独立设施后的复验（2026-10-22）

独立房屋、正门、木栏使用新透明图集，替换背景中的固定物体；当前构建13张WebP合计4,271,898字节。新地面quality=90，三张状态图集quality=78，均保持原尺寸与逐像素alpha，PNG原稿保留；重建脚本为`scripts/register-structures.py`，提示词见[ART_SCENE_COMPONENTS_V5.md](ART_SCENE_COMPONENTS_V5.md)。

独立4182 QA、Chrome390×844、2Mbps/100ms：DOM就绪0.39秒，完整院子16.53秒，静态传输3,953,363字节；缓存后静态传输0字节。新增组件未改变延迟加载引擎、夜间背景和按需音效策略。数字为本机模拟，不是公网或实体手机实测。明细在`.local/validation/components/loading-metrics.json`。
