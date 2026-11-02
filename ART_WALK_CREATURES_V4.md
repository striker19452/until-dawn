# 生物四帧步行动作 V4

使用内置 `image_gen.imagegen`，没有调用 CLI/API 回退。所有 PNG 均为生成器原始产物的原样复制，未用程序裁剪、重画或缩放。仅用只读 PNG alpha 解码检查透明度、边界及逐帧差异。

## 最终文件与布局

| 项目文件 | 实际尺寸 | 布局 | 单格 | 行顺序 |
|---|---|---|---|---|
| `client/assets/creatures-walk-a-v4.png` | 1448 × 1086 | 4 列 × 3 行 | 362 × 362 | walker 灰狼、climber 长爪蜥蜴、rammer 甲背野猪 |
| `client/assets/creatures-walk-b-v4.png` | 1448 × 1086 | 4 列 × 3 行 | 362 × 362 | caller 长颈冠兽、burrower 鼹兽、quencher 囊袋两栖兽 |

完整绝对路径位于 `/Users/str/MyProjects/末日生存/` 下。每行 4 列是接触、经过、另一接触、另一经过。按行优先编号 0–11，每种生物帧号为 row×4 + [0,1,2,3]。提示词请求 2048 × 1536，但内置工具实际返回 1448 × 1086；此处如实保留原始尺寸，没有插值放大。

## 接入时必须使用的注册点

`client/assets/creatures-walk-v4.json` 含每帧 `bounds`（alpha >= 64 的局部像素边界，右/下值包含在内）和 `origin`。同一行图案有少量位置/脚底波动，尤其 A 图的四列水平中心有系统偏移，不能仅使用统一 0.5 / 1 原点。请按逐帧 origin 设置 sprite 原点，把轮廓中心与脚底对齐；每种生物使用同一个固定显示比例，不要每帧按可见边界改变缩放。

原点公式：`originX = (left + right + 1) / 2 / 362`；`originY = (bottom + 1) / 362`。这只是在显示时注册坐标，不修改或裁剪生成素材。以 origin 注册后再进行游戏位置平移，可避免格内内容偏移造成明显跳动。

## 验证与局限

- 已通过 `view_image` 逐版目视检查。六种生物的灰刺背毛、苔绿长爪、重甲獠牙、紫色长颈冠、褐色鼹兽巨爪、蓝色囊袋两栖身份均保留。
- 最终两张图所有生物均朝右，完整轮廓没有穿出各自 362 px 格。最小透明边距不一致，caller 脚底距格底约 13 px，仍未裁切；并非每边都达到提示词所要求的 20% 留白。
- A 图 79.6%、B 图 78.5% 像素 alpha 完全为 0；`sips` 同时确认两图均具有 alpha。
- 四帧不是复制同一姿态：灰狼前爪在伸展落地与弯肘抬起之间变化；蜥蜴长爪从前伸到弯腕经过；野猪蹄从前伸到收起；长颈兽长足从触地到膝下抬起；鼹兽巨爪从前推到内卷；两栖兽蹼足从前摊到胸下收回。第 1 与第 3 帧、第 2 与第 4 帧相近，但可见另一侧肢体与后足变化。
- 只读 alpha 检查中，逐帧下部轮廓相邻差异均非零（A 约 38.7–96.3%，B 约 23.9–84.8%）；该数值包含格内位移，不独立证明步态正确，目视的足部变化是主要验收依据。
- 这是四帧低帧数手绘循环，可在约 6–8 fps 下使用；并非骨骼动画，接触帧间存在少量轮廓与体态变化，需显示注册点配合。此任务未修改 JS/CSS，也未在引擎内验证循环。

## 原始生成输出

身份参考：`/Users/str/MyProjects/末日生存/client/assets/creatures-v3.png`。

全部原始文件均保留于 `/Users/str/.codex/generated_images/01a15edd-7c48-71a2-ab0f-9ec0af8011d7/`：

