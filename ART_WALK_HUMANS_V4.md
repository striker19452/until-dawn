# V4 人物步行素材

生成方式：内置 `image_gen.imagegen`，参考已存在的 `client/assets/survivors-fullbody-v3.png` 的身份与手绘风格。旧素材未改动；没有使用 CLI、API key、Python 图像编辑或插值放大。

## 最终文件

| 文件 | 实测原生像素 | 布局 | 理论单格 |
| --- | --- | --- | --- |
| `client/assets/survivors-walk-a-v4.png` | 1254 × 1254 | 4 列 × 4 行 | 313.5 × 313.5 |
| `client/assets/survivors-walk-b-v4.png` | 1254 × 1254 | 4 列 × 4 行 | 313.5 × 313.5 |

曾明确请求 2048 × 2048 原生输出，但工具实际输出上表尺寸。没有把1254插值放大后标成2048。人物本体约250–300像素高，适合当前手机场景中几十像素高的角色；不能据此宣称新增了2048图集级细节。

图集A原始路径：
`/Users/str/.codex/generated_images/01a15edd-4a2d-7e43-b874-5f782fdad887/exec-28ae8729-31ad-436d-9d91-ae1b06e4eb9c.png`

图集B原始路径：
`/Users/str/.codex/generated_images/01a15edd-4a2d-7e43-b874-5f782fdad887/exec-df317f14-0d4a-4a2a-9dcc-bdb09668fb09.png`

## 帧索引与身份

各图按从左到右、从上到下编号0–15：

| 图 | 人物 | 行 | 步行帧 | 建议静止帧 |
| --- | --- | --- | --- | --- |
| A | hero 主角 | 0 | 0,1,2,3 | 1 |
| A | lin 林禾 | 1 | 4,5,6,7 | 5 |
| A | zhou 老周 | 2 | 8,9,10,11 | 9 |
| A | chen 陈岚 | 3 | 12,13,14,15 | 13 |
| B | xu 许宁 | 0 | 0,1,2,3 | 1 |
| B | yuan 阿远 | 1 | 4,5,6,7 | 5 |
| B | meng 孟姐 | 2 | 8,9,10,11 | 9 |
| B | visitor 匿名来访者 | 3 | 12,13,14,15 | 13 |

人物都朝三分之四右侧。第2列双脚收拢、身体直立，可兼作停步；移动用四帧顺序重复，在相邻位置连续平移。渲染端可用镜像表达向左。

2026-10-22：孟姐现使用独立的 `meng-walk-v5` 2×2图集修复桶换手、消失的问题；上表B图的孟姐行保留作原稿。新帧、注册与提示词见[孟姐提桶修正](ART_MENG_WALK_V5.md)。

## 目视验证与限制

已对参考图、A图、B图以及A定向修正结果使用 `view_image` 检查。

- 八个身份、服装与手绘水粉风格可辨认，整身头发至鞋靴可见。迈步格与收脚格存在明显腿部、手臂姿态差异，未使用同一静态帧假装四帧。
- **四相位步态不完全准确**：生成器在部分人物的第1与第3列重复了同一侧腿前伸，而没有严格实现左右腿交替；部分第4列更接近迈步姿势。当前应描述为简化迈步动画，不能声称精确的标准四相位步态。
- 部分第一行脚尖接近等分格边，留白没有严格达到提示词的10%。裁帧应按每行实际alpha包围盒检查边界，不能直接假定整张图每格都有充分10%安全区；渲染还需按每帧足部包围盒统一锚点，避免脚滑或抖动。
- A图进行了反腿和留白的定向修正，但模型仍重复前腿，而且第一行底部偏出等分行界；该修正版没有选入项目文件。原始修正版保留在：
  `/Users/str/.codex/generated_images/01a15edd-4a2d-7e43-b874-5f782fdad887/exec-3d8b099c-e639-43ec-89ba-26a13f3e9870.png`。
- 当前交付提供了可读的姿态变化，但仍需主线程在真实游戏帧率、缩放与连续移动中目视验证循环效果。

### 运行时裁帧与锚点

