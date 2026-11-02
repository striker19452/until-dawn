# 防御设施 V7（2026-10-23）

使用内置图像生成工具（image_gen，未使用CLI）生成三张独立的透明手绘素材，以现有 `props-v3.webp` 为风格参考。PNG原图保留；游戏使用长边不超过768、质量85的WebP，三张合计222,146字节。WebP与缩放后的RGBA的alpha逐像素一致，未对原图做抠图、重画或语义修补。注册信息按alpha>40的实际主体范围生成，避免透明留白影响脚底和悬挂点。

|用途|游戏素材|生成原图|
|---|---|---|
|翻刺单根木桩，按墙面重复排列|[defense-spike-v7.webp](/Users/str/MyProjects/末日生存/client/assets/defense-spike-v7.webp)|[PNG](/Users/str/MyProjects/末日生存/client/assets/defense-spike-v7.png)|
|金属网面，随地面方向投影|[defense-mesh-v7.webp](/Users/str/MyProjects/末日生存/client/assets/defense-mesh-v7.webp)|[PNG](/Users/str/MyProjects/末日生存/client/assets/defense-mesh-v7.png)|
|悬挂铜铃，绕绳结摆动|[defense-bell-v7.webp](/Users/str/MyProjects/末日生存/client/assets/defense-bell-v7.webp)|[PNG](/Users/str/MyProjects/末日生存/client/assets/defense-bell-v7.png)|

陷阱沿用现有 [props-v3.webp](/Users/str/MyProjects/末日生存/client/assets/props-v3.webp) 第3帧，按真实alpha边界注册落地点并放大。去除遮住原绊索的粗线覆盖。所有设施由 `client/defense-art.js` 管理独立对象；支架、绳线、布条、触发亮屑／波纹／绷网／绊缚通过Phaser绘制。左右方向和前后层次遵守门栏几何；不新增伤害、控制、碰撞或资源消耗规则。

## 最终提示词

三次生成均使用以下共同前缀，随后附上各自的Subject段；`transparent_background=true`，参考图为 `client/assets/props-v3.webp`。

> Use case: stylized-concept. Asset type: transparent isolated sprite for the existing small Chinese survival courtyard game. Input image 1 is STYLE REFERENCE ONLY: match its warm hand-painted rustic wood/metal, detailed illustrated surfaces, dark ink edges and clear mobile-size silhouette. Produce ONLY the requested single object, large and centered with generous fully transparent margins, no backdrop, no ground tile, no text, no UI, no watermark, no glow. Bold readable painterly material, not flat vector art. Soft neutral upper-left lighting, slightly elevated 3/4 game camera. Genuine alpha transparency.

翻刺：

> Subject: ONE single upright sharpened wooden defensive stake, tall narrow chestnut timber with visible grain and rough-carved pale ivory point. Two tight hemp rope bindings low on its shaft. Show the entire stake from pointed top to flat blunt bottom, no beam or other stakes, no vegetation. It will be repeated in a row by code. Keep its shaft vertical and its silhouette simple and thick, point obviously sharp.

埋网：

> Subject: one broad horizontal rectangular panel of heavy silvery sage-green woven metal wire mesh pegged at four corners, a sturdy rolled thick border and a modest partly folded corner. A few narrow earth clods along the bottom edge show it is anchored into soil, but NO ground patch behind it. The rectangular wire cells should be thick, sparse enough to remain legible when shrunk to 70 pixels wide. Camera looks down on the mat at 35 degrees: long front edge nearly horizontal, other edges recede slightly to the back; width roughly twice height. Real interwoven wire knots, weathered metal highlights, four clear small timber fastening pegs.

铃绳：

> Subject: ONE large old brass alarm bell dangling from a very short hemp loop, complete broad flared lip and a visible round dark clapper below it. Warm burnished ochre copper with patina and pale golden edge highlights, dark inner mouth. Hanging upright and centered. No posts, no crossbar, no lantern, no candles. Keep the whole short rope loop, bell and clapper within the image. Bell should be strongly recognizable at 20 pixels, a broad flared traditional handbell silhouette.
