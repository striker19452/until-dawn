# 独立场景设施素材 · V5

2026-10-22。使用内置 `image_gen.imagegen` 编辑现有院子图；保持原有水彩铅笔风格。原始生成 PNG 原样复制，浏览器使用同尺寸 WebP。没有通过程序重画、删除或合成图中物体。`scripts/register-structures.py` 只读取 alpha 注册点、生成 JSON、编码 WebP，并验证透明通道逐像素一致。人物轮廓由运行时按当前动作帧绘制，不另换角色图。

| 文件 | 实际尺寸 | 用途 |
| --- | --- | --- |
| `client/assets/yard-ground-day-v5.png` / `.webp` | 1122 × 1402 | 移除房屋、五处木门栏与中央火盆后的白天地面背景 |
| `client/assets/yard-ground-night-v5.png` / `.webp` | 1122 × 1402 | 对应夜间背景 |
| `client/assets/house-states-v5.png` / `.webp` | 1774 × 887 | 2 × 1，白天／夜间独立透明房屋 |
| `client/assets/gate-states-v5.png` / `.webp` | 1536 × 1024 | 3 × 2，每行完好／受损／破开，上白天下夜间 |
| `client/assets/fence-states-v5.png` / `.webp` | 1536 × 1024 | 3 × 2，木栏昼夜各三种耐久状态 |
| `client/assets/structures-v5.json` | — | 房屋、正门和既有八类建筑逐格裁帧与脚底注册点 |

房屋与正门透明像素分别约43%／41%。PNG 具有真实透明通道，网页编码保持原 alpha，地面quality=90、独立状态图集quality=78；未用底色抠图。门和房屋的透明留白通过 alpha 包围盒统一锚点，门的六个状态始终位于同一防区。组件按脚底深度排列，遮挡进一步检查素材 alpha，空白角落不会触发。

## 生成提示词组

以下记录本次五项编辑的完整美术要求。参考源为 `yard-day-hd-v4.png` 和 `yard-night-hd-v4.png`，均在编辑前目视检查。输出没有插值放大。

### 白天地面背景

Edit the supplied existing hand-painted survival courtyard image into a clean DAYLIGHT background plate for independent game objects. Preserve the exact 1122 × 1402 composition, overhead isometric camera, courtyard boundaries, surrounding ruined neighborhood, stone wall ends, ground perspective, colors, watercolor-pencil brushwork and all unrelated details. This is a precise object-removal edit, not a redesign. Remove the entire cottage roughly x=280–815, y=290–660 including roof, chimney, walls, windows, doorway, pots, bench and steps; restore continuous empty courtyard ground behind it. Remove the entire roofed FRONT GATE roughly x=400–710, y=970–1190 including wooden leaves, roof cap and gate posts, leaving the opening and adjacent stone walls intact. Remove the four wooden rear and side fence infill panels only, keeping the stone wall ends and their openings. Remove the central fire pit roughly x=465–650, y=720–840 including flame, stones and fire glow, replacing it with ordinary ground. Keep the laundry and remaining environment. No new structures, units, UI, letters, labels or decorative objects. Output one opaque background image, same framing and dimensions.

### 夜间地面背景

Edit the supplied existing hand-painted NIGHT survival courtyard image into a clean NIGHT background plate matching the daylight clean plate. Preserve the exact 1122 × 1402 composition, camera, stone walls, roads, neighboring ruins, cool moonlit palette and watercolor-pencil brushwork. Remove the entire cottage roughly x=280–815, y=290–660 including roof, chimney, windows, doorway, pots, bench and steps; remove its local window glow, and restore empty moonlit courtyard ground. Remove the entire roofed front gate roughly x=400–710, y=970–1190 including leaves, roof and posts, while preserving adjacent stone wall ends and the opening. Remove the four wooden rear and side infill panels while preserving their stone openings. Remove the central fire pit roughly x=465–650, y=720–840, flame, stones and local glow. Keep laundry and unrelated environment. No replacement structures, units, UI, text or labels. Output one opaque image with the exact same framing and dimensions.

### 房屋昼夜透明图集

Use the original courtyard cottage as reference and create a transparent two-state game sprite atlas, exactly TWO equal square cells side by side in one row. LEFT is daylight, RIGHT is night. Isolate only the cottage: its original roof, chimney, walls, doorway, windows, pots, bench and steps. Preserve the established overhead isometric perspective, proportions and warm watercolor-pencil style, without redesigning it. Both cells show the same building at precisely the same scale, angle, horizontal alignment and foot baseline. At night retain the original cool roof and warm window lighting contained within the building. Leave roughly 8% transparent safety margin within each cell. No ground tile, surrounding walls, neighboring structures, people, creatures, UI, borders, words or labels. Genuine transparent RGBA background, including between the two cells.

