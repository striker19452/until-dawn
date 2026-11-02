# 第三版场景素材

使用内置 image_gen；生成白天场景，再以同图编辑夜间光照。原始文件直接复制到项目，没有用脚本改图。

- 白天：client/assets/yard-day-v3.png
- 夜间：client/assets/yard-night-v3.png
- 白天原件：/Users/str/.codex/generated_images/01a159a0-4f9a-7380-b607-033a6bcaa33c/exec-ca23c9d1-afc5-4ef8-ab07-f783ddd60a26.png
- 夜间原件：/Users/str/.codex/generated_images/01a159a0-4f9a-7380-b607-033a6bcaa33c/exec-fb177921-1b3f-4900-86a5-304d860af49c.png
- 目视：完整精细院子，日夜结构一致，无人物、生物、文字或界面。真实构图中的围栏、房屋、火坑锚点由渲染层映射，模拟层坐标不变。

## 白天提示词

```text
Use case: stylized-concept
Asset type: production background artwork for a mobile portrait survival strategy game, not a UI mockup.
Primary request: an exquisitely illustrated small Chinese courtyard refuge after the apocalypse, cozy human warmth inside, abandoned wilderness outside. Professional premium gouache and watercolor storybook game art, delicate ink detailing, textured natural surfaces, refined painterly lighting. A full finished environment asset with no UI.
Composition: PORTRAIT 4:5 canvas. Fixed three-quarter overhead game-board view (near top-down with short visible facades, NOT dramatic isometric diamond). The rectangular refuge is aligned horizontally, NOT rotated. The enclosure corners approximately x14%/86%, y28%/80%. ONE small single-story cottage centered around x50%, y44%, occupying x34%-66%, y33%-56%; short worn terracotta/slate roof, warm plaster and amber window light, door opening toward bottom. Open dirt yard below and beside cottage for placing gameplay sprites; keep broad uncluttered walking space. Main entrance at x50%, y79%; left/right fence weak points at x14.5%/85.5%, y52%; back fence weak points at x30%/70%, y28%. Low old masonry and wooden fence around the rectangular yard, clearly readable from above. Weak fence sections visibly wood. Exterior scrub, fallen leaves, cracked pale ground, a few distant abandoned low rooftops along top corners. Cottage footprint and fence are the anchors.
Life details: neatly hung laundry near left side of cottage, one bench and chipped cups by the doorstep, little potted plants along wall, a folded quilt in a warm-lit window. A small EMPTY circular stone fire pit centered x50%, y65%, ready for separate flame sprite; no active flame painted in. EMPTY open patches at left-middle, left-lower, right-upper, right-middle, bottom-left and bottom-right reserved for buildable installations. Do NOT draw vegetable beds, water barrels, workshops, generators or watchtowers into these patches.
Palette: sun-warmed sand, ochre earth, old brick, faded cream plaster, warm grey timber, muted sage only in small plants; NOT a green wash. Late afternoon soft honey light and cool distant shadows. Readable shapes, rich material detail and nuanced brushwork, premium finished game illustration, not simplified vector or flat primitive shapes. No people, no creatures, no words, no numbers, no border, no interface, no dramatic diagonal beam or line. Opaque complete image.
```

## 夜间编辑提示词

```text
Use case: lighting-weather
Asset type: exact night-lighting variant of the provided courtyard game background.
Edit target: the supplied yard-day-v3 image. Preserve the EXACT canvas dimensions, framing, perspective, every building, fence, wall, gate, fire-pit location, floor paths and object positions. Change ONLY light, sky ambience and illumination into quiet midnight.
Beautiful premium gouache/ink game illustration. Desaturated blue-grey moonlit stone and earth outside, old slate roof, restrained deep shadows; bright enough to read all five fence sectors and open dirt yard on a phone. Amber cottage windows and open doorway create a small warm refuge. A gentle amber light pool may illuminate the ground by the doorstep but the empty central circular stone fire pit must remain without a painted flame, since the flame is a separate game object.
No people, creatures or extra buildings, no text, no UI. Do not redesign or move anything. Avoid a green cast, neon colors, black crushed shadows, dramatic diagonal beams, large fog overlays or unexplained glowing lines. Preserve opaque original image.
```

