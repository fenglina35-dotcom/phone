import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// CLEAR_ALL_KEEP_STUDIO_V1 (2026-10-22, her report): after 设置 → 一键清空所有数据, 「我的形象工作室与衣柜」 did nothing.
// The clear rebuilt S.me without the account list, and the user's studio lives on the active account, so the button found
// no account. Role studios were also dropped because imageStudio was not in the kept contact fields.
function fn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  assert(i >= 0, name);
  let d = 0, k = src.indexOf('{', i);
  for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
  return src.slice(i, k + 1);
}
const studio = (img) => ({ enabled: true, faceMode: 'hidden', appearancePrompt: '短发', identityRefs: [{ id: 'f1', angle: 'front', image: img, note: '' }], identityNote: '', outfits: [{ id: 'o1', name: '睡衣', occasion: 'home', image: 'idb:coat', note: '', enabled: true }] });
for (const file of ['app.js', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js']) {
  const s = fs.readFileSync(file, 'utf8');
  const load = (active) => {
    const ctx = {
      S: {
        me: { name: '北', wxid: 'wx_n', avatar: 'a', active, balance: 3, bills: [{ x: 1 }],
          accounts: [
            { id: 'main', name: '北', wxid: 'wx_n', avatar: 'a', persona: '我', balance: 3, bills: [{ x: 1 }], imageStudio: studio('idb:me') },
            { id: 'acc_b', name: '小号', wxid: 'wx_b', avatar: 'b', balance: 9, bills: [{ y: 1 }], imageStudio: studio('idb:alt') },
          ] },
        settings: { k: 1 },
        contacts: [{ id: 'r1', name: '先生', imageStudio: studio('idb:him'), grudges: [{ text: '事' }] }],
      },
      _bootImagesPromise: null, _heavy: {}, _heavyReady: new Set(), _userImageStudioProxies: new WeakMap(),
      uiConfirm: async () => true,
      defState: () => ({ me: { name: '我', wxid: 'wx_new', avatar: '🐱', balance: 520, bills: [] }, settings: {}, contacts: [] }),
      beautyPackFrom: () => ({}), mergeBeautyPack: () => {}, clearPhoneFriendChatsKeepPeople: x => x, clearMusicChatsKeepLibrary: x => x,
      imgDel: async () => {}, save: () => {}, imgGC: () => {}, closeModal: () => {}, home: () => {}, render: () => {}, toast: () => {},
      genWxid: () => 'wx_gen', syncBlocks: () => {}, go: (...a) => { ctx.went = a; },
    };
    vm.createContext(ctx);
    vm.runInContext(['actId', 'accountIdOK', 'normalizeAccount', 'initAccounts', 'userImageStudioContact', 'userImageStudioOpen', 'clearAllData'].map(n => (n === 'clearAllData' ? 'async ' : '') + fn(s, n)).join('\n'), ctx);
    return ctx;
  };
  test(file + ': after 一键清空所有数据 my image studio still opens with my photos and wardrobe', async () => {
    const ctx = load('main');
    await ctx.clearAllData();
    ctx.userImageStudioOpen();
    assert(ctx.went && ctx.went[0] === 'roleImageStudio', 'the button opens the studio right after clearing');
    const me = vm.runInContext('userImageStudioContact(false)', ctx);
    assert(me && me.imageStudio, 'my studio is kept');
    assert.equal(me.imageStudio.identityRefs[0].image, 'idb:me');
    assert.equal(me.imageStudio.outfits.length, 1);
    assert.equal(ctx.S.contacts[0].imageStudio.identityRefs[0].image, 'idb:him', 'his studio is kept too');
    assert.equal(ctx.S.contacts[0].grudges, undefined, 'records are still cleared');
    const main = ctx.S.me.accounts.find(a => a.id === 'main');
    assert.equal(main.bills.length, 0, 'bills are still cleared');
  });
  test(file + ': a 小号 that was active stays active with its own studio', async () => {
    const ctx = load('acc_b');
    await ctx.clearAllData();
    assert.equal(ctx.S.me.active, 'acc_b');
    const me = vm.runInContext('userImageStudioContact(false)', ctx);
    assert.equal(me.imageStudio.identityRefs[0].image, 'idb:alt');
    assert.equal(ctx.S.me.accounts.find(a => a.id === 'acc_b').bills.length, 0);
  });
}
