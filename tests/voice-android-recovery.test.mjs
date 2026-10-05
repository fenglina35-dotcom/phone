import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const html=readFileSync(join(root,'小手机.html'),'utf8');

function functionSource(source,name){
  const start=source.indexOf(`function ${name}`);
  assert.ok(start>=0,`missing ${name}`);
  const brace=source.indexOf('{',start);
  let depth=0,quote='',escaped=false;
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

test('Android boot guard ignores anonymous injected errors and exposes native recovery links',()=>{
  const marker='/* 安卓启动保护：资源或旧缓存出错时显示自救页，不让用户只看到黑屏。 */';
  const start=html.indexOf(marker);
  const end=html.indexOf('</script>',start);
  assert.ok(start>=0&&end>start);
  const source=html.slice(start,end);
  const listeners={};
  const app={innerHTML:''};
  const document={getElementById:id=>id==='app'?app:null};
  const location={pathname:'/phone/小手机.html',hash:'#home',replace:()=>{}};
  const window={
    __NORTH_SHELL_BUILD__:'708',
    addEventListener:(name,fn)=>{listeners[name]=fn;},
  };
  window.window=window;
  const context=vm.createContext({window,document,location,navigator:{},Promise,setTimeout:()=>0,Date});
  vm.runInContext(source,context);

  listeners.error({message:'Script error.',filename:'',target:window});
  assert.equal(app.innerHTML,'');
  listeners.error({message:'图片加载失败',filename:'',target:{tagName:'IMG',src:'/icon.png'}});
  assert.equal(app.innerHTML,'');

  listeners.error({message:'Unexpected token',filename:'https://example.test/phone/app.js?v=754',target:window});
  assert.match(app.innerHTML,/<a class="bootbtn" href="\/phone\/小手机\.html\?reload=/);
  assert.match(app.innerHTML,/<a class="bootbtn secondary" href="\/phone\/repair\.html\?from=boot&v=708&t=/);
  assert.doesNotMatch(app.innerHTML,/onclick=/);
});

test('boot recovery controls remain tappable in Android webviews',()=>{
  assert.match(html,/\.bootbtn\{[^}]*display:block[^}]*touch-action:manipulation/);
  assert.match(html,/function ownBootError\(e\)/);
  const version=html.match(/__NORTH_SHELL_BUILD__='(\d+)'/)?.[1];
  assert.ok(version);
  assert.match(html,new RegExp(`^<script src="app\\.js\\?v=${version}(?:&[^"]*)?"`,'m'));
});
