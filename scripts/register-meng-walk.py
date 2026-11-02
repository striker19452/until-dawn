"""Register the repaired Meng atlas and encode its web copy without changing alpha.
Requires Pillow, as does optimize-assets.py. The generated PNG stays untouched.
"""
import json
from pathlib import Path
from statistics import mean
from PIL import Image, ImageChops

root = Path(__file__).resolve().parents[1]
assets = root / 'client/assets'
source = assets / 'meng-walk-v5.png'
image = Image.open(source).convert('RGBA')
width, height = image.size
alpha = image.getchannel('A')
frames = []
for phase in range(4):
    col, row = phase % 2, phase // 2
    x0, x1 = round(col * width / 2), round((col + 1) * width / 2)
    y0, y1 = round(row * height / 2), round((row + 1) * height / 2)
    mask = alpha.crop((x0, y0, x1, y1))
    bounds = mask.point(lambda a: 255 if a > 32 else 0).getbbox()
    assert bounds and bounds[0] > 0 and bounds[1] > 0 and bounds[2] < x1-x0 and bounds[3] < y1-y0
    left, top, right, bottom = bounds
    head = [(x, y) for y in range(top, round(top+(bottom-top)*.24)) for x in range(left, right) if mask.getpixel((x, y)) > 32]
    anchor = mean(x for x, _ in head)
    frames.append({'frame': phase, 'person': 'meng', 'phase': phase,
                   'rect': [x0, y0, x1-x0, y1-y0], 'bounds': list(bounds),
                   'origin': [round(anchor/(x1-x0), 6), round(bottom/(y1-y0), 6)]})

# Match her existing on-screen height with one scale for all four new frames.
old = json.loads((assets / 'survivors-walk-v4.json').read_text())['sheets'][1]
old_height = mean(f['bounds'][3]-f['bounds'][1] for f in old['frames'] if f['person'] == 'meng')
new_height = mean(f['bounds'][3]-f['bounds'][1] for f in frames)
registration = {'file': source.name, 'width': width, 'height': height, 'columns': 2, 'rows': 2,
                'cellSize': width/2, 'displaySize': round(75*old_height/old['cellSize']*(width/2)/new_height, 6),
                'note': 'Four repaired frames keep the bucket in the same near hand. Head/foot anchors and uniform scale preserve her standing height.',
                'frames': frames}
(assets / 'meng-walk-v5.json').write_text(json.dumps(registration, indent=2)+'\n')
target = source.with_suffix('.webp')
image.save(target, 'WEBP', quality=90, method=6, exact=True)
decoded = Image.open(target).convert('RGBA')
assert decoded.size == image.size
assert ImageChops.difference(alpha, decoded.getchannel('A')).getbbox() is None
print(json.dumps({'source': source.name, 'size': image.size, 'webBytes': target.stat().st_size,
                  'alphaExact': True, 'displaySize': registration['displaySize']}))
