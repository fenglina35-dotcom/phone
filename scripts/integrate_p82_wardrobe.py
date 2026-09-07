"""Port approved P82 artwork into the existing role-backed game, not its demo adapter."""
from pathlib import Path
import json,re,shutil,base64,subprocess
R=Path(__file__).resolve().parents[1];P=R/'preview/rose-doll-p01';G=R/'games/pixel-home';W=G/'wardrobe'
W.mkdir(exist_ok=True)
def original(rel):return subprocess.check_output(['git','show','HEAD:'+rel],cwd=R).decode('utf-8')
def fn(s,name):
 m=re.search(r'^  (?:async )?function '+name+r'\(',s,re.M);assert m,name
 end=s.index('\n',m.start());line=s[m.start():end]
 if line.rstrip().endswith('}') and line.count('{')==line.count('}'):return line
 end=s.index('\n  }',end)+4
 return s[m.start():end]
def replace_fn(s,name,body):return s.replace(fn(s,name),body)

catalog=json.loads((P/'wardrobe-p82/catalog.json').read_text('utf-8'))
approved=json.loads(Path('C:/Users/pc/Downloads/我的衣柜-配置-P82.json').read_text('utf-8'))
assert approved['state']['version']==catalog['version']
(W/'approved-config.json').write_text(json.dumps(approved,ensure_ascii=False,indent=2),'utf-8')
(W/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2),'utf-8')
shutil.copytree(P/'wardrobe-p82/assets',W/'assets',dirs_exist_ok=True)
images={name:'data:image/png;base64,'+base64.b64encode((W/name).read_bytes()).decode() for name in catalog['files']}
(W/'data.js').write_text('window.PixelWardrobeData='+json.dumps({'catalog':catalog,'images':images,'approved':approved['state']},ensure_ascii=False,separators=(',',':'))+';','utf-8')
engine=(P/'wardrobe-p82/engine.mjs').read_text('utf-8')
engine=re.sub(r'^export ', '',engine,flags=re.M)
engine=engine.replace("const KEY='rose-wardrobe-p82.v1';", "const KEY='pixel-wardrobe:'+String(window.RoseWardrobeScope||new URLSearchParams(location.search).get('scope')||'unbound');")
start=engine.index('async function loadCatalog(');end=engine.index('\nfunction anchor',start)
engine=engine[:start]+"async function loadCatalog(){const {catalog,images:encoded}=window.PixelWardrobeData,images={};await Promise.all(Object.entries(encoded).map(async([f,url])=>{const im=new Image();im.src=url;await im.decode();images[f]=im;}));return{catalog,images};}\n"+engine[end:]
engine=engine.replace('function fresh(c){return {','function fresh(c){if(window.PixelWardrobeData?.approved)return structuredClone(window.PixelWardrobeData.approved);return {')
(W/'engine-source.js').write_text(engine,'utf-8')
app=(P/'wardrobe-p82/app.js').read_text('utf-8');app=re.sub(r'^import[^\n]*\n','',app)
# Scope is established by the trusted room iframe; never import another account's local preview key.
app=re.sub(r"else \{const previous=migrate\(JSON.parse\(localStorage.getItem\('rose-wardrobe-p80.v1'\).*?if\(previous\)state=previous;\}", '',app)
start=app.find("else {const previous=migrate(")
if start>=0:
 end=app.index('if(previous)state=previous;}',start)+len('if(previous)state=previous;}');app=app[:start]+app[end:]
