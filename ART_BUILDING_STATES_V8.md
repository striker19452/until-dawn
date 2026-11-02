# 八类设施的独立受损与损毁美术 V8

使用内置 image_gen；以当前 buildings-v3 单体透明精灵为编辑目标，16次独立生成。保留原始 PNG 的 RGBA，运行时合并为透明 WebP 图集。

资产：`client/assets/building-states-v8/`（16个原始PNG），`client/assets/building-states-v8.webp`（运行图集），`client/assets/building-states-v8.json`（独立帧、脚点与缩放注册）。

运行状态：10完好；0<耐久<10受损；0损毁。受损允许1行动2建材维修；废墟须清理或按新设施原价2行动重建，新建一级10耐久，旧等级／分支／收获进度不保留；允许原址换类型。

以下为每项最终提示词。

## garden · damaged

保存：`client/assets/building-states-v8/garden-damaged.png`

```text
Use case: precise-object-edit. Asset type: ONE transparent-background isometric survival-game facility sprite, damaged state. Input image is the original intact garden sprite: EDIT TARGET and strict reference for identity, exact camera angle, front/right orientation, warm hand-painted outlined illustration style and material palette. Create exactly one isolated sprite, centered in a square image. Primary request: Two raised vegetable beds with visibly split front timber, one bowed rim, torn climbing stakes, and a large patch of crushed vegetables and exposed earth. About a third of plants are trampled but enough bright healthy green/red vegetables remain to identify the garden as still working. LARGE conspicuous broken planks and leaves, not a tiny scratch. Preserve the recognizable original design and its ground orientation; make damage conspicuous at a final on-screen width of 65 pixels. Crisp painterly textured game art with strong warm edge highlights, appealing legible silhouette, no photo/3D render/vector placeholder. The entire object and scattered parts must fit with a clear transparent gutter on every side. Scene/backdrop: genuine RGBA TRANSPARENT background with no backdrop, no floor tile, no checkerboard, no white rectangle. Lighting: match original neutral daytime with warm edges; game adds night tint later. No labels, text, numbers, HUD, icons, borders, creatures or people. Do not add a generic crossed-plank symbol. Output this one garden damaged sprite only.
```

## garden · destroyed

保存：`client/assets/building-states-v8/garden-destroyed.png`

```text
Use case: precise-object-edit. Asset type: ONE transparent-background isometric survival-game facility sprite, destroyed state. Input image is the original intact garden sprite: EDIT TARGET and strict reference for identity, exact camera angle, front/right orientation, warm hand-painted outlined illustration style and material palette. Create exactly one isolated sprite, centered in a square image. Primary request: A completely flattened unusable vegetable garden: both low timber bed frames burst open, dark tilled soil spilled out, uprooted cabbages, red tomatoes and snapped stakes scattered inside the former rectangular footprint. No standing healthy crops. Retain the two recognizable planting beds; no stone rubble. Preserve the recognizable original design and its ground orientation; make damage conspicuous at a final on-screen width of 65 pixels. Crisp painterly textured game art with strong warm edge highlights, appealing legible silhouette, no photo/3D render/vector placeholder. The entire object and scattered parts must fit with a clear transparent gutter on every side. Scene/backdrop: genuine RGBA TRANSPARENT background with no backdrop, no floor tile, no checkerboard, no white rectangle. Lighting: match original neutral daytime with warm edges; game adds night tint later. No labels, text, numbers, HUD, icons, borders, creatures or people. Do not add a generic crossed-plank symbol. Output this one garden destroyed sprite only.
```

## water · damaged

保存：`client/assets/building-states-v8/water-damaged.png`

