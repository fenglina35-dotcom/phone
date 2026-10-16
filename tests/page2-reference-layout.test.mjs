import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'glass-theme.css'),'utf8');

function sourceOf(name){
  const start=app.indexOf(`function ${name}(`);
  assert.ok(start>=0,`${name} must exist`);
  let brace=app.indexOf('{',start),depth=0,quote='',template=false,escape=false;
  for(let i=brace;i<app.length;i++){
    const ch=app[i];
    if(escape){escape=false;continue;}
    if(quote){if(ch==='\\'){escape=true;continue;}if(ch===quote){quote='';template=false;}continue;}
    if(ch==='\''||ch==='"'||ch==='`'){quote=ch;template=ch==='`';continue;}
    if(ch==='{')depth++;
    if(ch==='}'&&--depth===0)return app.slice(start,i+1);
  }
  throw new Error(`${name} source is incomplete`);
}

test('page one reference layout and dock stay untouched',()=>{
  assert.match(app,/const first=\['w:dashboard','douyin','wechat','cinema','x','w:vinyl','w:sweetie','worldbook','phoneapp','music','spy'\]/);
  assert.match(css,/\.glass-reference-page>\.glass-place-dashboard\{left:16px!important;right:auto!important;top:8px!important/);
  assert.match(css,/\.glass-reference-page>\.glass-place-sweetie\{left:16px!important;right:auto!important;top:365px!important/);
  assert.match(app,/const HOME_DOCK_DEFAULT=\['calendar','games','mail','settings'\]/);
});

test('page two has twelve unique app positions without duplicating a stored app',()=>{
  assert.match(app,/const HOME_SHORTCUTS=\{clock:\{[^}]*t:'日历'/);
  assert.match(app,/_glassSecondPageLayoutV1/);
  assert.match(app,/H=\[first,rest\.slice\(0,12\),rest\.slice\(12\)\]/);
  assert.match(app,/reserved=new Set\(first\.concat\(dock\)\)/);
  const page=sourceOf('homeSecondPageHtml');
  assert.match(page,/homeSecondPortraitHtml\(\)\+homeSecondPhotosHtml\(\)/);
  assert.match(page,/glass-second-slot-'\+i\+'/);
  for(let i=0;i<12;i++)assert.match(css,new RegExp(`glass-second-slot-${i}`));
});

test('photo components are fixed presentation layers and never enter drag persistence',()=>{
  assert.doesNotMatch(sourceOf('homeSecondPortraitHtml'),/data-token=/);
  assert.doesNotMatch(sourceOf('homeSecondPhotosHtml'),/data-token=/);
  assert.match(sourceOf('homeSecondPortraitHtml'),/glass-second-avatar-picker[^]*homeSecondPick\('portrait',0\)/);
  assert.match(sourceOf('homeSecondPhotosHtml'),/homeSecondPick\('photo',\$\{i\}\)/);
  assert.match(sourceOf('homeSecondPhotosHtml'),/aria-label="更换第 \$\{i\+1\} 张照片"/);
  assert.match(sourceOf('homeLayoutReadDom'),/\.map\(el=>el\.dataset\.token\)\.filter\(Boolean\)/);
  assert.match(sourceOf('appLiveReorder'),/glass-second-page[^]*length>=12\)return/);
  assert.match(sourceOf('appLiveReorder'),/homeSecondSlotsRefresh/);
});

test('second page geometry follows the requested top, photo, two-row stack',()=>{
  assert.match(css,/\.glass-second-portrait\{left:calc\(50% \+ 6px\);right:16px;top:8px;height:176px/);
  assert.match(css,/\.glass-second-avatar-picker\{[^}]*width:84px[^}]*height:84px[^}]*border-radius:50%/);
  assert.match(css,/\.glass-second-portrait-copy b\{[^}]*15px/);
  assert.match(css,/\.second-page-text-input\{[^}]*font-size:16px!important/);
  assert.match(css,/\.glass-second-photos\{left:16px;right:16px;top:195px;height:150px/);
  assert.match(css,/glass-second-slot-4[^}]*top:359px!important/);
  assert.match(css,/glass-second-slot-8[^}]*top:451px!important/);
  assert.match(css,/\.glass-second-polaroid\{[^}]*width:37%[^}]*height:112px/);
  assert.match(css,/\.glass-second-polaroid\.p1\{[^}]*left:1\.5%[^}]*top:0[^}]*rotate\(-7deg\)[^}]*box-shadow/);
  assert.match(css,/\.glass-second-polaroid\.p2\{[^}]*z-index:3[^}]*left:30\.5%[^}]*top:7px[^}]*rotate\(2deg\)[^}]*box-shadow/);
  assert.match(css,/\.glass-second-polaroid\.p3\{[^}]*right:1\.5%[^}]*top:3px[^}]*rotate\(6deg\)[^}]*box-shadow/);
});

test('all glass packs reuse identical geometry and only recolor the cards',()=>{
  for(const pack of ['pink','blue','gray'])assert.match(css,new RegExp(`north-pack-${pack} \\.glass-second-portrait`));
  for(const pack of ['pink','blue','gray'])assert.match(css,new RegExp(`north-pack-${pack} \\.glass-second-portrait-copy[^\\{]*\\{[^}]*background:linear-gradient`));
  assert.match(css,/north-pack-pink \.glass-second-portrait-copy[^\{]*\{[^}]*color:#71344f/);
  assert.match(css,/north-pack-blue \.glass-second-portrait-copy\{[^}]*color:#304c72/);
  assert.match(css,/north-pack-gray \.glass-second-portrait-copy[^\{]*\{[^}]*color:#3f444e/);
  assert.doesNotMatch(css,/north-pack-black \.glass-second-portrait-copy/);
  assert.match(css,/\.home\.twhite \.glass-second-portrait/);
  assert.match(css,/\.home\.tpink \.glass-second-portrait/);
  assert.match(css,/\.home\.glass-widget-custom \.glass-second-portrait/);
  assert.match(app,/homeSecondPage','glassWidgetAppearances/);
});