app=app.replace("notify('已保存');return true", "parent.postMessage({type:'pixel-wardrobe-saved'},location.protocol==='file:'?'*':location.origin);notify('已保存');return true")
app+="\ndocument.querySelector('.home').onclick=e=>{e.preventDefault();save();parent.postMessage({type:'pixel-wardrobe-close'},location.protocol==='file:'?'*':location.origin);};\n"
(W/'app.js').write_text('(async()=>{\n'+engine+'\n'+app+'\n})();','utf-8')
host="""
window.roseWardrobeReady=loadCatalog().then(({catalog,images})=>{
 let state=valid(window.RoseWardrobeInitial,catalog)?structuredClone(window.RoseWardrobeInitial):fresh(catalog);
 function refresh(){try{const n=JSON.parse(localStorage.getItem(KEY));if(valid(n,catalog))state=n;}catch{}}
 try{localStorage.setItem(KEY,JSON.stringify(state));}catch{}
 window.addEventListener('storage',e=>{if(e.key===KEY)refresh()});
 window.RoseWardrobe={catalog,refresh,getState:()=>structuredClone(state),
 draw(g,x,y,h,opts={}){g.save();const z=h/1536;g.imageSmoothingEnabled=false;g.translate(Math.round(x-512*z),Math.round(y));g.scale(z,z);render(g,catalog,images,opts.portrait?{...state,body:{size:100,legs:100,legWidth:100}}:state,{frame:opts.closed?'closed':opts.still?'open':blink(performance.now()+600),time:performance.now(),animate:!opts.still&&!matchMedia('(prefers-reduced-motion: reduce)').matches});g.restore();},
 setBody(k,v){if(!['size','legs','legWidth'].includes(k))return;const min=k==='legs'?55:60,max=k==='size'?150:k==='legs'?110:140;state.body={...bodyParams(state),[k]:Math.max(min,Math.min(max,Number(v)||100))};},
 saveBody(){try{localStorage.setItem(KEY,JSON.stringify(state));window.dispatchEvent(new Event('wardrobe-saved'));return true;}catch{return false;}},
 applyLook(look){const o=catalog.outfits.find(x=>x.dress===(look===1?'outfit5-dress':'outfit4-dress'));if(o){Object.assign(state,{dress:o.dress,shoes:o.shoes,accessory:o.accessory});this.saveBody();}}
 };
});
"""
(W/'host.js').write_text('(()=>{\n'+engine+'\n'+host+'\n})();','utf-8')
html=(P/'wardrobe-p82/index.html').read_text('utf-8').replace('我的衣柜 · P82','我的衣柜 · v1204').replace('type="module" src="app.js"','src="app.js?v=1204"').replace('<script src="app.js?v=1204">','<script src="data.js?v=1204"></script><script src="app.js?v=1204">')
(W/'index.html').write_text(html,'utf-8');shutil.copy2(P/'wardrobe-p82/style.css',W/'style.css')

game=original('games/pixel-home/game.js');preview=(P/'game-p82.js').read_text('utf-8')
for name in ['dollMetrics','drawDoll','drawBackground','draw','drawMirror']:
 game=replace_fn(game,name,fn(preview,name))
