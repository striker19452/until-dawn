# 游戏手绘素材生成记录

生成日期：2026-10-21

模式：内置 `image_gen.imagegen`；未使用 CLI、API 密钥、Python 或图像裁剪。最终项目文件是所选原始输出的直接复制件。头像进行了两次内置编辑，以改善安全边距和均匀网格。

## V5 独立房屋、门和设施（2026-10-22）

房屋、五处木门栏和中央火盆已从新背景中移除，作为独立组件管理；正门使用昼夜各三态专用图集。新原图、透明通道、实际尺寸、注册脚本与完整提示词组见 [ART_SCENE_COMPONENTS_V5.md](ART_SCENE_COMPONENTS_V5.md)。人物和生物仍沿用V4动作帧，被设施遮挡时按当前帧绘制透明空心轮廓。

## V4 高清绘制与步行素材

2026-10-21至22日，用户进一步要求高清化、平滑移动并有走动动作，取消移动淡入淡出。以下六张图片均通过内置 imagegen 制作，原始PNG直接复制到项目；两份JSON仅描述读取原图得到的裁帧与锚点，不修改像素。

| 项目文件 | 实测像素／内容 | 完整提示词与检查 |
| --- | --- | --- |
| [yard-day-hd-v4.png](client/assets/yard-day-hd-v4.png)、[yard-night-hd-v4.png](client/assets/yard-night-hd-v4.png) | 各1122×1402，昼夜细节重绘，实际没有达到请求的2K | [院子记录](ART_YARD_HD_V4.md) |
| [survivors-walk-a-v4.png](client/assets/survivors-walk-a-v4.png)、[survivors-walk-b-v4.png](client/assets/survivors-walk-b-v4.png) | 各1254×1254，4×4，八个人物各四帧 | [人物记录](ART_WALK_HUMANS_V4.md) |
| [creatures-walk-a-v4.png](client/assets/creatures-walk-a-v4.png)、[creatures-walk-b-v4.png](client/assets/creatures-walk-b-v4.png) | 各1448×1086，4×3，六类生物各四帧 | [生物记录](ART_WALK_CREATURES_V4.md) |

源图分辨率与运行时绘制分辨率分开记录：画布按CSS尺寸乘设备像素比绘制，标签纹理同步提高精度，高清不会增加屏幕上的布局尺寸。生成图集是简化迈步循环，部分相位并非标准的左右腿交替；已选择可用姿态并用逐帧头部／足部锚点校准，实际移动保持连续且不透明。

人物裁帧与锚点为 [survivors-walk-v4.json](client/assets/survivors-walk-v4.json)，可用 `python3 scripts/register-human-walk.py` 从原图alpha重新计算。生物锚点为 [creatures-walk-v4.json](client/assets/creatures-walk-v4.json)。这些分析仅读取PNG；没有裁改生成图文件。实际场景截图与步行录像在 `.local/validation/v4/`。

## V3 场景素材（保留）

2026-10-21 根据“固定单屏、精美素材、减少动作”的要求新增六个 PNG 文件。全部使用内置 imagegen，原始生成结果直接复制到项目，未用程序裁剪或改色；网格取帧在运行时完成。

| 项目文件 | 内容 | 完整提示词、原始路径与检查 |
| --- | --- | --- |
| [yard-day-v3.png](client/assets/yard-day-v3.png) | 暖色白天院子 | [院子记录](ART_YARD_V3.md) |
| [yard-night-v3.png](client/assets/yard-night-v3.png) | 同布局月夜与暖窗 | [院子记录](ART_YARD_V3.md) |
| [survivors-fullbody-v3.png](client/assets/survivors-fullbody-v3.png) | 4×2透明全身人物 | [角色记录](ART_CHARACTERS_V3.md) |
| [creatures-v3.png](client/assets/creatures-v3.png) | 3×2透明异变生物 | [角色记录](ART_CHARACTERS_V3.md) |
| [buildings-v3.png](client/assets/buildings-v3.png) | 4×2透明设施 | [设施记录](ART_BUILDINGS_V3.md) |
| [props-v3.png](client/assets/props-v3.png) | 2×2透明篝火、灯笼、修补工具、绊索 | [设施记录](ART_BUILDINGS_V3.md) |

