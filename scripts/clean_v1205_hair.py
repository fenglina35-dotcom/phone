"""User-approved local alpha cleanup. No resize, repaint, or regeneration."""
from pathlib import Path
from collections import deque
import subprocess, io, json, hashlib, base64
import numpy as np
from PIL import Image
R=Path(__file__).resolve().parents[1]; W=R/'games/pixel-home/wardrobe'; Q=R/'.qa/v1205'; Q.mkdir(parents=True,exist_ok=True)
report={}
for name in ['hair0-front','hair6-front']:
    rel=f'games/pixel-home/wardrobe/assets/{name}.png'
    old=subprocess.check_output(['git','show','856930ce:'+rel],cwd=R)
    im=Image.open(io.BytesIO(old)).convert('RGBA'); a=np.array(im); rgb=a[:,:,:3].astype(int)
    h,w=a.shape[:2]; alpha=a[:,:,3]; pale=(rgb.min(2)>140)&((rgb.max(2)-rgb.min(2))<75)&(alpha>0)
    # Keep the original light hair ties. These are intentional, not matte residue.
    protected=np.zeros((h,w),bool)
    if name=='hair0-front':
        protected[207:221,33:54]=True; protected[207:221,240:265]=True
    pale &= ~protected
    # Only remove pale components connected to transparency, including narrow gaps.
    reachable=alpha==0; q=deque(zip(*np.where(reachable)))
    while q:
        y,x=q.popleft()
        for dy,dx in [(0,1),(0,-1),(1,0),(-1,0)]:
            ny,nx=y+dy,x+dx
            if 0<=ny<h and 0<=nx<w and pale[ny,nx] and not reachable[ny,nx]:
                reachable[ny,nx]=True; q.append((ny,nx))
    # Some matte islands are enclosed by a one-pixel dark outline. Include only
    # pale pixels inside a narrow, measured edge corridor, not interior shine.
    near=alpha==0
    for _ in range(6 if name=='hair0-front' else 18):
        pad=np.pad(near,1,constant_values=True)
        near=near|pad[:-2,1:-1]|pad[2:,1:-1]|pad[1:-1,:-2]|pad[1:-1,2:]
    mask=(reachable|near)&pale; out=a.copy(); out[mask,3]=0
    assert np.array_equal(out[:,:,:3],a[:,:,:3])
    assert np.array_equal(out[protected],a[protected])
    Image.fromarray(out).save(W/'assets'/f'{name}.png')
    (Q/f'{name}-before.png').write_bytes(old)
    # A comparison for inspection; the deployed file retains the original canvas.
    compare=Image.new('RGB',(w*2,h),(43,52,47))
    compare.paste(im,(0,0),im); clean=Image.fromarray(out); compare.paste(clean,(w,0),clean)
    compare.save(Q/f'{name}-comparison.png')
    report[name]={'size':[w,h],'alphaPixelsRemoved':int(mask.sum()),'rgbUnchanged':True,'hairTiesUnchanged':True}
catalog=json.loads((W/'catalog.json').read_text('utf-8'))
previous=json.loads(subprocess.check_output(['git','show','856930ce:games/pixel-home/wardrobe/catalog.json'],cwd=R))['files']
for name in ['hair0-front','hair6-front']:
    key=f'assets/{name}.png'; catalog['files'][key]=hashlib.sha256((W/key).read_bytes()).hexdigest()
# Accept the prior export only when all its hashes match that complete old manifest.
catalog['compatibleAssetHashes']=[previous]
(W/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n','utf-8')
approved=json.loads((W/'approved-config.json').read_text('utf-8'))['state']
images={k:'data:image/png;base64,'+base64.b64encode((W/k).read_bytes()).decode() for k in catalog['files']}
(W/'data.js').write_text('window.PixelWardrobeData='+json.dumps({'catalog':catalog,'images':images,'approved':approved},ensure_ascii=False,separators=(',',':'))+';','utf-8')
(Q/'hair-cleanup.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),'utf-8')
print(json.dumps(report))
