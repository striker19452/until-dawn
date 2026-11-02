# V3 人物与异变生物素材

生成方式：内置 `image_gen.imagegen`，请求真正透明背景；没有使用 CLI 或 API key，没有进行 Python 裁切、抠图或像素修改。文件直接复制保留最终生成结果。

## 最终文件与分帧

- `client/assets/survivors-fullbody-v3.png`：1774 × 887，严格 4 列 × 2 行。数学上的每格为 443.5 × 443.5；Phaser 可按整图比例定义帧，或使用 443 像素帧并按各列原图位置取整。人物全部完整位于各自单元格，姿势统一，透明间隔清楚。
- `client/assets/creatures-v3.png`：1536 × 1024，严格 3 列 × 2 行。每格 512 × 512。
- 只含静态整身姿势，适合在移动时淡出/淡入，并用统一轻微缩放与光晕反馈表达工作、攻击等行为。没有为每种动作生成不同姿势。

人物顺序，从左到右、从上到下：

| 帧 | 身份 |
| --- | --- |
| 0 | 主角，短黑发、橄榄绿工作外套、工具腰带 |
| 1 | 林禾，黄围巾、园艺服、种子袋 |
| 2 | 老周，灰胡须、帽子、工匠围裙 |
| 3 | 陈岚，短发女守卫、野外夹克、短木棍 |
| 4 | 许宁，浅色医护外套、急救包 |
| 5 | 阿远，锈橙色外套、邮差包 |
| 6 | 孟姐，中年女性、米色围裙、小锅 |
| 7 | 匿名来访者，兜帽、口罩、修补过的背包 |

生物顺序：

| 帧 | 类型 |
| --- | --- |
| 0 | walker：灰烬犬形徘徊者 |
| 1 | climber：长爪蜥蜴形攀爬者 |
| 2 | rammer：岩甲野猪形冲撞者 |
| 3 | caller：长颈喉冠呼唤者 |
| 4 | burrower：鼹鼠形掘地者 |
| 5 | quencher：青绿色鼓囊两栖熄火者 |

## 验证与使用说明

使用 `view_image` 检查主体、风格、身份与网格。人物以暖色水粉、细墨线呈现，完整身体与脚部可见；六种生物形态明显不同，没有血腥细节。生成器的构图留白并未逐像素严格达到提示词要求的 20%，但全部主体都完整留在各自格内；使用完整帧时不要再裁紧身体。

使用 Node 原生 `zlib` 解码 PNG 的 RGBA 像素，未修改图像：人物 1,573,538 像素中 1,251,811 像素 alpha 为 0；生物 1,572,864 像素中 950,848 像素 alpha 为 0。两张图左上角均 alpha 为 0。生物文件透明像素保留深棕色 RGB，因此部分图片查看器可能显示棕色底；按 alpha 合成到游戏场景时透明区不会遮挡院子。边缘含半透明水彩细节，需保留原始 alpha。

生物图透明性抽样（原图像素坐标；RGBA）：四角 `(0,0)=[1,1,1,0]`、`(1535,0)=[3,1,1,0]`、`(0,1023)=[10,7,3,0]`、`(1535,1023)=[30,21,6,0]`。格间中心 `(512,256)=[109,79,54,0]`、`(1024,256)=[100,68,39,0]`、`(256,512)=[96,61,46,0]`、`(768,512)=[80,53,25,0]`、`(1280,512)=[83,62,36,0]`。交叉点 `(512,512)`、`(1024,512)` 的 alpha 也为 0。全图 1,036,326 像素的 alpha 小于 8，半透明区域主要用于主体边缘。

## 来源文件

- 人物初稿：`/Users/str/.codex/generated_images/01a15edd-4a2d-7e43-b874-5f782fdad887/exec-2a6106a8-6581-4f97-a5b1-25a0cfd5eb76.png`
- 人物最终：`/Users/str/.codex/generated_images/01a15edd-4a2d-7e43-b874-5f782fdad887/exec-233b9d03-4049-4e1e-ba52-bad2c75c74a7.png`
- 生物初稿：`/Users/str/.codex/generated_images/01a15edd-4a2d-7e43-b874-5f782fdad887/exec-7ffa7516-2620-4401-86b9-2b4ee4703651.png`
- 生物最终：`/Users/str/.codex/generated_images/01a15edd-4a2d-7e43-b874-5f782fdad887/exec-96af2e29-183f-447b-b820-4191f7c2fcf5.png`

