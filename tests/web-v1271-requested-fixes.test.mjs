import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root=path.resolve(import.meta.dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const app=read('app.js');
const html=read('小手机.html');
const pixelAssets=read('games/pixel-home/assets.js');
const theater=read('cohab-theater.js');

function functionSource(source,name){
  const start=source.indexOf('function '+name+'(');
  assert.ok(start>=0,'missing '+name);
  let depth=0,quote='',escape=false,seen=false;
  for(let i=start;i<source.length;i++){
    const ch=source[i];
    if(quote){if(escape)escape=false;else if(ch==='\\')escape=true;else if(ch===quote)quote='';continue;}
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='{'){depth++;seen=true;}else if(ch==='}'&&seen&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error('unterminated '+name);
}

test('cloud passport renders an IndexedDB avatar through the shared lazy hydrator',()=>{
  const source=functionSource(app,'tvPassportView');
  const context=vm.createContext({
    S:{me:{name:'我',avatar:'idb:avatar-key'},travel:{stamps:[]}},
    tvInit:()=>({passport:{}}),esc:value=>String(value??''),
    isStoredImgRef:value=>String(value||'').startsWith('idb:'),_imgCache:{},_avIc:()=>'<i>user</i>',
  });
  vm.runInContext(functionSource(app,'tvPassportPhoto')+';'+source+';globalThis.output=tvPassportView();',context);
  assert.match(context.output,/data-idb-avatar="avatar-key"/);
  assert.doesNotMatch(context.output,/<img src=""/);
});

test('small notebook add and edit use an in-app editor instead of blocked native prompt',()=>{
  for(const name of ['spyAddLifeNote','spyEditLifeNote'])assert.doesNotMatch(functionSource(app,name),/\bprompt\s*\(/);
  assert.match(functionSource(app,'spyLifeNoteEditor'),/openModal\(/);
  assert.match(app,/function spySaveLifeNote\(/);
  assert.match(app,/id="spy_life_note_edit"/);
});

test('web pixel girl reads the small catalog and individual images, never the embedded 24 MB script',()=>{
  assert.match(pixelAssets,/location\.protocol!==['"]file:['"][\s\S]*fetch\(/);
  assert.match(pixelAssets,/wardrobe\/catalog\.json/);
  assert.match(pixelAssets,/new URL\(['"]wardrobe\//);
  const webBranch=pixelAssets.slice(pixelAssets.indexOf('async function loadCatalog'),pixelAssets.indexOf('function createCanvas'));
  assert.doesNotMatch(webBranch,/location\.protocol!==['"]file:['"][\s\S]{0,240}loadScript\(['"]wardrobe\/data\.js/);
  assert.match(webBranch,/location\.protocol===['"]file:['"][\s\S]*loadScript\(['"]wardrobe\/data\.js/);
});

test('Apple home-screen web app colors the system status lane without covering unlocked pages',()=>{
  const apply=functionSource(app,'applyAppleHomeCompat');
  const sync=functionSource(app,'webStatusBarThemeSync');
  assert.match(apply,/north-ios-standalone-status/);
  assert.match(sync,/appleHomeCompatBrowserEnvironment\(\)[\s\S]*black/);
  assert.match(html,/html\.north-ios-standalone-status\{background-color:var\(--north-shell-status-color,#000\)\}/);
  assert.doesNotMatch(html,/north-ios-standalone-status::before/);
  assert.doesNotMatch(html,/north-ios-standalone-status[^}]*position:fixed/);
  assert.doesNotMatch(html,/north-ios-standalone-status[^}]*height:100dvh/);
});

test('user moments guarantee a lover like plus real comment and cap role reply exchanges',()=>{
  const source=functionSource(app,'reactToMyMoment');
  assert.match(source,/momentContactIsLover\(c\)/);
  assert.match(source,/momentEnsureRoleLike/);
  assert.match(source,/momentRequestRoleReaction/);
  assert.match(app,/function momentRunRoleExchange\(/);
  assert.match(app,/Math\.min\(2,/);
  assert.match(app,/replyToName/);
  assert.match(functionSource(app,'momentCommentLine'),/@/);
});

test('multiplayer theater offers two independent WeChat guest slots and never forces an unchecked guest',()=>{
  assert.match(theater,/guest2/);
  assert.match(theater,/ct_wechat_enabled/);
  assert.match(theater,/suffix=kind==='guest2'\?'2':''/);
  assert.match(theater,/ct_guest\$\{suffix\}_id/);
  assert.match(theater,/最多两名微信来客/);
  const save=functionSource(theater,'cohabTheaterSave');
  assert.match(save,/ct_wechat_enabled/);
  assert.match(save,/if\(!wechatEnabled\)/);
  assert.doesNotMatch(save,/else\{const gid=value\('ct_guest_id'\),guest=getC\(gid\);if\(guest/);
});
