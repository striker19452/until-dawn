"""Register generated puppy poses; keep source and exact transparent alpha."""
import json
from pathlib import Path
from PIL import Image, ImageChops

assets = Path(__file__).resolve().parents[1] / 'client/assets'
image = Image.open(assets / 'puppy-v1.png').convert('RGBA')
width, height = image.size
alpha = image.getchannel('A')
assert alpha.getextrema() == (0, 255)
frames = []
for i in range(16):
    col, row = i % 4, i // 4
    x, y = round(width*col/4), round(height*row/4)
    w, h = round(width*(col+1)/4)-x, round(height*(row+1)/4)-y
    bounds = alpha.crop((x, y, x+w, y+h)).point(lambda a: 255 if a > 64 else 0).getbbox()
    assert bounds
    frames.append({'rect': [x, y, w, h], 'bounds': list(bounds),
                   'origin': [round((bounds[0]+bounds[2])/2/w, 6), round(bounds[3]/h, 6)]})
# A single scale across poses keeps the puppy's head/body size consistent.
scale = 43 / max(f['bounds'][2]-f['bounds'][0] for f in frames[:4])
for frame in frames:
    frame['renderScale'] = scale
registration = {'file': 'puppy-v1.png', 'generatedWith': 'built-in image_gen.imagegen',
                'width': width, 'height': height, 'columns': 4, 'rows': 4, 'frames': frames}
(assets / 'puppy-v1.json').write_text(json.dumps(registration, indent=2)+'\n')
image.save(assets / 'puppy-v1.webp', 'WEBP', quality=90, method=6, exact=True)
assert ImageChops.difference(alpha, Image.open(assets / 'puppy-v1.webp').getchannel('A')).getbbox() is None
print(f'Registered 16 puppy poses, scale {scale:.4f}; WebP alpha preserved')
