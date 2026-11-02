"""Read original PNG alpha only; write frame rectangles/anchors, never edit images."""
import json, struct, zlib
from pathlib import Path

def alpha_rows(path):
    data = path.read_bytes(); pos = 8; packed = bytearray()
    while pos < len(data):
        length = struct.unpack('>I', data[pos:pos+4])[0]
        kind = data[pos+4:pos+8]; chunk = data[pos+8:pos+8+length]; pos += 12+length
        if kind == b'IHDR':
            width, height, depth, color, _, _, interlace = struct.unpack('>IIBBBBB', chunk)
            assert (depth,color,interlace) == (8,6,0)
        if kind == b'IDAT': packed.extend(chunk)
    raw = zlib.decompress(packed); stride = width*4; previous = bytearray(stride); rows = []; offset = 0
    def paeth(a,b,c):
        p=a+b-c; ds=[abs(p-a),abs(p-b),abs(p-c)]; return [a,b,c][ds.index(min(ds))]
    for _ in range(height):
        filt = raw[offset]; offset += 1; row=bytearray(raw[offset:offset+stride]); offset += stride
        for i in range(stride):
            a=row[i-4] if i>=4 else 0; b=previous[i]; c=previous[i-4] if i>=4 else 0
            predict = 0 if filt==0 else a if filt==1 else b if filt==2 else (a+b)//2 if filt==3 else paeth(a,b,c)
            row[i]=(row[i]+predict)&255
        rows.append(row[3::4]); previous=row
    return width,height,rows

sheets=[]
for name, people in [('a',['hero','lin','zhou','chen']),('b',['xu','yuan','meng','visitor'])]:
    file=f'survivors-walk-{name}-v4.png'; width,height,rows=alpha_rows(Path('client/assets')/file)
    cuts=[0]
    for i in range(1,4):
        nominal=round(i*height/4)
        # Select a real low-alpha gutter, including feet that extend a few pixels
        # beyond the mathematically equal row. Keep all source pixels untouched.
        cuts.append(min(range(nominal-12,nominal+13),key=lambda y:(sum(a>32 for a in rows[y]),abs(y-nominal))))
    cuts.append(height); frames=[]
    for row, person in enumerate(people):
        for col in range(4):
            x0=round(col*width/4); x1=round((col+1)*width/4); y0=cuts[row]; y1=cuts[row+1]
            ink=[(x,y) for y in range(y0,y1) for x in range(x0,x1) if rows[y][x]>32]
            xmin=min(x for x,y in ink); xmax=max(x for x,y in ink); ymin=min(y for x,y in ink); ymax=max(y for x,y in ink)
            head=[x for x,y in ink if y<ymin+(ymax-ymin)*.24]
            anchor=sum(head)/len(head)
            frames.append({'frame':row*4+col,'person':person,'phase':col,'rect':[x0,y0,x1-x0,y1-y0],
                'bounds':[xmin-x0,ymin-y0,xmax-x0,ymax-y0],
                'origin':[round((anchor-x0)/(x1-x0),6),round((ymax-y0+1)/(y1-y0),6)]})
    sheets.append({'file':file,'width':width,'height':height,'cellSize':width/4,'rowCuts':cuts,'frames':frames})
output={'note':'Original pixels unchanged. Rows follow actual transparent gutters. Per-frame head/foot anchors remove painted registration drift. Constant scale per sheet.', 'sheets':sheets}
Path('client/assets/survivors-walk-v4.json').write_text(json.dumps(output,indent=2)+'\n')
for sheet in sheets: print(sheet['file'],sheet['rowCuts'])