game=game.replace('  function drawBackground()', '  function sceneCamera(){}\n  function drawBackground()')
game=game.replace('const state=restore();state.look=initial.morning.look;', 'const state=restore();state.look=initial.morning.look;if(initial.morning.day)state.wardrobeDay=initial.morning.day;window.RoseWardrobeScope=initial.scope;window.RoseWardrobeInitial=initial.state?.wardrobe;')
game=game.replace('function save(){try{', 'function save(){try{if(window.RoseWardrobe)state.wardrobe=window.RoseWardrobe.getState();')
game=game.replace("function openPanel(name){if(!ready)return;", "function openPanel(name){if(!ready)return;if(name==='wardrobe'||name==='vanity'){cancelCare(false);cancelPointers();save();const panel=$('#wardrobe-overlay');panel.hidden=false;$('#wardrobe-frame').src='wardrobe/index.html?scope='+encodeURIComponent(initial.scope);return;}")
game=game.replace("if(state.look!==info.look){state.look=info.look;save();}", "if(info.day&&state.wardrobeDay!==info.day){state.look=info.look;state.wardrobeDay=info.day;window.RoseWardrobe?.applyLook(info.look);save();}")
game=game.replace("if(Number.isFinite(d.lastAt)","base.wardrobeDay=typeof d.wardrobeDay==='string'?d.wardrobeDay:'';if(Number.isFinite(d.lastAt)")
game=game.replace("outfitNames[state.look===1?1:0]", "(window.RoseWardrobe?.catalog.items[window.RoseWardrobe.getState().dress]?.name||'今日穿搭')")
boot=fn(game,'boot').replace("try{for(const [key,name]", "try{await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='wardrobe/host.js?v=1204';s.onload=resolve;s.onerror=reject;document.head.append(s);});await window.roseWardrobeReady;for(const [key,name]")
boot=boot.replace("sleepAll:'sleep-all.png'", "sleepP80:'sleep-overlay-p80.png',sleepFootboard:'sleep-footboard-p77.png'")
game=replace_fn(game,'boot',boot)
controls=preview[preview.index("  const bodyPanel="):preview.index('  boot();',preview.index("  const bodyPanel="))]
extras="""
  addEventListener('wardrobe-saved',()=>{if(ready&&hostLive)save();});
  addEventListener('message',e=>{if(e.source!==$('#wardrobe-frame').contentWindow||e.origin!==(location.protocol==='file:'?'null':location.origin))return;if(!['pixel-wardrobe-saved','pixel-wardrobe-close'].includes(e.data?.type)||!hostLive)return;window.RoseWardrobe.refresh();save();if(e.data.type==='pixel-wardrobe-close'){$('#wardrobe-overlay').hidden=true;$('#wardrobe-frame').src='about:blank';}});
  $('#wardrobe-close').onclick=()=>{window.RoseWardrobe.refresh();save();$('#wardrobe-overlay').hidden=true;$('#wardrobe-frame').src='about:blank';};
"""
game=game.replace('  boot();',controls+extras+'  boot();')
(G/'game.js').write_text(game,'utf-8')
main=(P/'index.html').read_text('utf-8').replace('P82','v1204').replace('game-p82.js?v=p82-1','game.js?v=1204').replace('immersive-p82.css?v=p82-1','immersive.css?v=1204')
main=main.replace('<script src="sound.js">','<script src="bridge.js?v=1204"></script><script src="assets.js?v=1204"></script><script src="wardrobe/data.js?v=1204"></script><script src="sound.js">')
main=main.replace('<main class="phone"', '<button class="exit-home" id="exit-home" type="button" aria-label="返回游戏大厅">返回游戏大厅</button><section id="wardrobe-overlay" hidden><button id="wardrobe-close" aria-label="关闭衣柜">×</button><iframe id="wardrobe-frame" title="我的衣柜"></iframe></section><main class="phone"')
(G/'index.html').write_text(main,'utf-8')
css=(P/'immersive-p82.css').read_text('utf-8')+"\n#wardrobe-overlay{position:fixed;inset:0;z-index:150;background:#f3e9df}#wardrobe-overlay[hidden]{display:none}#wardrobe-frame{width:100%;height:100%;border:0}#wardrobe-close{position:absolute;right:6px;top:5px;z-index:2}#exit-home{position:fixed;top:max(8px,env(safe-area-inset-top));left:8px;z-index:40;font-size:11px;background:#fff5e4dd;color:#674538;border:1px solid #d6b891;border-radius:18px;padding:6px 10px}\n"
(G/'immersive.css').write_text(css,'utf-8')
for name in ['sleep-overlay-p80.png','sleep-footboard-p77.png']:
 shutil.copy2(P/'assets'/name,G/'assets'/name)
 (G/'asset-data'/f'{name}.js').write_text("window.PixelHomeLocalImage='data:image/png;base64,"+base64.b64encode((G/'assets'/name).read_bytes()).decode()+"';\n",'utf-8')
print('Integrated approved wardrobe into role-backed entry; retained role care and photo functions.')