主线程读取原PNG的alpha，按真实低alpha行缝划分裁帧：A行界为0/315/627/939/1254，B为0/318/631/940/1254。每帧头部中心和鞋底注册点记录于 `client/assets/survivors-walk-v4.json`，图内像素保持原样；所有帧采用同一缩放倍率，避免逐帧拉伸。向左镜像时同步镜像水平注册点。生成脚本 `scripts/register-human-walk.py` 仅读图并写JSON，不编辑PNG。

## 透明性验证

使用 Node 原生 `zlib` 解码PNG RGBA，仅读取原图，无像素修改：

- A图1,572,516像素中1,035,015像素alpha为0；四角均为 `[0,0,0,0]`；格间点 `(313,156)`、`(627,156)`、`(940,156)` 均为 `[0,0,0,0]`。
- B图1,572,516像素中990,608像素alpha为0；四角均为 `[0,0,0,0]`；格间点 `(313,156)=[0,0,0,1]`、`(627,156)=[0,0,0,0]`、`(940,156)=[0,0,0,0]`。边缘存在水彩半透明像素，需按原始alpha合成。
- 均为实际透明背景，不是绘制棋盘格或不透明底板。

## 生成失败记录

A图前两次长提示请求都由内置工具返回：
`image generation failed: network error: error sending request`。
无图像产出。随后简短同工具请求成功；没有切换CLI。失败不是构图验收结论。

## A图成功提示词

```text
Use case: stylized-concept. Create a native high-resolution 2048x2048 transparent PNG sprite atlas, strict 4 columns x 4 rows, 16 full-body human frames. The attached image is a reference only for identity and painted style. Use its top 4 people: row 1 olive-jacket protagonist, row 2 yellow-scarf female gardener Lin, row 3 elderly capped male craftsman Zhou, row 4 short-haired female guard Chen. Keep their faces and outfits consistent.

Each row is ONE person's 4-frame walking cycle, all facing three-quarter right: column1 left foot forward/right foot back, column2 upright passing pose with feet close (natural enough to serve as idle), column3 right foot forward/left foot back, column4 opposite passing pose. Arms swing against legs. Clearly different leg positions between frames. Do not make static copies. Identical body scale, head height and foot baseline across all cells. Feet baseline at 88% cell height. Even square grid; each whole body fits inside central80% of cell. No overlap.

Beautiful premium boardgame hand-painted gouache and sepia ink, warm subdued earthy fabrics, richly detailed natural anatomy and clear silhouettes. True transparent alpha backdrop, isolated cutouts, no scenery, no floor panels, no text, no watermark, no labels, no drawn grid. All 16 frames complete from hair to boots.
```

## B图成功提示词

```text
Use case: stylized-concept. Create a native high-resolution 2048x2048 transparent PNG sprite atlas, strict 4 columns x 4 rows, 16 full-body human frames. The attached image is a reference only for identity and painted style. Use its BOTTOM 4 people: row 1 light-jacket female nurse Xu, row 2 rust-orange-jacket male courier Yuan, row 3 middle-aged female cook Meng with cream apron, row 4 gray-green hooded masked anonymous visitor. Preserve each identity, face, clothes, bags, hairstyle.

Each row is ONE person's 4-frame walking cycle, all facing three-quarter right: column1 LEFT FOOT forward and RIGHT FOOT back, column2 upright passing pose with feet close (natural enough to serve as idle), column3 RIGHT FOOT forward and LEFT FOOT back, column4 opposite passing pose. Column1 and3 MUST show opposite feet forward: alternate the near leg and far leg clearly, not the same foot twice. Arms swing against legs. Clearly different knee and boot positions between frames. Identical body scale, head height and foot baseline across all cells. Feet baseline at 86% cell height, head at16% cellheight. Each figure ONLY70% of its cell height, with clear 14–16% transparent padding at top and bottom. Even square grid; each whole body fits within its own cell. No overlap.

Beautiful premium boardgame hand-painted gouache and sepia ink, warm subdued earthy fabrics, finely detailed natural anatomy and clear silhouettes. True transparent alpha backdrop, isolated cutouts, no scenery, no floor panels, no text, no watermark, no labels, no drawn grid. Exactly16 complete figures from hair to boots.
```

## A图未选用定向修正提示词