```text
Use case: precise-object-edit. Asset type: ONE transparent-background isometric survival-game facility sprite, damaged state. Input image is the original intact water sprite: EDIT TARGET and strict reference for identity, exact camera angle, front/right orientation, warm hand-painted outlined illustration style and material palette. Create exactly one isolated sprite, centered in a square image. Primary request: A still-upright blue water barrel and attached filter assembly: large dent across the blue barrel, clearly split metal seam with a short bright blue water leak into a puddle, visibly bent pipe and one broken support plank. Filter cylinder remains attached and upright. Readable severe localized physical damage, still functioning. Preserve the recognizable original design and its ground orientation; make damage conspicuous at a final on-screen width of 65 pixels. Crisp painterly textured game art with strong warm edge highlights, appealing legible silhouette, no photo/3D render/vector placeholder. The entire object and scattered parts must fit with a clear transparent gutter on every side. Scene/backdrop: genuine RGBA TRANSPARENT background with no backdrop, no floor tile, no checkerboard, no white rectangle. Lighting: match original neutral daytime with warm edges; game adds night tint later. No labels, text, numbers, HUD, icons, borders, creatures or people. Do not add a generic crossed-plank symbol. Output this one water damaged sprite only.
```

## water · destroyed

保存：`client/assets/building-states-v8/water-destroyed.png`

```text
Use case: precise-object-edit. Asset type: one transparent isometric game prop. Edit target: supplied original water sprite. Depict the same facility in a naturally dilapidated, dismantled and out-of-service condition. Specific physical material details: An unusable blue water barrel filtering station collapsed onto its side: barrel torn wide open, bent silver inlet pipe detached beside it, filter cartridge knocked out and white gravel spilled, broken wood stand, broad small blue puddle. Keep unmistakable blue barrel and pale filter materials. Low collapsed silhouette, no generic stone pile. This is a peaceful still-life of an unoccupied maintenance prop, with no people, animals, injuries, weapons, conflict, explosive effects, smoke or flames. Keep exact original camera orientation, warm hand-painted outlined texture, characteristic colors and main materials. Make the altered silhouette and missing pieces very legible at 65px wide. Show exactly ONE complete isolated prop centered in square composition, transparent gutters all sides. Genuine transparent RGBA background, no floor tile, checkerboard or backdrop. No text, UI, labels, symbols or generic crossed planks.
```

## workshop · damaged

保存：`client/assets/building-states-v8/workshop-damaged.png`

```text
Use case: precise-object-edit. Asset type: ONE transparent-background isometric survival-game facility sprite, damaged state. Input image is the original intact workshop sprite: EDIT TARGET and strict reference for identity, exact camera angle, front/right orientation, warm hand-painted outlined illustration style and material palette. Create exactly one isolated sprite, centered in a square image. Primary request: The wooden repair workshop still standing but badly damaged: LARGE jagged missing section in corrugated roof, sagging bent roof corner, front bench broken in one corner, toolbox open and scattered tools, one cracked upright. Warm lantern still hanging, recognizable workbench remains usable. Clear visible silhouette damage. Preserve the recognizable original design and its ground orientation; make damage conspicuous at a final on-screen width of 65 pixels. Crisp painterly textured game art with strong warm edge highlights, appealing legible silhouette, no photo/3D render/vector placeholder. The entire object and scattered parts must fit with a clear transparent gutter on every side. Scene/backdrop: genuine RGBA TRANSPARENT background with no backdrop, no floor tile, no checkerboard, no white rectangle. Lighting: match original neutral daytime with warm edges; game adds night tint later. No labels, text, numbers, HUD, icons, borders, creatures or people. Do not add a generic crossed-plank symbol. Output this one workshop damaged sprite only.
```

## workshop · destroyed

保存：`client/assets/building-states-v8/workshop-destroyed.png`

