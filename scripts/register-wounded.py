"""Pack generated injury sprites without repainting or resizing their pixels.
Transparent component extraction only separates neighboring atlas cells.
"""
import json
from collections import deque
from pathlib import Path
from PIL import Image, ImageChops, ImageFilter

root = Path(__file__).resolve().parents[1]
assets = root / 'client/assets'
source = assets / 'survivors-wounded-v1.png'
image = Image.open(source).convert('RGBA')
alpha = image.getchannel('A')
w, h = image.size
opaque = bytearray(v > 32 for v in alpha.get_flattened_data())
components = []
for start in range(w*h):
    if not opaque[start]:
        continue
    opaque[start] = 0
    queue, points = deque([start]), []
    while queue:
        p = queue.popleft()
        points.append(p)
        x, y = p % w, p // w
        for q in (p-w if y else -1, p+w if y < h-1 else -1,
                  p-1 if x else -1, p+1 if x < w-1 else -1):
            if q >= 0 and opaque[q]:
                opaque[q] = 0
                queue.append(q)
    if len(points) > 1000:
        components.append(points)
assert len(components) == 16, 'Expected two poses for each of eight people'
components.sort(key=lambda points: (min(p//w for p in points)//310, min(p % w for p in points)))
people = ['hero', 'lin', 'zhou', 'chen', 'xu', 'yuan', 'meng', 'visitor']
old = json.loads((assets/'survivors-walk-v4.json').read_text())
packed = Image.new('RGBA', (1536, 1536))
frames = []
for i, points in enumerate(components):
    mask = Image.new('L', image.size)
    mask.putdata([0]*(w*h))
    pixels = mask.load()
    for p in points:
        pixels[p % w, p//w] = 255
    # Preserve the original translucent contour, without taking a neighbor's body.
    contour = mask.filter(ImageFilter.MaxFilter(5))
    for j, other in enumerate(components):
        if j != i:
            for p in other:
                contour.putpixel((p % w, p//w), 0)
    selected_alpha = ImageChops.multiply(alpha, contour)
    bounds = selected_alpha.getbbox()
    crop = image.crop(bounds)
    crop.putalpha(selected_alpha.crop(bounds))
    assert crop.width <= 344 and crop.height <= 344
    x = (i % 4)*384 + (384-crop.width)//2
    y = (i//4)*384 + 344-crop.height
    packed.paste(crop, (x, y))
    local = [x % 384, y % 384, x % 384+crop.width, y % 384+crop.height]
    person = people[i//2]
    standing = [f for s in old['sheets'] for f in s['frames'] if f['person'] == person]
    old_sheet = next(s for s in old['sheets'] if any(f['person']==person for f in s['frames']))
    standing_height = sum((f['bounds'][3]-f['bounds'][1])*75/old_sheet['cellSize'] for f in standing)/len(standing)
    if i % 2 == 0:
        render_scale = standing_height*.70/crop.height
    frames.append({'person': person, 'pose': 'seated' if i % 2 == 0 else 'crawl',
                   'rect': [(i % 4)*384, (i//4)*384, 384, 384],
                   'bounds': local,
                   'origin': [round((local[0]+local[2])/768, 6), round(local[3]/384, 6)],
                   'renderScale': round(render_scale, 6), 'sourceBounds': list(bounds)})
png = assets/'survivors-wounded-atlas-v1.png'
web = png.with_suffix('.webp')
packed.save(png)
packed.save(web, 'WEBP', quality=90, method=6, exact=True)
assert ImageChops.difference(packed.getchannel('A'), Image.open(web).getchannel('A')).getbbox() is None
registration = {'source': source.name, 'file': web.name, 'width': 1536, 'height': 1536,
                'columns': 4, 'rows': 4, 'cellSize': 384, 'baseFacing': 1,
                'note': 'Eight identities; seated and ground-supported retreat. Per-person scale is shared by both poses. Source pixels are never resized or repainted; only transparent packing.',
                'frames': frames}
(assets/'survivors-wounded-v1.json').write_text(json.dumps(registration, ensure_ascii=False, indent=2)+'\n')
print(json.dumps({'frames': len(frames), 'webBytes': web.stat().st_size, 'alphaExact': True}))
