# 建筑素材 V3

生成方式：内置 `image_gen.imagegen`，透明背景；全新生成后进行一次定向缩小留白修正。未使用 CLI/API 回退；未进行图像裁剪、重绘或后处理。

- 项目文件：`/Users/str/MyProjects/末日生存/client/assets/buildings-v3.png`
- 选中原图：`/Users/str/.codex/generated_images/01a15edd-7c48-71a2-ab0f-9ec0af8011d7/exec-40667485-c6f8-4175-8258-feb6ce40e6c4.png`
- 首版原图：`/Users/str/.codex/generated_images/01a15edd-7c48-71a2-ab0f-9ec0af8011d7/exec-b4a18c46-ab2c-4afd-a0b2-9652c8046c50.png`
- 实际尺寸：1774 × 887 px；RGBA，真实透明背景；宽高比 2:1。
- 图集：4 列 × 2 行。每格逻辑尺寸 443.5 × 443.5 px。使用完整图集作为 CSS 4×2 背景定位时无需取整；引擎切格时请保留分数坐标或使用归一化 UV。

## 行优先顺序

| 索引 | 行列 | 素材 |
|---|---|---|
| 0 | 1/1 | 抬高菜床、绿叶和番茄 |
| 1 | 1/2 | 集雨桶与简易过滤器 |
| 2 | 1/3 | 有顶维修工作台／工具棚 |
| 3 | 1/4 | 旧便携发电机与油桶 |
| 4 | 2/1 | 医疗布棚、简易床与急救包 |
| 5 | 2/2 | 木质瞭望台、梯子与灯 |
| 6 | 2/3 | 砖灶、锅和小火 |
| 7 | 2/4 | 社区告示板、邮箱与运送木箱 |

## 目视验收

已使用 `view_image` 检查两版。最终版八个物体均完整、分格清晰，没有穿格或裁切；与首版相比，各格物体明显缩小，留出较宽透明安全边距。风格为精细墨线、水彩／水粉，旧木、砖、金属、灯光和克制的植物色彩统一。文字仅为不可读笔触，无 UI、格框、数字或人物。通过 `sips` 核验 1774 × 887 与 alpha 通道。素材细节较丰富，60 px 下建议建筑显示宽度按可见物体约 60 px 计算，完整格子需显示约 95–100 px。

## 首版完整提示词

```text
Use case: stylized-concept.
Asset type: original premium illustrated game-building sprite atlas, genuine alpha transparent PNG. Landscape exactly 2:1 overall image aspect ratio, strict uniform 4 columns by 2 rows of square cells. Exactly eight isolated small yard installations, one per cell, centered, with full silhouette and at least 20 percent transparent safety margin on all four sides of every cell. Everything outside the isolated objects must be truly transparent, never white or checkerboard painted in.
Art direction: exceptionally polished rich hand-painted editorial watercolor and opaque gouache with fine ink drawing, believable material detail, warm ochre, aged honey wood, weathered brick, slate metal, restrained muted green vegetation. Premium cozy-wasteland strategy-game illustration: survival equipment lovingly repurposed into a warm lived-in refuge. All objects viewed from the same 3/4 top-down camera, clearly readable at 60px. Beautiful soft lighting, subtle tight object contact shading only, no broad ground shadow.
Exact row-major grid order:
Row 1 column 1: two compact raised vegetable beds with lush greens and a few red tomatoes.
Row 1 column 2: an improvised rainwater barrel with a small practical layered filter apparatus and tiny pipe.
Row 1 column 3: a compact covered repair workbench/tool shed, rusty corrugated awning, visibly organized hand tools.
Row 1 column 4: a small worn old portable generator with copper cable and fuel can.
Row 2 column 1: a modest medical cloth awning over a cot and a plain first-aid bag, no logos or lettering.
Row 2 column 2: a simple wooden lookout platform with ladder and small lantern, compact footprint.
Row 2 column 3: a low brick cooking stove with cooking pot and a very small warm flame.
Row 2 column 4: a community wooden noticeboard, old mailbox and courier crate as one coherent installation; paper notes contain only indistinct brush marks, no legible writing.
Constraints: eight objects only, exactly 4 columns x 2 rows, equal square cells, full objects unclipped, transparent gutters. No enclosing cell frames, no UI, no labels, no numbers, no text, no watermark, no people, no scene background, no complete house, no mockup. The generous 20 percent transparent margins must prevent any object or shadow crossing cell boundaries.
```

## 唯一一次修正完整提示词

编辑目标为首版原图，透明背景设置为 true。