```text
Use case: precise-object-edit. Asset type: ONE transparent-background isometric survival-game facility sprite, destroyed state. Input image is the original intact workshop sprite: EDIT TARGET and strict reference for identity, exact camera angle, front/right orientation, warm hand-painted outlined illustration style and material palette. Create exactly one isolated sprite, centered in a square image. Primary request: The wooden repair workshop fully collapsed and unusable: folded rusty corrugated roof lying diagonally across snapped timber bench, splintered legs, overturned blue toolbox and scattered spanner/hammer, broken unlit lantern. Low wood-and-sheet-metal wreck retains the workshop's unique tools; no stone heap. Preserve the recognizable original design and its ground orientation; make damage conspicuous at a final on-screen width of 65 pixels. Crisp painterly textured game art with strong warm edge highlights, appealing legible silhouette, no photo/3D render/vector placeholder. The entire object and scattered parts must fit with a clear transparent gutter on every side. Scene/backdrop: genuine RGBA TRANSPARENT background with no backdrop, no floor tile, no checkerboard, no white rectangle. Lighting: match original neutral daytime with warm edges; game adds night tint later. No labels, text, numbers, HUD, icons, borders, creatures or people. Do not add a generic crossed-plank symbol. Output this one workshop destroyed sprite only.
```

## generator · damaged

保存：`client/assets/building-states-v8/generator-damaged.png`

```text
Use case: precise-object-edit. Asset type: ONE transparent-background isometric survival-game facility sprite, damaged state. Input image is the original intact generator sprite: EDIT TARGET and strict reference for identity, exact camera angle, front/right orientation, warm hand-painted outlined illustration style and material palette. Create exactly one isolated sprite, centered in a square image. Primary request: The compact yellow portable generator badly damaged but upright: yellow casing bent open exposing engine belt/copper coils, thick broken protective bar, front grill torn and cable frayed, small dark oil stain. Orange/red fuel can remains standing beside it. No fire, no smoke clouds, no explosion. Bold visible mechanical breakage. Preserve the recognizable original design and its ground orientation; make damage conspicuous at a final on-screen width of 65 pixels. Crisp painterly textured game art with strong warm edge highlights, appealing legible silhouette, no photo/3D render/vector placeholder. The entire object and scattered parts must fit with a clear transparent gutter on every side. Scene/backdrop: genuine RGBA TRANSPARENT background with no backdrop, no floor tile, no checkerboard, no white rectangle. Lighting: match original neutral daytime with warm edges; game adds night tint later. No labels, text, numbers, HUD, icons, borders, creatures or people. Do not add a generic crossed-plank symbol. Output this one generator damaged sprite only.
```

## generator · destroyed

保存：`client/assets/building-states-v8/generator-destroyed.png`

```text
Use case: precise-object-edit. Asset type: one transparent isometric game prop. Edit target: supplied original generator sprite. Depict the same facility in a naturally dilapidated, dismantled and out-of-service condition. Specific physical material details: An unusable yellow generator wreck on its side: crushed yellow shell ripped open, exposed copper coils and black motor block, bent black cage, detached fan wheel, red fuel can tipped safely closed beside coiled orange cable, small dark oil puddle. Low unique machinery wreck, no wood barricade or stone pile. This is a peaceful still-life of an unoccupied maintenance prop, with no people, animals, injuries, weapons, conflict, explosive effects, smoke or flames. Keep exact original camera orientation, warm hand-painted outlined texture, characteristic colors and main materials. Make the altered silhouette and missing pieces very legible at 65px wide. Show exactly ONE complete isolated prop centered in square composition, transparent gutters all sides. Genuine transparent RGBA background, no floor tile, checkerboard or backdrop. No text, UI, labels, symbols or generic crossed planks.
```

## infirmary · damaged

保存：`client/assets/building-states-v8/infirmary-damaged.png`

```text
Use case: precise-object-edit. Asset type: one transparent isometric game prop. Edit target: supplied original infirmary sprite. Depict the same facility in a visibly worn but still usable condition. Specific physical material details: The cream canvas medical shelter visibly damaged but still standing: LARGE triangular tear across canopy revealing frame, drooping torn side canvas and one splintered pole, bed still level with blanket, red medical chest visible and slightly open. Distinct white/cream fabric damage readable at small size, lamp remains lit. This is a peaceful still-life of an unoccupied maintenance prop, with no people, animals, injuries, weapons, conflict, explosive effects, smoke or flames. Keep exact original camera orientation, warm hand-painted outlined texture, characteristic colors and main materials. Make the altered silhouette and missing pieces very legible at 65px wide. Show exactly ONE complete isolated prop centered in square composition, transparent gutters all sides. Genuine transparent RGBA background, no floor tile, checkerboard or backdrop. No text, UI, labels, symbols or generic crossed planks.
```

