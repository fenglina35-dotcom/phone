import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync('app.js','utf8');
const part=app.slice(app.indexOf('/* ===== v1716 液态玻璃'));

test('v1716 liquid glass is baked once per widget and never redrawn while swiping',()=>{
  assert.ok(part.length>1000);
  assert.doesNotMatch(part,/MutationObserver|getImageData|toDataURL|requestAnimationFrame\(lgHomeRefresh/,'DOM 变化不能触发重算，也不能拍背景快照');
  assert.match(part,/sw\.addEventListener\('scroll',lgSwipe,\{passive:true\}\)/,'v1718：翻页时玻璃里的壁纸跟着实时变');
  assert.match(part,/if\(!g\|\|cv\._lgShift===shift&&cv\._lgScale===scale\)return;/,'没变的组件不重画');
  assert.match(part,/final\?1:0\.6/,'滑动中低分辨率、停下后原分辨率');
  assert.match(part,/function lgGeometry\(host,desk\)/);assert.match(part,/closest\('\.apppage'\)/,'位置按组件停好的那一页算，翻页时整页一起滑');
  assert.match(part,/_lg\.cache\.get\(key\)/,'重新渲染直接装回缓存的画布');
  assert.match(part,/webglcontextlost/);assert.match(part,/已经烤好放进组件的画布不受影响/);
  assert.match(part,/\.lg-host\.lg-ready\{backdrop-filter:none!important/,'只有装好画布的组件才去掉原来的玻璃');
});

test('v1716 settings values are clamped, zero is kept, and private shares the authorized renderer',()=>{
  const ctx={S:{me:{liquidGlass:{on:true,tone:'white',blur:0,ior:9,thick:-5,disp:'x'}}}};vm.createContext(ctx);
  vm.runInContext(part.match(/const LG_DEFAULTS=[^\n]+/)[0]+'\n'+part.match(/const LG_FIELDS=[^\n]+/)[0]+'\n'+part.match(/function lgCfg\(\)[^\n]+/)[0]+';this.lgCfg=lgCfg;',ctx);
  const cfg=ctx.lgCfg();assert.equal(cfg.blur,0);assert.equal(cfg.ior,2);assert.equal(cfg.thick,4);assert.equal(cfg.disp,0.03);assert.equal(cfg.tone,'white');
  const priv=fs.readFileSync('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js','utf8');
  assert.match(priv,/v1716 液态玻璃/,'用户本次明确要求私人版纳入网页现有材质');
  assert.equal(priv.slice(priv.indexOf('/* ===== v1716 液态玻璃')),part,'共享材质参数与实现必须一致');
});

test('v1720 iMessage bubbles and buttons use the same glass, redraw only on scroll, keep the ring recipe',()=>{
  assert.match(part,/const LG_IMSG_HOSTS='\.imsg-b:not\(\.pic\):not\(\.iminv\)/,'发出去的图片和隐形墨水不套');
  assert.match(part,/\[body,hbody\]\.forEach\(el=>\{if\(el&&!el\._lgBound\)\{el\._lgBound=true;el\.addEventListener\('scroll',lgImsgScroll,\{passive:true\}\);/,'聊天上下滚时玻璃里的背景跟着变');
  assert.match(part,/root:'\.imsg\.hasbg'/,'没换聊天背景时保持原样');
  assert.match(part,/const oy=g\.scroll\?g\.y\+g\.st-st:g\.y,/,'滚动中位置用滚动距离推算，不读布局');
  assert.match(part,/if\(g\.scroll&&\(oy\+g\.h<top-40\|\|oy>bottom\+40\)\)return;/,'只画露在屏幕上的');
  assert.match(part,/uniform vec2 uTail;/);assert.match(part,/float a=max\(clamp\(inside\+0\.5,0\.0,1\.0\),tz\);/,'尾巴那一截也铺玻璃');
  assert.match(part,/\.imsg \.lg-host\.lg-ready:before,\.offstage \.lg-host\.lg-ready:before,[^{]*\{backdrop-filter:none!important/,'细环不再整块提亮');
  assert.match(part,/_lg\.texs\.get\(g\.src\)/,'主屏和信息页各用自己的背景贴图');
});

test('v1722 offline date and cohabitation use the same glass except the background itself',()=>{
  assert.match(part,/root:'\.offstage\.hasbg:not\(\.off-classic\)'/,'只在玻璃主题且换了背景时；旧的黑色文学风不动');
  for(const sel of ['.offmsg .offbubble','.offnav','.offmeta','.cohab-meta','.cohab-settings label','.cohab-memory-open','.off-reply-top','.offinput .send','.off-field','.cohab-status-chip'])assert.ok(part.includes(sel),sel);
  assert.doesNotMatch(part.match(/const LG_OFF_HOSTS='[^']+'/)[0],/\.cohab-settings,/,'共同生活设置整块不当一块玻璃：展开后高光被拉长成白雾，里面的小方块也被盖住');
  assert.ok(part.match(/const LG_OFF_HOSTS='[^']+'/)[0].includes('.cohab-settings>summary'),'设置那一行标题自己是一块玻璃');
  assert.doesNotMatch(part.match(/const LG_OFF_HOSTS='[^']+'/)[0],/offstage,|\.offscroll|\.offnar|\binput\b|\bselect\b/,'背景、旁白文字、input/select 本身不套');
  assert.match(part,/getPropertyValue\(me\?'--offc-me':'--offc-them'\)/,'线下气泡染成外观里挑的颜色');
  assert.match(part,/if\(w>=d\.width-4\)opt\.box=\[-60,0,w\+120,h\];/,'通栏两侧不折');
  assert.match(part,/if\(cv&&cv\._lgKey===key\)return;/,'没变的不重画');
});

test('v1724 spy phone lock pad and home use the same glass, with the default gradient drawn in when no wallpaper',()=>{
  assert.match(part,/\{root:'\.spy-desktop',body:'\.spy-home-scroll,\.spy-lock-scroll',hbody:'#spyHomePages',hosts:'\.spy-glass',spy:true\}/);
  assert.match(part,/if\(!wall\)return 'lg:spy';/,'没换壁纸时用默认渐变');
  assert.match(part,/function lgDefaultWall\(src\)/);assert.match(part,/'#a9c9ce'/);
  assert.match(part,/ox=g\.hscroll\?g\.x\+g\.sl-sl:g\.x/,'左右翻页的图标横向跟着走');
  assert.match(part,/\.spy-desktop \.lg-host\.lg-ready:before\{|\.spy-desktop \.lg-host\.lg-ready:before,/,'细环不再整块提亮');
});


test('private actual glass paints pixels, reveals canvas through native fallback and preserves opt-out',async()=>{
 const {createRequire}=await import('node:module'),require=createRequire(import.meta.url),{chromium}=require('playwright'),{join,resolve}=require('node:path');
 const root=resolve('.'),browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--enable-unsafe-swiftshader']});
 try{const page=await browser.newPage({viewport:{width:390,height:844},userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 Version/18.7 Mobile/15E148 Safari/604.1'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.__SMALL_PHONE_PRIVATE__=true;window.SmallPhoneNative={request:async()=>({ok:false,error:'fixture-native-unavailable'})};});
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!=='http://127.0.0.1:8778')return route.abort();const f=join(root,decodeURIComponent(u.pathname.slice(1)));if(!f.startsWith(root)||!fs.existsSync(f))return route.fulfill({status:404,body:''});return route.fulfill({status:200,body:fs.readFileSync(f),contentType:f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.png')?'image/png':'text/html'});});
 await page.goto('http://127.0.0.1:8778/native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html?northPreview=black-home');await page.waitForFunction(()=>window.__northBootReady);
 const wall='data:image/png;base64,'+fs.readFileSync('assets/meituan-kangaroo.png').toString('base64');
 await page.evaluate(wall=>{S.me.uiMaterial='glass';S.me.homeBg=wall;S.me.liquidGlass={on:true};render();document.documentElement.classList.add('north-native-app','north-glass-ui');},wall);
 await page.waitForFunction(()=>document.querySelector('#homeDesktop canvas.lg-canvas'));
 const painted=await page.evaluate(()=>{const cv=document.querySelector('#homeDesktop canvas.lg-canvas'),host=cv.parentElement,pixels=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;return{width:cv.width,nonzero:pixels.some(v=>v>0),background:getComputedStyle(host).backgroundColor,image:getComputedStyle(host).backgroundImage,pointer:getComputedStyle(cv).pointerEvents,glFailed:_lg.failed,privateOn:privateNativeAppOn()};});
 assert(painted.width>0&&painted.nonzero);assert.equal(painted.glFailed,false);assert.equal(painted.privateOn,true);assert.equal(painted.background,'rgba(0, 0, 0, 0)');assert.equal(painted.image,'none');assert.equal(painted.pointer,'none');
 await page.evaluate(()=>{go('settings');lgOpen();});assert((await page.locator('.modal').innerText()).includes('液态玻璃'));assert.equal(await page.locator('.modal input[type=range]').count(),11);
 await page.evaluate(()=>{lgSet('on',false);closeModal();home();render();});await page.waitForFunction(()=>!document.querySelector('#homeDesktop canvas.lg-canvas'));assert.deepEqual(errors,[]);
 await page.close();}finally{await browser.close();}
});
