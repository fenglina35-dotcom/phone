import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const html=readFileSync(join(root,'小手机.html'),'utf8');
const app=readFileSync(join(root,'app.js'),'utf8');

function bootGuardSource(){
  const marker='/* 安卓启动保护：资源或旧缓存出错时显示自救页，不让用户只看到黑屏。 */';
  const start=html.indexOf(marker),end=html.indexOf('</script>',start);
  assert.ok(start>=0&&end>start,'missing Android boot guard');
  return html.slice(start+marker.length,end);
}

test('the 12 second Android watchdog reports progress without replacing the app',()=>{
  const timers=new Map(),listeners={},message={textContent:''};
  const host={_html:'',querySelector:sel=>sel==='.bootmsg'?message:null,set innerHTML(v){this._html=v;},get innerHTML(){return this._html;}};
  const window={__NORTH_SHELL_BUILD__:'1102',addEventListener:(type,fn)=>{listeners[type]=fn;}};
  const context=vm.createContext({window,document:{getElementById:id=>id==='app'?host:null},location:{pathname:'/小手机.html',hash:''},setTimeout:(fn,ms)=>{timers.set(ms,fn);return ms;},String,Date});
  vm.runInContext(bootGuardSource(),context);
  timers.get(12000)();
  assert.match(message.textContent,/网络较慢/);
  assert.equal(host.innerHTML,'');
  window.__northBootStarted=true;
  timers.get(12000)();
  assert.match(message.textContent,/存档较大/);
  assert.equal(host.innerHTML,'');
  timers.get(60000)();
  assert.match(host.innerHTML,/小手机没有正常启动/);
  assert.match(host.innerHTML,/不会删除聊天、角色或密钥/);
});

test('real critical script errors still fail immediately',()=>{
  const listeners={},host={innerHTML:'',querySelector:()=>null};
  const window={addEventListener:(type,fn)=>{listeners[type]=fn;}};
  const context=vm.createContext({window,document:{getElementById:id=>id==='app'?host:null},location:{pathname:'/小手机.html',hash:''},setTimeout:()=>0,String,Date});
  vm.runInContext(bootGuardSource(),context);
  listeners.error({message:'app.js syntax error',filename:'http://local/app.js',target:window});
  assert.match(host.innerHTML,/小手机没有正常启动/);
  assert.match(host.innerHTML,/浏览器内核过旧或脚本没有完整加载/);
});

test('Android uses visible image hydration while desktop web keeps full hydration',()=>{
  assert.match(app,/function lazyStoredImagesOn\(\)\{return privateNativeAppOn\(\)\|\|NORTH_ANDROID;\}/);
  assert.match(app,/const lazy=lazyStoredImagesOn\(\),keys=lazy\?privateBootImageKeys\(\):imageRefKeys\(S\)/);
  assert.match(app,/if\(!lazy\)_rehydrate\(S\)/);
  assert.match(app,/function scheduleVisibleStoredImages\(force,alreadyHydrated\)\{if\(!lazyStoredImagesOn\(\)\)return;/);
});
