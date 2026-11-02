"""Generate web delivery assets. Keep original art and sprite coordinates intact.
Run with a Python environment containing Pillow (bundled workspace runtime works).
"""
from pathlib import Path
from PIL import Image, ImageChops
import json

root=Path(__file__).resolve().parents[1]
names=['yard-day-hd-v4','yard-night-hd-v4','survivors-walk-a-v4','survivors-walk-b-v4','creatures-walk-a-v4','creatures-walk-b-v4','buildings-v3','props-v3','survivors-portraits-v1','paper-wasteland-v1']
report=[]
for name in names:
    source=root/'client/assets'/f'{name}.png'
    target=source.with_suffix('.webp')
    image=Image.open(source).convert('RGBA')
    if name=='paper-wasteland-v1':
        image.thumbnail((680,680),Image.Resampling.LANCZOS)
    image.save(target,'WEBP',quality=90,method=6,exact=True)
    decoded=Image.open(target).convert('RGBA')
    assert decoded.size==image.size
    assert ImageChops.difference(image.getchannel('A'),decoded.getchannel('A')).getbbox() is None, name+' alpha changed'
    report.append({'asset':name,'original':source.stat().st_size,'web':target.stat().st_size,'width':decoded.width,'height':decoded.height,'alphaExact':True})
print(json.dumps(report,indent=2))
(root/'client/assets/optimization.json').write_text(json.dumps(report,indent=2)+'\n')
print('TOTAL',sum(r['original'] for r in report),'->',sum(r['web'] for r in report))