```text
Edit this building atlas. Keep its exact eight hand-painted building subjects, their detailed watercolor/gouache-and-fine-ink style, and the same row-major 4 columns by 2 rows order. Change only the scale and spacing: each installation must be substantially smaller within its own equal square cell, centered, fitting wholly within the CENTRAL 60 PERCENT WIDTH AND 60 PERCENT HEIGHT of that cell. Leave at least 20 percent completely transparent empty space on EVERY side of EACH cell, including the outer atlas border. For clarity: no part of any object, vegetation, contact shadow or ladder may enter this surrounding transparent safety margin. The atlas overall aspect ratio remains exactly 2:1. Exactly eight installations, no labels, frames, numbers, UI, additional objects or scene background. Preserve genuine alpha transparency; never paint a checkerboard or solid background. Preserve complete silhouettes and all small building details. This is a sprite atlas intended to be sliced into eight equal square cells by a game renderer.
```

## 共用动作／道具图集 V3

生成方式：内置 `image_gen.imagegen`，透明背景；首次生成后进行一次缩小留白修正，未作后处理。

- 项目文件：`/Users/str/MyProjects/末日生存/client/assets/props-v3.png`
- 选中原图：`/Users/str/.codex/generated_images/01a15edd-7c48-71a2-ab0f-9ec0af8011d7/exec-117c3502-6d04-43ae-96c5-8c537f677504.png`
- 首版原图：`/Users/str/.codex/generated_images/01a15edd-7c48-71a2-ab0f-9ec0af8011d7/exec-be7c4753-e38d-4c19-9b0f-59001b8021e1.png`
- 实际尺寸：1254 × 1254 px；alpha 透明，2 列 × 2 行，每格 627 × 627 px。
- 行优先顺序：0 小篝火与焦木；1 煤油风灯；2 木板与手锤；3 绳圈木桩陷阱。
- 目视检查：四个静态道具完整，无穿格／截断，没有石制火坑、人物、UI、可读文字或动画帧。留白比首版明显增加，目测约 16–30%，个别底边未严格达到提示词的 20%；仍有充分透明间隔供固定格切片使用。通过 `sips` 核验尺寸与 alpha 通道。

### 道具首版完整提示词

```text
Use case: stylized-concept.
Asset type: original premium illustrated survival-game props sprite atlas with a genuinely transparent alpha background.
Primary request: exactly four isolated props in a strict uniform 2 columns by 2 rows grid of equal square cells, overall canvas square. Each prop must be fully centered inside its own square cell and fit wholly within the CENTRAL 60 PERCENT WIDTH AND 60 PERCENT HEIGHT. Leave at least 20 percent completely transparent margin on all four sides of every cell including the outer atlas edge. No object, logs, flame, glow or shadow may cross that transparent safety margin.
Exact row-major order:
Top-left: a small lively amber-orange campfire with stylized soft flame tongues and just a few charred wooden logs, viewed from 3/4 overhead; no stone pit, no circular rock ring, no ground patch.
Top-right: a weathered hurricane lantern with warm amber glass and a small tightly contained warm glow, practical metal handle.
Bottom-left: a coherent small bundle of wooden repair planks with one hand hammer laid across them, aged honey wood and worn dark metal.
Bottom-right: a simple believable rope snare trap with a few pointed wooden stakes and looped cord, no animal.
Style: exceptionally polished hand-painted watercolor and opaque gouache, fine expressive ink outlines, readable premium strategy-game illustration. Warm cozy-wasteland aesthetic, ochre, aged honey wood, slate metal, rust and amber light. Rich material detail and charming but believable handcrafted equipment. Consistent 3/4 overhead camera, readable silhouettes at 40 to 60 pixels, static illustration only, same rendering style for all four props.
Constraints: square 2x2 sprite atlas, exactly four objects total, one per cell; complete unclipped silhouettes; true transparent alpha background. No UI, no labels, no writing, no numbers, no text, no frames, no watermark, no people, no scene, no painted checkerboard, no white background. No animation sequence or animation frames.
```

### 道具修正完整提示词

编辑目标为道具首版原图，透明背景设置为 true。

```text
Edit this transparent 2x2 prop atlas. Keep the exact four props and same fine ink, watercolor and gouache style, grid order, colors and material details. Change only scale and spacing. Every prop is currently too large. Reduce each complete prop to approximately 60% of its current size, centered at the center of its original equal square cell. Ensure each prop including all flames, wood, ropes and shadows fits within the central 60% width and height of its cell. This creates at least 20% transparent empty margin on ALL sides of ALL cells. The full image remains square, divided into 2 columns and 2 rows, exactly four props. Top-left campfire, top-right lantern, bottom-left repair planks and hammer, bottom-right snare trap. Preserve complete silhouettes and true transparent alpha, no ground, no white/checkerboard background, no labels, no frames, no additional objects.
```


