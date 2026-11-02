"""Register four generated running poses and encode WebP, retaining source alpha."""
import json
from pathlib import Path
from PIL import Image, ImageChops

assets = Path(__file__).resolve().parents[1] / 'client/assets'
source = assets / 'skitter-walk-v1.png'
image = Image.open(source).convert('RGBA')
width, height = image.size
alpha = image.getchannel('A')
assert alpha.getextrema() == (0, 255), 'The sprite must have genuine transparent alpha'
frames = []
for phase in range(4):
    left, right = round(width*phase/4), round(width*(phase+1)/4)
    bounds = alpha.crop((left, 0, right, height)).point(lambda a: 255 if a > 32 else 0).getbbox()
    assert bounds and bounds[0] > 0 and bounds[2] < right-left, 'Pose crosses a cell boundary'
    x0, y0, x1, y1 = bounds
    frames.append({'frame': phase, 'species': 'skitter', 'phase': phase,
                   'rect': [left, 0, right-left, height], 'bounds': list(bounds),
                   'origin': [round((x0+x1)/2/(right-left), 6), round(y1/height, 6)]})
registration = {'file': source.name, 'generatedWith': 'built-in image_gen.imagegen',
                'width': width, 'height': height, 'columns': 4, 'rows': 1,
                'cellSize': width/4, 'displaySize': 56, 'baseFacing': -1, 'frames': frames}
(assets / 'skitter-walk-v1.json').write_text(json.dumps(registration, indent=2)+'\n')
target = source.with_suffix('.webp')
image.save(target, 'WEBP', quality=90, method=6, exact=True)
assert ImageChops.difference(alpha, Image.open(target).convert('RGBA').getchannel('A')).getbbox() is None
print(json.dumps({'source': source.name, 'size': image.size, 'webBytes': target.stat().st_size,
                  'alphaExact': True, 'displaySize': 56, 'frames': len(frames)}))
