"""Register the four isolated walking poses and preserve transparent alpha."""
import json
from pathlib import Path
from PIL import Image, ImageChops

assets = Path(__file__).resolve().parents[1] / 'client/assets'
source = assets / 'puppy-walk-v2.png'
image = Image.open(source).convert('RGBA')
width, height = image.size
alpha = image.getchannel('A')
assert alpha.getextrema() == (0, 255)
frames = []
for i in range(4):
    col, row = i % 2, i // 2
    x, y = round(width*col/2), round(height*row/2)
    w, h = round(width*(col+1)/2)-x, round(height*(row+1)/2)-y
    bounds = alpha.crop((x, y, x+w, y+h)).point(lambda a: 255 if a > 64 else 0).getbbox()
    assert bounds and bounds[0] > 0 and bounds[1] > 0 and bounds[2] < w and bounds[3] < h
    # Align the face across frames; changes in the tail and feet should not
    # shift the entire body horizontally. Keep the lowest paw on the ground.
    frames.append({'rect': [x, y, w, h], 'bounds': list(bounds),
                   'origin': [round((bounds[2]-220)/w, 6), round(bounds[3]/h, 6)]})
scale = 43 / max(f['bounds'][2]-f['bounds'][0] for f in frames)
for frame in frames:
    frame['renderScale'] = scale
registration = {'file': source.name, 'generatedWith': 'built-in image_gen.imagegen',
                'width': width, 'height': height, 'columns': 2, 'rows': 2, 'frames': frames}
(assets / 'puppy-walk-v2.json').write_text(json.dumps(registration, indent=2)+'\n')
image.save(source.with_suffix('.webp'), 'WEBP', quality=90, method=6, exact=True)
assert ImageChops.difference(alpha, Image.open(source.with_suffix('.webp')).getchannel('A')).getbbox() is None
print(f'Registered 4 walking poses, scale {scale:.4f}; WebP alpha preserved')