### 正门六状态透明图集

Use the original courtyard roofed front gate as reference. Create a genuine transparent RGBA game sprite atlas, exactly THREE columns by TWO rows of equal square cells. Top row DAYLIGHT, bottom row NIGHT. In each row the columns are: 1 intact gate with closed wooden leaves; 2 visibly DAMAGED but still blocking gate with cracked/split boards and loosened hardware; 3 BREACHED gate with a wide unmistakable open passage, fallen/broken wooden leaves and debris beside the opening. Keep original roof cap and stone/wood jamb identity, camera angle, overall scale and foot baseline consistent across all six cells. Preserve the hand-painted watercolor-pencil survival courtyard style. Night cells use the original cool moonlit materials. Keep a 10% transparent safety margin. Do not add adjacent wall sections, ground tiles, scenery, units, labels, UI, text or borders. Do not represent damage only by color: use distinct broken geometry. Background and open breached passage must be transparent.

### 木栏六状态透明图集

Using the attached daylight and night courtyard images as the STYLE reference, create a transparent RGBA sprite atlas for the small wooden fence infill panels in this exact hand-painted watercolor-and-colored-pencil survival game. EXACTLY 3 columns by 2 rows of equal square cells. TOP ROW daylight: intact wooden fence, damaged wooden fence, destroyed wooden fence. BOTTOM ROW same three states at NIGHT with dark muted cool brown boards, not pale or glowing. Each fence is a low rustic panel of 6–7 irregular weathered vertical wooden planks on two horizontal rails, short side posts; NO roof and no stone masonry. Intact blocks the full span; damaged has visibly cracked or missing upper plank edges yet still blocks; destroyed has a wide open gap and only short broken side posts with fallen splintered boards on the ground. Same width, overhead isometric viewpoint, scale, origin, and bottom baseline in all six cells. Gentle top-down view matching the game courtyard, front face visible. Keep 12% transparent margins in every cell. No lettering, labels, borders, UI, people, creatures, ground tile, wall sections, backdrop, grass or extra objects. Genuine transparent pixels behind the panels and within the destroyed gap. Detailed warm watercolor pencil wood grain and broken geometry, preserve calm handmade art rather than flat vector shapes.

## 代码与验收

- `client/scene-components.js`：每个设施独立实例，拥有容器、显示对象、状态及销毁生命周期。包括房屋、五处防线、八类建筑实例、每只陷阱、埋网、翻刺、铃绳、压实土道、火盆和遮雨棚。
- `client/scene-layout.js`：共用美术坐标、耐久状态、前后关系与遮挡采样；模拟坐标与寻路不变。
- `client/unit-outline.js`：按前景建筑、门栏的实际透明像素裁切当前步行帧，露出的身体保留实色，仅被挡住的部分显示空心半透明轮廓；人物浅青、生物浅金，选中人物保持金色高亮。裁切同步处理侧栏投影、转身和步态倾斜；轮廓缓存最多64帧，暂停跟随游戏冻结。
- 正门耐久满值用完好图，0至满值之间用受损图，归零用破开图；修补后按实际耐久回切。破开门不遮挡单位。
- 测试截图与数字结果保存在 `.local/validation/components/`，验证结论见 `IMPLEMENTATION_STATUS.md`。

## 左右门朝向修正（2026-10-22）

左右木门不再与后栏共用水平朝向。使用Phaser原生Mesh2D把原图沿两侧院墙投影：左侧基线向右上延伸，右侧向右下延伸，木柱竖直；仍使用原有昼夜三态素材，没有另增下载图片。纹理坐标沿用Phaser帧的原生UV以保持昼夜和上下方向一致。遮挡多边形、局部脚底深度与alpha反投影同步，薄门板在身体包围盒相交区域补充采样；破开后移除遮挡。验收截图在`.local/validation/side-doors/`。

## V6 中央篝火更新（2026-10-22）

院内已统一为一座中央石砌火塘，移除周边火盆和旧三角遮雨棚表现。新炉底、独立火焰、暖光与余烬见 [中央篝火V6](ART_CENTRAL_CAMPFIRE_V6.md)。上文V5火盆与遮雨棚描述保留为历史记录。
