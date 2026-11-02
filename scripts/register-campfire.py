"""Register generated campfire layers and encode web assets; preserve source PNGs."""
import json
from pathlib import Path
from statistics import mean
from PIL import Image, ImageChops

assets=Path(__file__).resolve().parents[1]/'client/assets'
result={}
for name,columns,rows in [('campfire-base-v6',2,1),('campfire-flames-v6',2,2)]:
    image=Image.open(assets/(name+'.png')).convert('RGBA')
    source_size=image.size
    # Delivery frames remain larger than the on-screen art even at 3× DPR.
    # Keep the native PNG as the master, and avoid downloading unused detail.
    image.thumbnail((1024,1024),Image.Resampling.LANCZOS)
    width,height=image.size
    frames=[]
    for i in range(columns*rows):
        x0=round(i%columns*width/columns);x1=round((i%columns+1)*width/columns)
        y0=round(i//columns*height/rows);y1=round((i//columns+1)*height/rows)
        alpha=image.getchannel('A').crop((x0,y0,x1,y1))
        bounds=alpha.point(lambda a:255 if a>32 else 0).getbbox()
        left,top,right,bottom=bounds
        assert left>0 and top>0 and right<x1-x0 and bottom<y1-y0
        if 'base' in name:
            ox=(left+right)/2;oy=top+(bottom-top)*.6
        else:
            # Anchor the flame root, not its leaning tip or drifting embers.
            root=[x for y in range(round(bottom-(bottom-top)*.1),bottom) for x in range(left,right) if alpha.getpixel((x,y))>96]
            ox=mean(root);oy=bottom
        frames.append({'rect':[x0,y0,x1-x0,y1-y0],'bounds':list(bounds),'origin':[ox/(x1-x0),oy/(y1-y0)]})
    result[name]={'sourceSize':source_size,'width':width,'height':height,'columns':columns,'rows':rows,'frames':frames,
                  'bodyHeight':mean(f['bounds'][3]-f['bounds'][1] for f in frames)}
    target=assets/(name+'.webp');image.save(target,'WEBP',quality=88,method=6,exact=True)
    decoded=Image.open(target).convert('RGBA')
    assert decoded.size==image.size and ImageChops.difference(image.getchannel('A'),decoded.getchannel('A')).getbbox() is None
    print(name, image.size, target.stat().st_size, 'alpha exact')
(assets/'campfire-v6.json').write_text(json.dumps(result,indent=2)+'\n')
