// SPY_ROLE_ROUTE_V1：查他手机刷新和日记用角色自己配的线路；打开「刷新用副模型」用那条线路的副模型。
// SOCIAL_NO_REFUSAL_V1：朋友圈 / X 不把模型的拒绝回答（如 I can't discuss that）当动态发出去。两版都要满足。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ROOT = process.env.FIX_TEST_ROOT || new URL('..', import.meta.url).pathname;
const FILES = {
  private: ROOT + '/native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js',
  web: ROOT + '/app.js',
};
function grab(src, name) {
  const m = src.match(new RegExp('\\n((?:async\\s+)?function\\s+' + name + '\\s*\\()'));
  if (!m) return '';
  const start = m.index + 1;
  const re = /\n(?=(?:async\s+)?function\s|let\s|const\s|\/\*|if\(|setInterval|setTimeout|document\.|window\.)/g;
  re.lastIndex = start + 1;
  const n = re.exec(src);
  return src.slice(start, n ? n.index : src.length);
}

for (const [label, file] of Object.entries(FILES)) {
  const src = fs.readFileSync(file, 'utf8');

  test(`${label}：查他手机用角色自己的线路，开关决定用不用副模型`, () => {
    const ctx = { roleChatRouteIndex: c => c.route };
    vm.createContext(ctx);
    vm.runInContext(grab(src, 'spyRouteOpt'), ctx);
    assert.deepEqual({ ...ctx.spyRouteOpt({ route: 2 }, true) }, { aux: true, routeIndex: 2, independentRoleModel: true });
    assert.deepEqual({ ...ctx.spyRouteOpt({ route: 0 }, false) }, { aux: false, routeIndex: 0, independentRoleModel: true });
    const refresh = grab(src, 'spyRefresh');
    assert.match(refresh, /_spyRoute=spyRouteOpt\(c,_spyAuxOn\)/);
    assert.match(refresh, /chatAPI\(_spyMsgs,Object\.assign\(\{max:4000,complete:true\},_spyRoute\)\)/);
    assert.match(grab(src, 'spyContinueJson'), /aux&&typeof aux==='object'\?aux:\{aux:!!aux\}/, '续写也走同一条线路');
    assert.match(grab(src, 'roleDiaryGenerateDay'), /spyRouteOpt\(c,!!\(S\.settings&&S\.settings\.spyAux\)\)/, '日记也走角色线路');
  });

  test(`${label}：朋友圈遇到拒绝回答会重写，还是拒绝就不发`, async () => {
    const mk = outs => {
      const ctx = {
        S: { me: { name: '她' } }, Set, Math,
        isRefusal: t => /i can'?t discuss/i.test(t),
        msgToText: m => m.content, msgs: () => [],
        roleTweetLifeContext: () => '', roleMomentRecentText: () => '暂无', roleSocialOpeningPrompt: () => '', roleSocialIdentityPin: () => '', buildSystem: () => '',
        roleChatRouteIndex: () => 0, cleanReply: t => t, cleanMomentText: t => t, roleMomentSimilarity: () => ({ hard: false, soft: false }),
        chatAPI: async () => outs.shift(),
      };
      vm.createContext(ctx);
      vm.runInContext(['letterNorm', 'letterGrams', 'letterSimilar', 'roleSocialPublicRule', 'roleSocialRefusal', 'roleSocialChatEcho', 'roleMomentGenerate'].map(n => grab(src, n)).join('\n'), ctx);
      return ctx;
    };
    assert.equal(await mk(["I can't discuss that", '傍晚的风很软，顺路买了一束小雏菊。']).roleMomentGenerate({ id: 'r1' }), '傍晚的风很软，顺路买了一束小雏菊。');
    assert.equal(await mk(["I can't discuss that", "I can't discuss that"]).roleMomentGenerate({ id: 'r1' }), '', '两次都拒绝就不发');
    assert.match(grab(src, 'roleTweetGenerate'), /roleSocialRefusal\(text\)/);
  });
}

// ROLE_ALBUM_SAVED_V1：他手机图库收他点过赞的和他自己用 [存共同相册] 收藏的照片；红心只给点过赞的。
for (const [label, file] of Object.entries(FILES)) {
  const albumFile = file.replace(/app\.js$/, 'photo-album.js');
  test(`${label}：他手机图库也有他收藏的照片，红心只给点过赞的`, () => {
    const src = fs.readFileSync(albumFile, 'utf8');
    const rows = [
      { id: 'liked', roleLikes: { r1: { time: 5 } } },
      { id: 'saved', savedBy: 'r1' },
      { id: 'mine', uploadedBy: 'me' },
      { id: 'other', savedBy: 'r2' },
    ];
    const ctx = { photoAlbumRows: () => rows };
    vm.createContext(ctx);
    vm.runInContext(['photoAlbumRoleLiked', 'photoAlbumRoleLikedRows'].map(n => grab(src, n)).join('\n'), ctx);
    assert.deepEqual(ctx.photoAlbumRoleLikedRows({ id: 'r1' }).map(r => r.id), ['liked', 'saved']);
    assert.equal(ctx.photoAlbumRoleLiked(rows[1], { id: 'r1' }), false, '收藏的不显示红心');
    const page = grab(src, 'renderRolePhotoAlbum');
    assert.match(page, /photoAlbumRoleLiked\(selected,c\)\?\['heart','角色已点赞'\]:null/);
    assert.match(page, /收藏和点过赞的照片/);
  });
}