| 阶段 | 文件 |
|---|---|
| A 首版，朝向不一、贴边，未选用 | `exec-5de27960-0c90-43ee-a2b7-eabb6d8cde21.png` |
| A 修正朝向，仍贴边，未选用 | `exec-25aafc4d-2cb1-48a9-8d9e-265a876879c9.png` |
| A 最终选用 | `exec-2a14f5e4-0549-4e3a-94b8-5e264e6f8752.png` |
| B 首次生成 | 网络错误，无产物 |
| B 简化请求成功，贴边，未选用 | `exec-bf7e430b-6a32-43c6-b879-c2575b7cea49.png` |
| B 最终选用 | `exec-2c04f6b3-bf99-46dc-b9cc-c4211a4d19ed.png` |

## 完整提示词

所有调用均设置 `transparent_background: true`。A 首次仅引用身份参考图；A 后续各自引用前一版。B 首次引用身份参考与 A 最终版，网络错误；B 简化请求仅引用身份参考，最终边距修正引用 B 成功首版。

### A 首版

```text
Use case: identity-preserve / stylized-concept game sprite production.
Create one professional ANIMATED WALK CYCLE SPRITE ATLAS, NOT a concept-art lineup. Reference image 1 is creature identity and illustration-style reference ONLY. Preserve the three specified creature identities, anatomy, colors and fine painted texture from its TOP ROW. The reference background must NOT be copied.
OUTPUT: request native 2048 × 1536 pixels, aspect ratio exactly 4:3, strict 4 columns × 3 rows, 12 equal square cells. Genuine transparent alpha PNG, no background gradients, no shadows or glow. No text, no gridlines, no labels, no borders, no watermarks.
ROW 1 all FOUR cells: the SAME gray mutated wolf (walker) from reference top-left: ragged gray fur, amber eyes, protruding stone/bone spikes along back and shoulders, four long animal legs with claws.
ROW 2 all FOUR cells: the SAME moss-green long-clawed reptilian climber from reference top-middle: narrow lizard face, gold eye, small foliage-like dorsal spikes, long curling tail, powerful hind legs and long grasping foreclaws.
ROW 3 all FOUR cells: the SAME squat armored wild boar (rammer) from reference top-right: low bulky dark brown body, great overlapping pale rocky armor plates, thick tusks, four stout legs with cloven hoof-claws.
Animation specification, CRITICAL:
Each row is a seamless FOUR-FRAME WALK CYCLE of ONE identical animal walking in place toward the RIGHT, with the same 3/4 slightly overhead view and same body center, body size, head direction and ground contact baseline in all 4 cells. These are four DIFFERENT LEG POSES, not copied artwork with tiny variations. Clearly draw individually readable feet.
COLUMN 1 = CONTACT A: near front foot reaches far forward, near rear foot extends back, opposite far-side diagonal feet in complementary positions. Clearly wide front/back foot separation.
COLUMN 2 = PASSING A: near front leg bends and its foot lifts under the chest moving backward, near rear leg swings inward under belly; one clear far-side planted supporting leg. Feet visibly gather beneath torso.
COLUMN 3 = CONTACT B: REVERSE COLUMN 1 LEG POSITIONS; near front foot stretches back, near rear foot reaches forward, far-side legs visibly reach opposite way. The raised/forward feet must be the opposite pair to column 1.
COLUMN 4 = PASSING B: OPPOSITE PAIR to column 2 lifts and bends under torso; supporting limbs differ visibly; complete loop back to column 1.
Keep silhouettes and facial identity consistent while making the lower leg/foot positions dramatically readable and distinct between all four frames. Minimal body bob only; no sliding object across the cell. Tail may shift gently, but cannot substitute for actual limb animation.
Composition constraints: center every creature horizontally within its cell, consistent foot baseline at 82% cell height; at least 10% clear transparent margin around every full silhouette; never clip horns, tail, claws, fur or armor. Body occupies approximately 70% of cell width at most. No floor, no scenery, no humans, no other creatures. Match the premium finely inked watercolor/gouache wasteland style of reference, rich material details and soft warm neutral illumination.
```

### A 朝向与边距修正