```text
Edit target: this 4x4 survivor walking animation sheet.
Use case: precise-object-edit.
Keep the exact same four identities, faces, clothes, painting detail, row order, and 4x4 equal square grid. Keep true transparent alpha.
Fix the gait: EVERY ROW, COLUMN 3 must be the opposite leg contact from column1. Column1 currently has the nearer leg stretching forward/right. In column3, put the NEAR leg BACK and LEFT, knee nearly straight, and put the FAR leg FORWARD and RIGHT, with its front boot visibly overlapping behind the near leg. Swing the near arm forward and far arm back. It must visibly differ from column1; do NOT repeat the same leg arrangement.
COLUMN4 in every row is opposite passing: near knee raised just forward, far foot under body; arms opposite column2. Keep column2 nearly upright and feet together for idle.
Also provide safe transparent padding: uniformly reduce every whole person and accessories to 80% of current height within its OWN cell. Center it horizontally, align the feet at 88% height of its own cell. Heads at about18%. Do not change scale between frames. All boots and tools inside cells, no boundary touching.
All sixteen bodies face three-quarter right. No text, no background, no border, no extra people. Highest native detail, original square canvas.
```

## A图失败长提示词（第二次，已加入自然停步格要求）

```text
Use case: stylized-concept.
Asset type: HIGH DETAIL production walk-cycle sprite sheet, transparent PNG, 4 columns by 4 rows, square canvas. Please generate at native 2048 x 2048 resolution or the highest native square detail available, never an interpolated upscale.
Input image role: identity and hand-painted style REFERENCE ONLY. Use the first FOUR survivors in its top row as the identities, and create NEW WALKING POSES. Do not copy the original static pose.
Primary request: 16 FULL BODY animation frames, strict 4x4 equal square cells, completely transparent background. EACH ROW is ONE survivor animated through a seamless four-frame walk cycle, left to right. All face THREE-QUARTER RIGHT. Keep the same identity, outfit, body size, head height and foot anchor across that row. Each figure occupies only the central 75–80% of cell height with 10% clear transparent margin, absolutely no overlap into neighboring cells. The walking is in-place with no horizontal travel within a cell.
Columns for EVERY ROW:
1 CONTACT A: left leg extended forward/right, right leg trailing back/left, right arm forward and left arm back.
2 PASS A: left foot under hips supporting weight, right foot passes close beside it with only a tiny heel lift, knees nearly straight and arms relaxed near the torso; a natural upright passing pose that can also serve as a still idle frame. Visible difference from column1.
3 CONTACT B: right leg extended forward/right, left leg trailing back/left, left arm forward and right arm back. Opposite to column1.
4 PASS B: right foot under hips supporting weight, left knee raised passing forward, arms near opposite mid-swing. Visible difference from column2.
The feet must alternate distinctly between poses, not four static copies. The boot soles must share the same nominal baseline at 88% height within every cell. Torso remains steady, head top and foot baseline stay aligned across all four frames. Column 2 should feel natural enough for an idle stop.
ROW 1: protagonist, young androgynous East Asian adult with tousled short dark hair, olive-green worn work jacket, tan pants, brown boots, small tool belt and canvas satchel.
ROW 2: Lin, young East Asian female gardener with dark braided hair, ochre yellow scarf, faded sage overalls, seed pouch, a small hand trowel secured at belt so both arms can swing naturally.
ROW 3: Zhou, older East Asian male craftsman with gray stubble and kind lined face, weathered cap, brown leather work apron, rolled ivory sleeves, dark pants, small wrench secured at waist.
ROW 4: Chen, alert East Asian female guard with short dark hair, dusty dark olive field jacket and vest, charcoal practical pants and brown boots, short wooden baton secured to belt.
Style/medium: premium illustrated boardgame gouache and watercolor with delicate sepia ink contours, exquisite textured fabrics, natural anatomy with clear readable silhouettes. Rich warm subdued earth colors, soft upper-left light. Hand-painted and polished, no pixel art, no 3D render.
Constraints: exactly 16 separate full-body frames, 4 rows x 4 columns, uniform square cells, all completely inside cells, consistent identity per row and consistent right-facing direction across all frames. TRUE alpha transparency around every silhouette. No background scenery, no ground panel, no shadow floor plane, no checkerboard drawn into image. No text, no gridline, no border, no labels, no watermark.
```