人物与生物每种只用一个精绘姿势，移动共用淡出和淡入，作业共用轻微缩放；背景、设施和人物采用同一暖色手绘风格。院子之外保留荒败，院子以内保留窗灯、晒衣与生活用品。素材实际接入后的截图见 `.local/validation/v3/`。

## 纸张纹理

- 项目路径：`client/assets/paper-wasteland-v1.png`
- 原始输出：`/Users/str/.codex/generated_images/01a15ddf-1ba6-7d93-860a-64e0ae01b1cb/exec-266d4784-85fa-4097-9cb7-4966e91e91a8.png`
- 尺寸：1254 × 1254 像素；不透明 PNG。
- 已通过 `view_image` 目视检查：淡米灰纸纤维与干笔颗粒，低对比、全幅均匀；没有文字、物体、角色、地图、房屋或边框。适合以适当不透明度叠加到界面与院子地面。

完整生成提示词：

```text
Use case: stylized-concept
Asset type: production texture for a mobile portrait post-apocalyptic survival management game, warm hand-painted wasteland visual style.
Primary request: Create a flat, uniform, subtle watercolor paper texture with no subjects or objects, suitable for a UI background and a courtyard-ground overlay.
Composition: square texture filling the entire canvas edge to edge. No focal point, no vignette, no framing, no border, no composition that resembles a scene. Keep visual density and brightness uniform across the image.
Palette: very pale warm beige-grey and olive-grey, low saturation, very low contrast, light enough for dark text to read over it.
Materials: fine paper fibres, subtle dry-brush granulation, faint watercolor pigment variations, delicate handcrafted pencil-paper surface feel.
Lighting: flat even illumination with no shadows or dimensional relief.
Constraints: absolutely no words, letters, symbols, labels, map features, architecture, houses, people, plants, objects, roads, cracks, decorative patterns, borders, watermarks or logos. This is blank tactile paper, not a landscape. Keep all texture fine and unobtrusive. Opaque image.
```

## 幸存者头像图集

- 项目路径：`client/assets/survivors-portraits-v1.png`
- 最终原始输出：`/Users/str/.codex/generated_images/01a15ddf-1ba6-7d93-860a-64e0ae01b1cb/exec-2e96987c-75cf-441c-8bcc-2325d00898fe.png`
- 尺寸：1774 × 887 像素，严格 2:1；PNG 具有 alpha 透明通道。
- 网格：4 列 × 2 行，8 个头像顺序正确；每个等分单元为 443.5 × 443.5 像素，CSS 可按 400% × 200% 背景尺寸和等分位置显示。
- 已通过 `view_image` 目视检查：八位成人水彩铅笔胸像，人物各自位于等分网格内，各行列留有透明间隔；无标签、边框、武器、血腥或科幻装甲。头像为手绘柔边，边缘保留少量水彩颗粒，不适合按不透明硬轮廓使用。
- 最终顺序：第一行主角、林禾、老周、陈岚；第二行许宁、阿远、孟姐、匿名访客。

完整初始生成提示词：