## 人物初始提示词

```text
Use case: stylized-concept
Asset type: production-ready transparent full-body character sprite atlas for a mobile survival management game.
Primary request: exactly EIGHT distinct East Asian survivors in a STRICT, evenly spaced 4-column by 2-row grid. Each cell is a square of identical size. The image aspect ratio is exactly 2:1. Each character is centered within its own cell, entirely contained, with at least 20 percent transparent margin around its silhouette. No character crosses a cell boundary. No gridlines.
Style/medium: exquisite hand-painted gouache and watercolor with delicate sepia ink contours, premium illustrated tabletop boardgame art, rich small material details and expressive faces, believable human proportions slightly simplified for readability, warm subdued earth tones, cozy resilience amid an overgrown wasteland.
Composition/framing: full body from head to boots, one static relaxed three-quarter standing pose, camera gently looking down so suitable for a three-quarter overhead courtyard. All characters stand on the same baseline within their cell, same relative scale; silhouettes clear when displayed at 50 pixels tall. No large weapons, no ground/background panels, no labels or numbers. Only a tiny very soft painted contact shadow beneath each pair of feet, otherwise true transparent alpha.
Grid order, left to right then top to bottom:
TOP LEFT: protagonist, androgynous young adult, short tousled dark hair, worn olive-green work jacket, tan pants, sturdy brown boots, small tool belt and canvas satchel, quietly resourceful.
TOP SECOND: Lin, young woman gardener, dark braided hair, ochre-yellow scarf, faded sage overalls, small seed pouch, holding a short hand trowel down at her side.
TOP THIRD: Zhou, older male craftsman with gray stubble and kind lined face, weathered cap, brown leather work apron, rolled sleeves, small wrench.
TOP RIGHT: Chen, alert female guard with short dark hair, dusty dark green field jacket, practical padded vest and sturdy boots, hand resting on a short wooden baton.
BOTTOM LEFT: Xu, calm female nurse with tied-back hair, light ivory field jacket, faded red small medical patch, compact canvas first-aid bag.
BOTTOM SECOND: Yuan, slim young male courier, messy dark hair, rust-orange windbreaker, messenger bag and wrapped forearms, energetic stance.
BOTTOM THIRD: Meng, warm middle-aged woman cook, hair in a bun and simple head scarf, brick-red sweater under beige kitchen apron, small pot hanging from belt, sturdy shoes.
BOTTOM RIGHT: anonymous survivor visitor, gray-green hooded poncho, cloth mask covering lower face, small patched backpack, ambiguous gender.
Lighting/mood: soft warm afternoon light from upper left with gentle cool shadows, tender human warmth.
Constraints: polished cohesive game illustration, all eight whole bodies visible, precisely eight subjects and strict 4x2 arrangement. TRUE transparent background. No scenery, no text, no border, no checkerboard painted into image, no watermark.
```

## 人物留白修正提示词

```text
Edit target: the eight-survivor sprite atlas just generated.
Use case: compositing.
Preserve EXACTLY all eight illustrated survivor designs, faces, colors, outfits, relative ordering, hand-painted detail, and true transparent alpha. Preserve the strict 4-column by 2-row grid and the 2:1 canvas aspect ratio.
Only change: scale each complete character AND its contact shadow uniformly down to 64 percent of its current height within its own existing grid cell. Center the shrunken complete figure horizontally and vertically inside the SAME cell. This gives approximately 18–20 percent clear transparent padding above and below every silhouette, and wider clear padding on left/right. Every full body and tiny contact shadow must be completely inside its cell. Do not enlarge heads or change pose.
Strict layout: 8 equally sized square cells, no visible gridlines. Top row hero, Lin gardener, Zhou craftsman, Chen guard. Bottom row Xu nurse, Yuan courier, Meng cook, hooded masked visitor.
TRUE TRANSPARENT BACKGROUND, no scenery, no text, no border, no labels, no painted checkerboard. Retain exquisite gouache and watercolor game-art quality.
```

