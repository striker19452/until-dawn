# 单一中央篝火 V6（2026-10-22）

院内只保留中央石砌火塘。防区不再安装火盆或遮雨棚，添火与清理直接作用于中央篝火。旧存档中的旧设施标记保留，但不会生成周边火源、扣除其燃料或留下寻路障碍。入夜中央点火仍只消耗1燃料；原有中央火塘的防护、暖身与近火减伤规则保留。

## 美术与实际文件

采用内置 `image_gen.imagegen`，以原手绘道具图集为风格和编辑参考，分别生成炉底及火焰层。原生 PNG 保留，网页编码采用1024×512 WebP；没有放大素材。网页RGBA透明通道与对应尺寸交付稿逐像素一致。

|文件|原生尺寸 / 网页尺寸|布局与内容|
|---|---|---|
|`client/assets/campfire-base-v6.png` / `.webp`|1774×887 / 1024×512|2列1行，日间与夜间的同一石圈、柴堆、灰烬|
|`client/assets/campfire-flames-v6.png` / `.webp`|1774×887 / 1024×512|2列2行，4个火焰姿态，不包含炉底|
|`client/assets/campfire-v6.json`|实际裁帧、透明包围盒与锚点|炉底以地面中心注册，火焰以底部火根注册|

网页版本分别119242与109508字节，合计228750字节。火焰图的实际单格为512×256，并非提示词要求的正方形，运行时按实际矩形裁帧，不依赖假定尺寸。

`scripts/register-campfire.py` 读取原PNG，以Pillow生成交付尺寸、注册JSON和quality=88的WebP；原PNG不重绘、不修改。运行时采用固定炉底、独立火焰帧、加色柔光和细小余烬，地面暖光不会绘制不透明底板。日间空闲以低频唤醒播放，夜战暂停则冻结全部篝火动画；减少动态效果偏好下关闭摇曳与飞散余烬。火势低时只减弱火焰和光照，不缩放炉底。熄灭、未点燃或湿污仍保留石圈柴堆。原先盖住火焰的三角棚片和火源范围圈已移除。

## 代码

- `src/campfire.js` 统一中央火源和火塘占地；`src/battle.js` 只建立一个火源。
- `src/campaign.js` 不再接受周边火盆/遮雨建设和点火。
- `client/campfire-art.js` 管理独立的炉底、火焰、柔光、余烬及湿污状态。
- `client/scene-components.js` 只实例化一座中央火塘；`client/combat-feedback.js` 只显示中央火势。
- 夜战界面采用中央篝火状态卡，取消火源选择；添火、清理固定作用于中央。

## 验证

`test/campfire.test.js` 验证旧存档仅生成一个火源、只扣一份启动燃料、不留周边导航障碍、拒绝新增周边火盆、熄火后仍可添火。

`browser-test/campfire.spec.js` 验证昼夜、4帧火焰、炉底稳定、湿污、熄灭、暂停冻结、固定中央添火和界面清理。实机浏览器截图保存在 `.local/validation/central-campfire/art/campfire-day.png`、`campfire-night.png`、`campfire-night-wet.png` 和 `campfire-night-unlit.png`。CPU降速和慢网加载另由现有性能、加载用例覆盖。首次静态传输预算由4.0MB调整为4.25MB，包含新两层美术；新素材本身小于250KB。

## 最终提示词与生成方式

方式：内置 `image_gen.imagegen`，两次调用，均设 `transparent_background=true`。

炉底输入：`client/assets/props-v3.webp`。原始输出：
`/Users/str/.codex/generated_images/01a163f3-f227-7a92-b84f-4ebd5944990b/exec-ad34e3be-a885-465d-880c-25d63085a01f.png`。

```text
Use case: precise-object-edit. Input image 1 is the EDIT TARGET and style reference: this hand-painted survival game props atlas. Redesign ONLY the campfire in its top-left cell into a premium central courtyard stone FIRE PIT, and output the isolated pit as a new dedicated transparent atlas. Asset: exactly TWO equal square cells side by side in one row: LEFT daylight, RIGHT moonlit night, identical geometry, size, center and foot alignment. Each cell contains the same LOW OVAL ring of irregular weathered grey-brown stones, a few natural split logs laid across a recessed bed of ash and charcoal, dark cracks, subtle soot, carefully hand-painted bark and masonry. This is the permanent unlit BASE of an animated campfire; no flames and no bright fire glow are baked into this base. Night cell has subdued cool slate-brown moonlit colors, not solid black, maintaining legible detail. Match the game's warm gouache/watercolor and fine sepia pencil linework, overhead three-quarter courtyard perspective, charming handmade board-game art, no photorealism. Make the stone pit broad and low, its ground ellipse clearly horizontal; modest domestic campfire scale, not a huge bonfire. Entire pit with all stones and logs sits centered in the lower-middle of each cell with generous true transparent padding, same center and ground baseline in both cells. Genuine transparent RGBA background including gaps around stones. No people, other props, roof, canopy, poles, platform, ground tile, background glow, labels, text or grid lines. Exactly TWO isolated matching pits, one per cell.
```

火焰输入：上述炉底输出，仅作为配套风格与构图参考。原始输出：
`/Users/str/.codex/generated_images/01a163f3-f227-7a92-b84f-4ebd5944990b/exec-6a0d3fb9-af00-4680-b308-315e18bc40f7.png`。

```text
Use case: stylized-concept. Create the separate animated FLAME LAYER for the supplied central courtyard stone campfire base (reference only). Output exactly FOUR equal square cells in a 2x2 transparent sprite atlas, read left to right then next row. Each cell contains ONLY one compact lively golden-orange campfire flame cluster with a few glowing embers at its bottom. Four consecutive hand-drawn animation poses: flames bend a little left, gather upright, bend a little right, then spread gently, forming a smooth loop. Same flame width and height, same scale, identical bottom contact center and baseline in all four cells. Anchor the root of every flame cluster at horizontal center and about 85% cell height, tips about 20% height, ample transparent safety gutters. Match the existing hand-painted gouache/watercolor and fine sepia ink game art, with rich amber cores, pale golden inner tongues and darker warm orange outer curls, painterly irregular soft edges. Several interwoven small flame tongues rather than one giant icon; controlled domestic campfire with calm natural motion, not an explosion. Visible warm detail against both a light daytime courtyard and a dark blue night courtyard. Do NOT draw the stone pit, logs, ground, ring, canopy, torch, border, backdrop, smoky opaque rectangle, lens flare, text or other objects. No painted light disk behind the flame. Genuine transparent RGBA background between all tongues and in every cell gutter. Exactly FOUR isolated flame clusters, one per cell. This layer will be animated above a stationary stone/log base; do not move its root across frames.
```

