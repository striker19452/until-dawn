"""Read sprite alpha bounds and encode delivery copies; never alter source PNG art."""
from pathlib import Path
from PIL import Image, ImageChops
import json

root = Path(__file__).resolve().parents[1]
assets = root / 'client/assets'
specs = [('house-states-v5', 2, 1), ('gate-states-v5', 3, 2), ('fence-states-v5', 3, 2), ('buildings-v3', 4, 2)]
result = {}
for name, columns, rows in specs:
    original = Image.open(assets / (name + '.png')).convert('RGBA')
    frames = []
    for row in range(rows):
        for col in range(columns):
            x, y = round(col * original.width / columns), round(row * original.height / rows)
            right, bottom = round((col + 1) * original.width / columns), round((row + 1) * original.height / rows)
            alpha = original.getchannel('A').crop((x, y, right, bottom))
            bounds = alpha.point(lambda v: 255 if v >= 16 else 0).getbbox()
            assert bounds
            frames.append({'rect': [x, y, right-x, bottom-y], 'bounds': list(bounds),
                           'origin': [(bounds[0]+bounds[2])/2/(right-x), bounds[3]/(bottom-y)]})
    result[name] = {'width': original.width, 'height': original.height, 'columns': columns, 'rows': rows, 'frames': frames}
    print(name, original.size, [f['bounds'] for f in frames])

for name in ['yard-ground-day-v5', 'yard-ground-night-v5', 'house-states-v5', 'gate-states-v5', 'fence-states-v5']:
    image = Image.open(assets / (name+'.png')).convert('RGBA')
    target = assets / (name+'.webp')
    image.save(target, 'WEBP', quality=78 if 'states' in name else 90, method=6, exact=True)
    decoded = Image.open(target).convert('RGBA')
    assert decoded.size == image.size
    assert ImageChops.difference(image.getchannel('A'), decoded.getchannel('A')).getbbox() is None
    print('delivery', name, target.stat().st_size, 'exact alpha')
(assets / 'structures-v5.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
