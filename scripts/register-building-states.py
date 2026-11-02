"""Package generated RGBA sprites; originals are copied byte-for-byte first."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import hashlib
import json
import shutil

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / '.local/building-states-v8'
ASSETS = ROOT / 'client/assets'
items = json.loads((SOURCE / 'generated.json').read_text())
original = json.loads((ASSETS / 'structures-v5.json').read_text())['buildings-v3']
types = ['garden', 'water', 'workshop', 'generator', 'infirmary', 'watchtower', 'stove', 'exchange']
assert len(items) == 16 and len({(i['type'], i['state']) for i in items}) == 16
atlas = Image.new('RGBA', (1024, 1024))
registration = {'version': 8, 'width': 1024, 'height': 1024, 'frames': {}}
proof = []
for index, item in enumerate(items):
    name = item['type'] + '-' + item['state']
    source = Path(item['path'])
    destination = ASSETS / 'building-states-v8' / (name + '.png')
    destination.parent.mkdir(exist_ok=True)
    shutil.copy2(source, destination)
    image = Image.open(destination).convert('RGBA')
    assert image.getextrema()[3] == (0, 255), name + ' must preserve transparent RGBA'
    # A low-alpha extraction fringe must not define the ground registration.
    box = image.getchannel('A').point(lambda a: 255 if a > 16 else 0).getbbox()
    crop = image.crop(box)
    crop.thumbnail((236, 236), Image.Resampling.LANCZOS)
    cell = Image.new('RGBA', (256, 256))
    cell.alpha_composite(crop, ((256 - crop.width) // 2, 246 - crop.height))
    bounds = cell.getchannel('A').point(lambda a: 255 if a > 16 else 0).getbbox()
    x, y = (index % 4) * 256, (index // 4) * 256
    atlas.alpha_composite(cell, (x, y))
    ref = original['frames'][types.index(item['type'])]
    # Retain the installed facility's footprint; loose pieces may spread 10%.
    scale_width = ref['rect'][2] * (bounds[2] - bounds[0]) / ((ref['bounds'][2] - ref['bounds'][0]) * 1.1)
    digest = hashlib.sha256(cell.tobytes()).hexdigest()
    registration['frames'][name] = {'rect': [x, y, 256, 256], 'bounds': list(bounds), 'origin': [(bounds[0] + bounds[2]) / 512, bounds[3] / 256], 'scaleWidth': scale_width, 'type': item['type'], 'state': item['state'], 'sha256': digest}
    proof.append({'name': name, 'sourceSize': image.size, 'sourceBounds': box, 'alphaPreserved': True, 'sha256': digest})
assert len({i['sha256'] for i in proof}) == 16, 'Every damage and ruin sprite must be independent'
atlas.save(ASSETS / 'building-states-v8.png')
atlas.save(ASSETS / 'building-states-v8.webp', quality=88, method=6, exact=True)
(ASSETS / 'building-states-v8.json').write_text(json.dumps(registration, ensure_ascii=False, indent=2) + '\n')
(SOURCE / 'asset-validation.json').write_text(json.dumps({'sprites': proof, 'runtimeBytes': (ASSETS / 'building-states-v8.webp').stat().st_size}, indent=2) + '\n')
print(json.dumps({'frames': len(proof), 'unique': len({i['sha256'] for i in proof}), 'runtimeBytes': (ASSETS / 'building-states-v8.webp').stat().st_size}))
