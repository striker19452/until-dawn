# 院子背景高清细节 V4

日期：2026-10-21。

## 方法与实际限制

使用内置 `image_gen.imagegen` 编辑现有 V3 图片，未使用 CLI 或插值放大。提示词请求 2048 × 2560（4:5）原生生成；内置工具没有显式尺寸参数，实测白天输出仍为 **1122 × 1402**，与 V3 相同，因此这个素材不能作为“原生 2K”交付或宣传。V4 代表原生重绘的纹理与边缘细节版本；手机高清画布适配由运行时代码另行负责。

保留旧 V3，不覆盖原文件。所有最终 PNG 从工具原始输出直接复制到项目，未做图像后处理。

## 白天

- 编辑目标：`client/assets/yard-day-v3.png`（1122 × 1402）。
- 原始输出：`/Users/str/.codex/generated_images/01a15f18-b4b7-7c11-ba28-ea87cb14b963/exec-614c9051-59b3-4b95-9dd1-b0ef906c3619.png`。
- 项目副本：`client/assets/yard-day-hd-v4.png`。
- 实测输出：1122 × 1402。
- 目视检查：院落相机、房屋屋顶/门窗、围墙、大门、中央火坑均与 V3 位置基本一致，颜色为暖琥珀与土色，屋瓦/地面裂纹/墙石纹理更清晰；无人物、生物、火焰、界面或字样。该生成版本的细节有局部重绘，不能视为逐像素几何不变。

### 完整白天提示词

```text
Use case: precise-object-edit. Asset type: high-resolution 2D mobile survival game courtyard background, portrait 4:5. Input image 1 is the EDIT TARGET, not a loose inspiration. Create a genuinely newly rendered higher-resolution 2048 x 2560 pixel version with additional carefully painted native microdetail. Preserve the exact original image framing, camera, perspective, layout and positions of all objects: same full stone courtyard, same small central tiled-roof cottage, its doorway/windows/chimney and laundry line, same outer ruined village, same five wall/gate boundaries and front gate, same empty stone firepit center, same paths and trees. Do not enlarge, move or add buildings, props, plants or architectural features. Geometry and silhouettes should align when overlaid with the target. Change only image resolution and detail richness. More intricate roof tiles, worn mortar, plaster fissures, chips in stone, leaf edges, woodgrain, ceramic and cloth folds, all in the same restrained painterly watercolor/gouache hand-drawn illustrated style. Preserve warm late-afternoon amber daylight, desaturated earth/umber/slate palette and welcoming warm window glow. The yard is an empty warm refuge in an abandoned wasteland. Empty stone firepit with logs but NO flame or smoke. NO people, creatures, UI, letters, labels, icon, watermark, color bars, border, lens bloom or camera change. Output one full-bleed portrait 4:5 image at 2048 by 2560 pixels or the highest genuinely generated 4:5 native resolution available. Do not merely interpolate old pixels. Crisp hand-painted details, no oversharpening and no green wash.
```

## 夜间

- 编辑目标：新白天图 `client/assets/yard-day-hd-v4.png`；旧夜图 `client/assets/yard-night-v3.png` 仅作光色参考。
- 原始输出：`/Users/str/.codex/generated_images/01a15f18-b4b7-7c11-ba28-ea87cb14b963/exec-53d43860-e4ae-41d7-a3ed-17d3a21961b2.png`。
- 项目副本：`client/assets/yard-night-hd-v4.png`。
- 实测输出：1122 × 1402。两张新图均没有达到提示词请求的 2048 × 2560；不再重复请求，避免把工具尺寸限制当作内容问题。
- 目视检查：与新白天图同构，屋顶/窗门/围墙/前门/火坑位置一致，蓝灰月光与室内琥珀色保持辨识度，无人物、生物、火焰、烟、界面、字样。旧夜图与新夜图相比，地面细节笔触更清晰，但仍是同分辨率重绘。

### 完整夜间提示词

```text
Use case: lighting-weather. Asset type: high-detail matching night 2D mobile survival game courtyard background, portrait 4:5. Image 1 is the exact daylight EDIT TARGET whose newly redrawn details and geometry must remain locked. Image 2 is the old night version used ONLY as the lighting and color reference. Make the matching night companion to image 1. Re-render at 2048 x 2560 pixels or the highest native 4:5 resolution available. Keep image 1's exact original camera, framing, perspective, courtyard layout, all silhouettes and object positions unchanged: small tiled-roof cottage, doorway/windows/chimney, laundry, rear stonewall gates, two side fences, front roofed gate, empty central firepit/logs, paths and outside village. Change ONLY daylight to cool moonlit nighttime with rich slate-blue shadows, readable delicate brushwork, and small glowing amber cottage windows and open door. Retain precise roof tile, stone, plaster, woodgrain, cloth, plant, ceramic and path crack details. Same hand-drawn watercolor/gouache style. The refuge should feel gently warm inside a tense wasteland, with enough moonlight to play. Empty stone firepit with logs but NO flame or smoke because fire is a separate game sprite. NO people, creatures, added lanterns or props, text, UI, letters, labels, icon, border, watermark, green wash or camera move. Do not add or remove any object. Do not apply blur or plastic sharpening. One complete portrait night environment image.
```