```text
Edit this transparent 4-column by 3-row animation atlas. Preserve all three creature identities and fine hand-painted style. Correct TWO production defects: orientation and clipping.
ORIENTATION IS MANDATORY: ALL TWELVE creatures face RIGHT. In EVERY square cell the creature's NOSE is on the RIGHT HALF and its TAIL is on the LEFT HALF. DO NOT leave any creature facing left. Row 1 the gray spiked wolf in all four frames faces right. Row 2 the green clawed lizard in all four frames faces right. Row 3 the armored tusked boar in all four frames faces right. Same camera angle in every frame.
SPACING IS MANDATORY: shrink each complete animal to occupy at most 70% of its cell width and 70% height, centered in its own equal square cell. Keep at least 12% clear empty transparent space on EVERY side. No tails, feet, horns, claws, fur or soft outlines may cross cell boundaries. Preserve whole silhouettes.
Within each row maintain the SAME body size, head location and grounded foot baseline in all FOUR cells. Animate only the actual legs with a four-step in-place WALK CYCLE: frame 1 extended contact with near front foot far forward and near hind foot back; frame 2 bent lifted passing foot under chest and gathered hind foot; frame 3 reverse contact with near front foot clearly back and near hind foot far forward, far legs opposite; frame 4 opposite lifted passing feet. These four limb poses must be obviously different. Do not change body direction, species, head design or scale to fake a frame.
Output genuine transparent alpha PNG, exactly 4 columns × 3 rows of equal square cells, aspect ratio 4:3, requested native 2048 × 1536. No background, no gridlines, no letters, no arrows, no numbers, no floor shadows.
```

### A 仅缩小边距修正（选用版）

```text
Edit ONLY the scale and blank spacing of this transparent sprite atlas. Preserve all 12 poses, all right-facing orientations, three species, textures and exact 4-column by 3-row arrangement.
EVERY animal is currently far too large and touches its cell borders. Make each complete animal EXACTLY HALF its current visual width and HALF its current height, leaving it centered in its original square cell. This is a contact sheet with LARGE empty transparent gaps between sprites. The body artwork should occupy only about 45% to 50% of each square's width, with the remaining half EMPTY transparent space. Every animal including tail, nose, claws and every ink outline must be completely contained in the central half of its cell. The leftmost and rightmost canvas edges must be empty transparent for a wide margin.
Do not enlarge the creatures again. Maintain each of the original four distinct foot poses per row. Maintain native aspect ratio 4:3 and uniform 4 columns x 3 rows of square cells. True alpha transparency, no new background or ground, no labels or lines.
```

### B 首次请求（网络错误，无输出）

```text
Use case: stylized-concept game animation sprite production.
Reference image 1 is creature identity and painted-style reference ONLY: use its three creatures from the BOTTOM ROW. Reference image 2 is the required 4-column by 3-row walk-cycle atlas layout, generous spacing and RIGHT-facing direction reference. Create the companion atlas for the other three species.
OUTPUT requested native 2048 × 1536 pixels, exact aspect ratio 4:3. Strict 4 COLUMNS × 3 ROWS of equal square cells, 12 sprites total. True transparent alpha PNG. No background, gradients, painted checkerboard, ground shadows, text, labels, gridlines, arrows or UI.
ROW 1: FOUR animation frames of the SAME caller creature from reference 1 bottom-left: tall thin purple-gray quadrupedal long-necked mutant, beaklike narrow head, amber eye, orange throat membrane and narrow crown/frill, slender clawed legs, short ragged tail. Preserve this unmistakable long-neck identity.
ROW 2: FOUR animation frames of the SAME burrower creature from reference 1 bottom-middle: squat rounded shaggy brown mole beast, pale almost blind eyes, pink fleshy snout and whiskers, overlapping rocklike shoulder/back lumps, enormous ivory digging claws on forefeet and small hindfeet.
ROW 3: FOUR animation frames of the SAME quencher creature from reference 1 bottom-right: squat turquoise/olive amphibian, huge translucent pale blue throat water sac, gold bulging eyes, warty back with mossy lumps, four splayed webbed toe limbs.
CRITICAL orientation: EVERY creature faces RIGHT in all twelve cells, with its NOSE on the RIGHT side and TAIL/back on the LEFT. Same 3/4 slightly overhead camera throughout. No reversed or front-facing pose.
CRITICAL animation: each row is one coherent FOUR-FRAME WALK CYCLE, walking IN PLACE. Fixed body identity, body scale, head position, water-sac size and foot-ground baseline from frame to frame; only minimal natural body bob. Clearly DIFFERENT alternating limb poses:
COLUMN 1 contact A: near front foot far forward toward RIGHT; near hindfoot back toward LEFT; opposite far-side diagonal feet extend the complementary way.
COLUMN 2 passing A: near front knee/elbow deeply bends and lifted foot passes beneath chest; near hindfoot lifts beneath belly; obvious bent and airborne feet, far-side supporting planted foot.
COLUMN 3 contact B: near front foot now extends BACK toward LEFT and near hindfoot forward toward RIGHT; far front foot is visibly extended far forward. This must show the OPPOSITE diagonal foot pair from column 1, not duplicate it.
COLUMN 4 passing B: the OPPOSITE feet to column 2 lift and pass beneath body; support limbs change. A smooth loop back to column 1.
For the amphibian use a calm alternating walking crawl rather than a leap, body and large sac stable. For mole emphasize alternate giant claw reaching and lifting. For caller emphasize alternate long feet visibly crossing underneath torso.
Spacing and consistency: every sprite occupies ONLY the central 55% to 60% of its square width and height; large clear transparent safety margins around all full silhouettes. Within each row align torso center and foot baseline consistently; full tails, head frills, whiskers and toes never cross cell boundaries. Beautiful original finely inked watercolor and gouache with premium painted material detail, warm neutral lighting matching reference. Exactly 12 whole isolated creatures, no other objects.
```