```text
Use case: stylized-concept
Asset type: a production character-portrait sprite atlas for a mobile survival management game.
Primary request: Exactly EIGHT adult East Asian survivor bust portraits arranged in a mathematically uniform FOUR COLUMNS by TWO ROWS atlas on an actually transparent background. Overall canvas aspect ratio exactly 2:1, ideally 2048 x 1024 pixels. Each of the eight invisible cells is square, equal size, with an individual centered head-and-upper-torso portrait entirely inside it and at least 10 percent empty transparent safety margin on all sides. There must be no drawn cell borders, no backdrop panels, no labels and no lettering. Maintain identical portrait scale, eye-level viewpoint and chest-up framing in all eight cells. The transparent empty gutters must align at one-quarter, one-half, three-quarters of width and one-half of height for exact CSS grid extraction.
Style/medium: hand-painted watercolor washes with delicate pencil outlines, restrained warm post-apocalyptic character concept art. Believable realistic adult human proportions, not cartoonish or chibi. Weathered practical clothes, muted moss greens, cream, ochre and warm brown. Faces are thoughtful and warm, gently tired but dignified. Soft even lighting. No scene background, no paper behind the portraits; transparent alpha between and around all figures.
Subject order, left to right:
Top row cell 1: protagonist, an androgynous young adult East Asian repair worker with short dark hair and a faded green jacket, small plain repair-tool detail, neutral friendly expression.
Top row cell 2: Lin He, a young adult East Asian woman gardener, dark hair loosely tied back, warm yellow-green scarf, a small seed pouch held near chest.
Top row cell 3: Lao Zhou, a late-middle-aged East Asian male repair craftsman, short grey hair, gentle lined face, old grey-brown tool apron.
Top row cell 4: Chen Lan, adult East Asian female night security guard, short straight dark hair, deep green work uniform.
Bottom row cell 1: Xu Ning, adult East Asian female nurse, simple beige practical medical coat, dark hair neatly pulled back.
Bottom row cell 2: A Yuan, young adult East Asian male courier, tousled dark hair, old messenger-bag strap across chest, muted olive-brown jacket.
Bottom row cell 3: Sister Meng, middle-aged East Asian woman cook, tied-back dark hair, warm brown worn apron, steady warm expression.
Bottom row cell 4: anonymous androgynous adult visitor, a practical cloth face covering over nose and mouth and simple grey hood; eyes visible, reserved expression.
Constraints: exactly eight individual figures, no overlaps, no portraits crossing their invisible cell boundary, no extra heads, no objects outside their cells. Strict 4x2 grid. Actual transparent background, not a checkerboard drawing. No text, numbers, logos, watermark, drawn frames, weapons, gore, blood, futuristic armor, shiny science fiction, photorealistic photographs, anime or chibi.
```

第一次布局编辑提示词（参考初始生成图）：

```text
Edit this portrait atlas only to improve the technical layout. Preserve exactly the same eight illustrated adult survivors, same identities, clothes, order, warm pencil-and-watercolor art, and actual transparency. The canvas must have aspect ratio exactly 2:1, ideally 2048 by 1024 pixels. Keep an EXACT uniform 4 columns by 2 rows layout, each invisible cell square and equal. Within EACH cell, scale the individual portrait down to occupy at most 78 percent of cell width and 78 percent of cell height. Place each portrait at the exact center of its own cell, leaving at least 11 percent empty fully transparent space on all four sides of each cell. Every portrait must be completely contained within its cell, with a clearly visible full transparent gutter between rows and columns, and transparent margins around the outside of the canvas. Do not draw any gridlines, cell borders or backgrounds. Do not add text or objects. Do not change pose, faces, clothing, ordering or art style. Keep a soft clean chest-up portrait cutoff entirely inside each cell. Do not let shoulders touch any other portrait or any cell edge. Preserve transparent alpha, not a checkerboard drawing.
```

最终布局编辑提示词（参考第一次布局编辑图）：

```text
Edit ONLY the spacing and sizes of the eight portraits in this transparent atlas. Keep their identities, exact left-to-right order, their clothes and the watercolor-pencil art intact. The atlas is exactly 2:1 and must be a precisely even four-column, two-row grid of square cells. Make every portrait MUCH SMALLER: each head-and-chest figure should occupy only 60 percent of its cell width and 60 percent of its cell height, leaving huge fully transparent margins of about 20 percent of the cell size on every side. Place each portrait at the exact CENTER of its cell, not along the bottom. In normalized canvas coordinates the eight portrait centers are (12.5%,25%), (37.5%,25%), (62.5%,25%), (87.5%,25%), (12.5%,75%), (37.5%,75%), (62.5%,75%), (87.5%,75%). Make a WIDE continuous transparent horizontal band across the entire middle of the canvas, plus WIDE transparent vertical gutters between every column, and a wide transparent margin along all outside edges. No portrait can cross the vertical 25%,50%,75% grid boundaries or the horizontal50% boundary. The portraits must be fully separated and floating as small individual character icons in their equal square cells. Do not draw guide lines, grid frames, paper texture, backdrops or text. Actual alpha transparency everywhere apart from the characters.
```

最终选用第三张头像图，前两张仅为默认生成目录中的迭代稿，未复制为项目资源。


## 网页传输版（2026-10-22）

原始PNG与生成提示词继续保留，运行时改用同名WebP。除装饰纸纹缩至680×680外，图集和背景尺寸不变，透明通道逐像素验证一致；颜色采用quality=90编码。网页版本总量18.12MB→3.45MB；详情、复现脚本和慢网测量见 [ASSET_OPTIMIZATION.md](ASSET_OPTIMIZATION.md)。
