import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// PHOTO_ALBUM_IMAGE_RETRY_V1 (2026-10-30, her screenshot 「照片暂时无法显示」, later it showed again): a stored photo that was
// not in the image cache yet was given the address 「idb:…」, the browser failed it, and onerror hid it for good. A failed
// photo is now read again once from storage before the failure text is shown.
function fn(src, name, isAsync) {
  const i = src.indexOf((isAsync ? 'async ' : '') + 'function ' + name + '(');
  assert(i >= 0, name);
  let d = 0, k = src.indexOf('{', i);
  for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
  return src.slice(i, k + 1);
}
const fakeImg = (data) => { const note = { hidden: true }; return { dataset: Object.assign({}, data), hidden: false, isConnected: true, src: '', nextElementSibling: note, note }; };
for (const file of ['photo-album.js', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/photo-album.js']) {
  const s = fs.readFileSync(file, 'utf8');
  const load = (store) => {
    const ctx = { _imgCache: {}, _photoAlbumUrls: new Map(), Blob, URL: { createObjectURL: () => 'blob:new', revokeObjectURL: () => {} }, isStoredImgRef: v => typeof v === 'string' && v.startsWith('idb:'), imgGet: async k => store[k] ?? null };
    vm.createContext(ctx); vm.runInContext(fn(s, 'photoAlbumImageRetry', true), ctx); return ctx;
  };
  test(file + ': a role photo not cached yet is read again and shown', async () => {
    const ctx = load({ p1: 'data:image/jpeg;base64,AAAA' }), img = fakeImg({ storedSrc: 'idb:p1' });
    await ctx.photoAlbumImageRetry(img);
    assert.equal(img.src, 'data:image/jpeg;base64,AAAA'); assert.equal(img.hidden, false); assert.equal(img.note.hidden, true);
  });
  test(file + ': an album original is read again from storage', async () => {
    const ctx = load({ __album_photo_1: new Blob(['x']) }), img = fakeImg({ albumRef: '__album_photo_1' });
    await ctx.photoAlbumImageRetry(img);
    assert.equal(img.src, 'blob:new'); assert.equal(img.hidden, false);
  });
  test(file + ': a photo that is really missing shows the failure text after one try', async () => {
    const ctx = load({}), img = fakeImg({ storedSrc: 'idb:gone' });
    await ctx.photoAlbumImageRetry(img); assert.equal(img.hidden, true); assert.equal(img.note.hidden, false);
    await ctx.photoAlbumImageRetry(img); assert.equal(img.hidden, true, 'no endless retry');
    assert(s.includes('onerror="photoAlbumImageRetry(this)"'));
  });
}

const {read:albumRead,fnSource:albumFn,PRIV_DIR:albumPrivate}=await import('./_helpers.mjs');
for(const file of ['photo-album.js',albumPrivate+'photo-album.js']){
 const source=albumRead(file);
 function commentFixture(){const c={id:'role',name:'甲'},old={roleId:'role',text:'原留言',time:1},row={id:'photo',roleComment:old,desc:'一只猫',visionState:'success'},cp={cid:c.id},state={couple:cp,me:{active:'main'},settings:{chat:{base:'fixture',key:'fixture'}}};let calls=0,answer='新的留言',saved=true,wait=null;const ctx=vm.createContext({S:state,Date,Promise,String,photoAlbumCoupleAllowed:()=>true,photoAlbumRoleRows:()=>[row],photoAlbumEnsureVision:async()=>true,cur:()=>({p:'home'}),photoAlbumCommentRefresh(){},photoAlbumRoleLike:async()=>{},saveNowAsync:async()=>saved,save(){},toast(){},chatAPI:async()=>{calls++;if(wait)await wait;return answer;}});vm.runInContext('const _photoAlbumCommentActive=new WeakSet();'+albumFn(source,'photoAlbumGenerateComment'),ctx);return{ctx,c,row,old,calls:()=>calls,answer:v=>answer=v,saved:v=>saved=v,wait:v=>wait=v};}
 test(file+': regeneration replaces only the chosen comment after success',async()=>{const f=commentFixture();await f.ctx.photoAlbumGenerateComment(f.row,f.c,true);assert.equal(f.row.roleComment.text,'新的留言');assert.equal(f.calls(),1);});
 test(file+': failed generation or persistence retains the original comment',async()=>{for(const mode of ['empty','save']){const f=commentFixture();if(mode==='empty')f.answer('');else f.saved(false);await f.ctx.photoAlbumGenerateComment(f.row,f.c,true);assert.equal(f.row.roleComment,f.old);}});
 test(file+': repeated clicks share one generation and permission changes discard its result',async()=>{const f=commentFixture();let release;f.wait(new Promise(r=>release=r));const work=f.ctx.photoAlbumGenerateComment(f.row,f.c,true);await Promise.resolve();await f.ctx.photoAlbumGenerateComment(f.row,f.c,true);f.ctx.S.couple.albumAuthEpoch=1;release();await work;assert.equal(f.row.roleComment,f.old);assert.ok(f.calls()<=1);});
}