## infirmary · destroyed

保存：`client/assets/building-states-v8/infirmary-destroyed.png`

```text
Use case: precise-object-edit. Asset type: one transparent isometric game prop. Edit target: supplied original infirmary sprite. Depict the same facility in a naturally dilapidated, dismantled and out-of-service condition. Specific physical material details: An unusable collapsed cream-canvas medical shelter: tent frame snapped and folded down, broad torn cream canvas draped low over a crooked cot, visible red first-aid box with bandage rolls spilling, detached unlit lamp and bent bed legs. Distinct fabric-and-cot wreck, no generic wood-and-stone pile. This is a peaceful still-life of an unoccupied maintenance prop, with no people, animals, injuries, weapons, conflict, explosive effects, smoke or flames. Keep exact original camera orientation, warm hand-painted outlined texture, characteristic colors and main materials. Make the altered silhouette and missing pieces very legible at 65px wide. Show exactly ONE complete isolated prop centered in square composition, transparent gutters all sides. Genuine transparent RGBA background, no floor tile, checkerboard or backdrop. No text, UI, labels, symbols or generic crossed planks.
```

## watchtower · damaged

保存：`client/assets/building-states-v8/watchtower-damaged.png`

```text
Use case: precise-object-edit. Asset type: one transparent isometric game prop. Edit target: supplied original watchtower sprite. Depict the same facility in a visibly worn but still usable condition. Specific physical material details: The tall timber observation tower is still upright but badly damaged: missing half of the front railing, a snapped ladder rung and bent ladder side, visibly broken diagonal brace, ripped green canopy hanging from one corner. Preserve tower height and lookout platform, conspicuous silhouette holes. Warm lantern remains attached. This is a peaceful still-life of an unoccupied maintenance prop, with no people, animals, injuries, weapons, conflict, explosive effects, smoke or flames. Keep exact original camera orientation, warm hand-painted outlined texture, characteristic colors and main materials. Make the altered silhouette and missing pieces very legible at 65px wide. Show exactly ONE complete isolated prop centered in square composition, transparent gutters all sides. Genuine transparent RGBA background, no floor tile, checkerboard or backdrop. No text, UI, labels, symbols or generic crossed planks.
```

## watchtower · destroyed

保存：`client/assets/building-states-v8/watchtower-destroyed.png`

```text
Use case: precise-object-edit. Asset type: one transparent isometric game prop. Edit target: supplied original watchtower sprite. Depict the same facility in a naturally dilapidated, dismantled and out-of-service condition. Specific physical material details: An unusable collapsed observation tower: lookout platform overturned at a low angle over two snapped tall timber legs, broken ladder lying across ground, torn olive-green canopy and detached dark lantern among cross braces. Strong flattened triangular timber silhouette that clearly used to be a tower, no stone heap. This is a peaceful still-life of an unoccupied maintenance prop, with no people, animals, injuries, weapons, conflict, explosive effects, smoke or flames. Keep exact original camera orientation, warm hand-painted outlined texture, characteristic colors and main materials. Make the altered silhouette and missing pieces very legible at 65px wide. Show exactly ONE complete isolated prop centered in square composition, transparent gutters all sides. Genuine transparent RGBA background, no floor tile, checkerboard or backdrop. No text, UI, labels, symbols or generic crossed planks.
```

## stove · damaged

保存：`client/assets/building-states-v8/stove-damaged.png`