## 生物初始提示词

```text
Use case: stylized-concept
Asset type: production-ready transparent creature sprite atlas for a mobile wasteland survival management game.
Primary request: exactly SIX fantastical mutated animals, arranged in a STRICT evenly spaced 3-column by 2-row grid. The overall canvas has aspect ratio exactly 3:2 and each grid cell is square. One creature centered within each cell, fully contained with at least 15–20 percent TRANSPARENT margin on every side, wide transparent gutters. Creature bodies occupy only the middle 60 percent of each cell. No gridlines.
Style/medium: exquisite hand-painted gouache and watercolor, fine dark sepia ink contours, premium illustrated boardgame art, tangible fur, hide, bark-like plates and mossy textures. Detailed but readable in miniature; the creatures feel eerie and unfamiliar, not cute and not graphic or gory. Same cohesive artistic style as warm earthy illustrated survival characters.
Composition/framing: small entire creatures including all claws, tails and crests, static three-quarter pose viewed gently from above, facing slightly left-down toward the viewer, consistent scale to fit each square cell. Only tiny soft painted contact shadow underneath; no scenery.
Grid order, left to right then top to bottom:
TOP LEFT: WALKER, hunched ash-gray canine-like scavenger, thin body, heavy forequarters, ragged smoky fur, short bony ridges, eerie amber eyes, creeping four-legged posture.
TOP MIDDLE: CLIMBER, lanky olive-brown lizard-like mutant, long forelimbs and curved gripping claws, thin arched back, tapering tail held close to its body, alert sideways stance.
TOP RIGHT: RAMMER, massive stocky dark umber boar-like beast, overlapping cracked stone-and-bark armor plates across shoulders, blunt tusks and broad forehead, lowered head ready to push.
BOTTOM LEFT: CALLER, thin dusky violet-brown long-necked quadruped, small narrow head and vertical folded throat crest, raised neck and opened beak-like mouth, eerie but elegant silhouette.
BOTTOM MIDDLE: BURROWER, compact low earth-brown mole-like creature, broad digging foreclaws, pale blind eyes, ridged leathery back and dusty fur, crouched close to ground.
BOTTOM RIGHT: QUENCHER, squat swollen muted teal amphibian, translucent pale blue throat sac, damp mottled skin and broad splayed feet, tiny luminous pale eyes, no splashes or water pool.
Lighting/mood: soft warm upper-left highlights, cool shaded edges, unsettling unknown woodland mutation.
Constraints: exactly six distinct subjects, strict 3x2 grid of equal square cells, whole bodies fully visible, no detached objects. TRUE TRANSPARENT alpha background. No text, no labels, no border, no watermark, no painted checkerboard. No blood, no gore, no wounds. Keep wide empty transparent gutters so every cell can be used directly as a separate sprite frame.
```

## 生物透明与留白修正提示词

```text
Edit target: the six-creature atlas supplied.
Use case: background-extraction.
Create TRUE transparent PNG alpha; remove EVERY brown/black/colored backdrop pixel between and around the creatures. There must be no colored panel, no gradient and no scene behind any creature. Transparency is essential: clean isolated cutouts only.
Preserve exactly all six detailed hand-painted creatures and their existing strict 3-column by 2-row ordering. Scale each complete creature down uniformly to 68 percent of its current size, and center within its own 512-by-512 cell. Canvas remains 1536-by-1024, with six equal square cells. Every entire claw, tail and crest must be fully inside its cell with clear transparent gutters. No cell borders.
Keep all creature designs, details, colors and postures unchanged; top row ash canine, lanky lizard, armored boar; bottom row long-necked caller, mole, teal swollen amphibian. No text, no label, no new object, no watermark. Deliver actual transparent alpha, not a checkerboard illustration.
```

