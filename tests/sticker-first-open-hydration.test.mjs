import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const bundled=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js',import.meta.url),'utf8').replace(/\r\n/g,'\n');

function functionSource(name){
  const asyncStart=source.indexOf(`async function ${name}(`),plainStart=source.indexOf(`function ${name}(`),start=asyncStart>=0?asyncStart:plainStart;
  assert.ok(start>=0,`missing ${name}`);
  const brace=source.indexOf('{',start);let depth=0,quote='',escaped=false;
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

const reads=[];
const context=vm.createContext({
  String,Set,Object,Promise,
  _imgCache:{},_imgRev:new Map(),_imgReady:new Set(),_visibleImageMisses:new Map([['sticker-1',{count:2}]]),
  isStoredImgRef:value=>String(value||'').startsWith('idb:'),
  imgMany:async keys=>{reads.push([...keys]);return {'sticker-1':'data:image/png;base64,READY'};},
  hydrateStoredImageNodes:()=>{},privateTrimImageMemoryCache:()=>{},
});
vm.runInContext(`${functionSource('warmStickerImages')}\nglobalThis.warm=warmStickerImages;`,context);
assert.equal(await context.warm([{img:'idb:sticker-1'}]),true);
assert.deepEqual(reads,[['sticker-1']]);
assert.equal(context._imgCache['sticker-1'],'data:image/png;base64,READY');
assert.equal(context._visibleImageMisses.size,0,'a direct first-open retry must bypass stale generic backoff');

const imageContext=vm.createContext({
  String,_imgCache:{},IDB_IMAGE_PLACEHOLDER:'data:image/gif;base64,PLACEHOLDER',
  isStoredImgRef:value=>String(value||'').startsWith('idb:'),stickerAttr:value=>String(value),
});
vm.runInContext(`${functionSource('stickerImageHTML')}\nglobalThis.image=stickerImageHTML;`,imageContext);
const html=imageContext.image('idb:sticker-1');
assert.match(html,/src="data:image\/gif;base64,PLACEHOLDER"/);
assert.match(html,/data-idb-src="sticker-1"/);
assert.doesNotMatch(html,/src="idb:/,'the browser must never receive an idb reference as an image URL');

for(const name of ['emojiPanel','pfPanelHTML','pfGroupPanelHTML','groupEmojiPanelHTML','aiStkManager']){
  assert.match(functionSource(name),/stickerImageHTML/);
}
assert.match(functionSource('aiStkManager'),/await warmStickerImages/,'the role sticker manager must finish its exact local read before first paint');
assert.match(functionSource('chatPanelSetPage'),/warmStickerImages/,'opening the normal emoji pane must trigger an exact first-open read');
for(const name of [
  'warmStickerImages','stickerImageHTML','emojiPanel','pfPanelHTML',
  'pfGroupPanelHTML','groupEmojiPanelHTML','aiStkManager','chatPanelSetPage',
]){
  assert.ok(bundled.includes(functionSource(name)),`private bundle sticker function differs: ${name}`);
}

console.log('sticker first-open hydration tests passed');
