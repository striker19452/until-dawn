# 孟姐提桶行走修正（2026-10-22）

原B图孟姐的四帧中，第0、3帧桶在画面左侧，第1帧桶在右侧，第2帧没有桶，导致同向行走与停步时出现换手和消失。

采用内置 `image_gen.imagegen`，以原B图作为编辑目标和身份、风格参考，生成孟姐独立2×2四帧图集。每帧同一只近侧手提桶，右向时桶始终位于画面左侧，向左时整个人物及道具一起镜像。保留原B图，其余人物继续使用原图。腿部仍属于简化四帧动画，不宣称标准步态已重新标定。

- 原稿：`client/assets/meng-walk-v5.png`，实际原生1254×1254，RGBA透明背景。
- 网页：`client/assets/meng-walk-v5.webp`，299288字节，quality=90，透明通道逐像素一致。
- 注册：`client/assets/meng-walk-v5.json`，每格627×627，帧0/1/2/3，静止帧1。
- 重建：使用含Pillow的Python运行 `scripts/register-meng-walk.py`；仅读取原PNG注册头部与鞋底位置，并生成网页编码，不重绘或修改原PNG。
- 四帧统一倍率，按旧孟姐平均身体高度校准，`displaySize=73.382664`，场景身高约69像素。
- `client/scene.js` 只替换孟姐的纹理和行索引；独立图集在孟姐已入住时预载，或入住后加载，未入住的小院不下载该素材。

工具原始输出：`/Users/str/.codex/generated_images/01a163f3-f227-7a92-b84f-4ebd5944990b/exec-7f8d2bb5-d26d-4db8-8deb-ea66adbd96b2.png`。

## 最终生成提示词

```text
Use case: precise-object-edit. Repair Meng's inconsistent carried bucket in the supplied game sprite atlas. Input image is the EDIT TARGET and identity/style reference. Extract ONLY the middle-aged female cook in ROW THREE (red headscarf, red-brown blouse, cream apron, charcoal skirt, brown boots). Produce a dedicated transparent 2 × 2 sprite sheet of FOUR full-body walk frames of exactly that same woman, in this order: top-left left-foot contact, top-right passing/idle with feet close, bottom-left right-foot contact, bottom-right opposite passing. All four face three-quarter RIGHT, same face, hairstyle, clothes, body size, head alignment and foot baseline. Critical repair: in EVERY frame she carries the SAME SMALL METAL BUCKET in the SAME NEAR HAND on the VIEWER'S LEFT of her body, as in original row-three columns 1 and 4. Near arm stays down holding its bucket handle; bucket remains beside her LEFT thigh and knee with only gentle natural pendulum movement. Bucket must NEVER jump to viewer right, switch hands, disappear, duplicate, or change size. Free far arm can swing. Maintain four distinct natural leg phases without mirroring the entire person. Preserve the existing detailed warm gouache and sepia-ink hand-painted game style and her exact identity; no redesign. Exactly four equal square cells in a 2x2 grid, full bodies and bucket entirely inside each cell, consistent scale, head at about 8% and feet at about 92% height. Genuine transparent RGBA background including between limbs and bucket handle, no floor, no cast ground shadow, no text, no other characters, no borders or grid lines.
```

输入：`client/assets/survivors-walk-b-v4.webp`；工具选项：`transparent_background=true`。实际原生尺寸以文件为准；未放大素材。

## 验证

目视检查四帧桶的位置、完整身体和透明边缘。`browser-test/meng-walk.spec.js` 在实际游戏中覆盖四帧向右行走、停步、向左转身，读取实际送达WebP验证每帧近侧桶的像素，并验证入住后按需加载。截图：`test-results/meng-bucket-idle.png`、`test-results/meng-bucket-left.png`。