```text
Use case: precise-object-edit. Asset type: one transparent isometric game prop. Edit target: supplied original stove sprite. Depict the same facility in a visibly worn but still usable condition. Specific physical material details: The brick communal cookstove still standing but badly damaged: LARGE missing chunk from the front-left brick corner exposing dark firebox, several loose red/orange bricks, sharply cracked and tilted chimney, lidded iron cooking pot remains upright over small contained embers. No giant flames. Very visible masonry damage. This is a peaceful still-life of an unoccupied maintenance prop, with no people, animals, injuries, weapons, conflict, explosive effects, smoke or flames. Keep exact original camera orientation, warm hand-painted outlined texture, characteristic colors and main materials. Make the altered silhouette and missing pieces very legible at 65px wide. Show exactly ONE complete isolated prop centered in square composition, transparent gutters all sides. Genuine transparent RGBA background, no floor tile, checkerboard or backdrop. No text, UI, labels, symbols or generic crossed planks.
```

## stove · destroyed

保存：`client/assets/building-states-v8/stove-destroyed.png`

```text
Use case: precise-object-edit. Asset type: one transparent isometric game prop. Edit target: supplied original stove sprite. Depict the same facility in a naturally dilapidated, dismantled and out-of-service condition. Specific physical material details: An unusable broken brick cookstove: firebox collapsed open into a low scatter of warm red/orange bricks, black iron cooking pot overturned with detached lid, broken rusty chimney pipe lying diagonally, split wooden chopping board and one fallen pan. Completely unlit. Recognizable stove materials, not generic gray rubble. This is a peaceful still-life of an unoccupied maintenance prop, with no people, animals, injuries, weapons, conflict, explosive effects, smoke or flames. Keep exact original camera orientation, warm hand-painted outlined texture, characteristic colors and main materials. Make the altered silhouette and missing pieces very legible at 65px wide. Show exactly ONE complete isolated prop centered in square composition, transparent gutters all sides. Genuine transparent RGBA background, no floor tile, checkerboard or backdrop. No text, UI, labels, symbols or generic crossed planks.
```

## exchange · damaged

保存：`client/assets/building-states-v8/exchange-damaged.png`

```text
Use case: precise-object-edit. Asset type: one transparent isometric game prop. Edit target: supplied original exchange sprite. Depict the same facility in a visibly worn but still usable condition. Specific physical material details: The mutual-aid notice board and mailbox still upright but badly damaged: LARGE broken-out corner of the wooden board, papers visibly torn, roof plank snapped and hanging, red mailbox badly dented with bent lid, lower supply crate split open. Some notices remain attached. Bold recognizable damaged board silhouette. This is a peaceful still-life of an unoccupied maintenance prop, with no people, animals, injuries, weapons, conflict, explosive effects, smoke or flames. Keep exact original camera orientation, warm hand-painted outlined texture, characteristic colors and main materials. Make the altered silhouette and missing pieces very legible at 65px wide. Show exactly ONE complete isolated prop centered in square composition, transparent gutters all sides. Genuine transparent RGBA background, no floor tile, checkerboard or backdrop. No text, UI, labels, symbols or generic crossed planks.
```

## exchange · destroyed

保存：`client/assets/building-states-v8/exchange-destroyed.png`

```text
Use case: precise-object-edit. Asset type: one transparent isometric game prop. Edit target: supplied original exchange sprite. Depict the same facility in a naturally dilapidated, dismantled and out-of-service condition. Specific physical material details: An unusable mutual-aid notice station knocked down: wooden notice board split in two and lying diagonally on snapped posts, torn cream notes scattered, dented red mailbox fallen beside an overturned open supply crate, small detached roof planks. Distinct red mailbox and paper-covered board wreck, no masonry pile. This is a peaceful still-life of an unoccupied maintenance prop, with no people, animals, injuries, weapons, conflict, explosive effects, smoke or flames. Keep exact original camera orientation, warm hand-painted outlined texture, characteristic colors and main materials. Make the altered silhouette and missing pieces very legible at 65px wide. Show exactly ONE complete isolated prop centered in square composition, transparent gutters all sides. Genuine transparent RGBA background, no floor tile, checkerboard or backdrop. No text, UI, labels, symbols or generic crossed planks.
```