### B 简化请求

```text
Create a polished hand-painted watercolor/gouache WALK ANIMATION sprite atlas on a genuinely transparent alpha background. Reference image is creature identity only; do not copy its background.
Exact layout 4 columns × 3 rows of equal square cells, aspect ratio 4:3, requested native 2048×1536. Twelve sprites. Every creature faces RIGHT: nose on RIGHT, tail on LEFT. Each complete sprite fits in central 60% of its cell with wide transparent margins.
Row 1: FOUR frames of reference bottom-left caller: thin purple long-necked mutant, beaked head, orange throat membrane and crest, slender clawed legs.
Row 2: FOUR frames of reference bottom-middle burrower: squat shaggy brown mole, pale eyes, pink snout and whiskers, rocky back, huge ivory digging foreclaws.
Row 3: FOUR frames of reference bottom-right quencher: turquoise/olive frog creature, large translucent pale-blue throat sac, golden eyes, warty mossy back, four webbed limbs.
Each row repeats ONE consistent animal in a four-phase WALK IN PLACE: column1 near front foot reaches far forward and hind foot back; column2 that forefoot lifts and passes beneath chest, limbs gather; column3 OPPOSITE diagonal feet reach, near forefoot now back and far forefoot forward; column4 opposite feet lift and pass. All four poses must have visibly different foot positions. Keep body center, head position, size, foot-ground baseline, camera angle and identity fixed. Three-quarter slightly overhead view toward RIGHT. Calm walking not jumping. Full silhouettes inside cells, no clipping. Same finely inked detailed painted style as reference. No scene, floor, shadows, glow, text, labels, frames, UI or numbers.
```

### B 仅缩小边距修正（选用版）

```text
Edit ONLY scale and blank spacing of this transparent sprite atlas. Preserve all 12 poses, all right-facing orientations, three species, textures and exact 4-column by 3-row arrangement.
EVERY creature is currently too large and touches its square cell borders. Make each complete creature EXACTLY HALF its current visual width and HALF its current height, centered within its original equal square cell. This is a contact sheet with LARGE empty transparent gaps. Artwork must occupy only 45% to 50% of each cell width, leaving the remaining half EMPTY transparent. Every tail, beak, claw, toe, throat sac and ink outline must be fully inside the central half of its cell. The outer canvas edges must also have wide empty transparent margins. DO NOT enlarge creatures.
Maintain all four distinct actual foot poses per row: stretched supporting feet, bent passing feet, opposite-diagonal stretched feet, opposite-diagonal passing feet. Preserve caller/mole/amphibian identities and right-facing camera; same body size and ground foot baseline within each row. Aspect ratio 4:3, uniform 4 columns × 3 rows of square cells, genuine transparent alpha. No background, no text, no lines, no scenery or extra objects.
```

