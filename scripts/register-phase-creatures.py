"""Register the generated atlas using visible alpha, ignoring faint edge noise.

Run with Pillow installed. The source PNG is retained; only the runtime WebP
and registration are derived. Animation uses the yard's procedural stride.
"""
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1] / 'client/assets/phase-creatures-v1'
source = Image.open(root / 'atlas.png').convert('RGBA')
cell = source.width // 2
frames = []
for row, species in enumerate(['bladebeast', 'shellcrab', 'sporetoad', 'echomantis']):
    x, y = row % 2 * cell, row // 2 * cell
    alpha = source.crop((x, y, x + cell, y + cell)).getchannel('A')
    bounds = alpha.point(lambda value: 255 if value >= 32 else 0).getbbox()
    left, top, right, bottom = bounds
    for phase in range(4):
        frames.append(dict(frame=row * 4 + phase, species=species, phase=phase,
                           rect=[x, y, cell, cell], bounds=list(bounds),
                           origin=[(left + right) / 2 / cell, bottom / cell],
                           renderScale=(79 if species == 'echomantis' else 68) / (bottom - top)))
source.save(root / 'atlas.webp', quality=88, method=6)
registration = dict(file='atlas.webp', generatedWith='built-in image_gen.imagegen',
                    width=source.width, height=source.height, baseFacing=1,
                    cellSize=cell, frames=frames)
(root / 'registration.json').write_text(json.dumps(registration, ensure_ascii=False, indent=2) + '\n')
