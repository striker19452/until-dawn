"""Small original procedural effects; no downloaded or licensed recordings."""
import math, random, struct, wave
from pathlib import Path
out=Path(__file__).resolve().parents[1]/'client/assets'
out.mkdir(exist_ok=True)
rng=random.Random(417)
rate=22050
for name,duration in [('fire',2.0),('wood',.18),('bell',.48)]:
    values=[]
    last=0
    for i in range(int(rate*duration)):
        t=i/rate
        if name=='fire':
            last=.94*last+.06*rng.uniform(-1,1)
            value=last*.7+rng.uniform(-1,1)*.12*(1 if rng.random()<.035 else .1)
        elif name=='wood':
            value=(math.sin(t*2*math.pi*185)*.55+rng.uniform(-1,1)*.4)*math.exp(-t*36)
        else:
            value=(math.sin(t*2*math.pi*880)*.4+math.sin(t*2*math.pi*1320)*.12)*math.exp(-t*9)
        fade=min(1,t/.01,(duration-t)/.02)
        values.append(struct.pack('<h',int(max(-1,min(1,value*fade)) * 18000)))
    with wave.open(str(out/(name+'.wav')),'wb') as f:
        f.setnchannels(1);f.setsampwidth(2);f.setframerate(rate);f.writeframes(b''.join(values))
print('Original fire, wood and bell effects generated.')
