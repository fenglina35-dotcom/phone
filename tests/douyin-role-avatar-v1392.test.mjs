import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// v1392 角色的抖音头像可以单独换（c.dyAvatar），微信头像不变；作品、评论、私信、粉丝里存的旧头像按角色现在的抖音头像显示。
for (const [label, path] of [['web', '../app.js'], ['private', '../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js']]) {
  const app = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
  test(label + ': douyin shows the role\'s own douyin avatar everywhere, falling back to wechat', () => {
    const line = app.split('\n').find(l => l.startsWith('function dyRA('));
    const contacts = [{ id: 'c1', avatar: 'wx.png', dyAvatar: 'dy.png' }, { id: 'c2', avatar: 'wx2.png' }];
    const ctx = { getC: id => contacts.find(c => c.id === id) || null };
    vm.runInNewContext(line + ';globalThis.f=dyRA;', ctx);
    assert.equal(ctx.f('c1', 'old.png'), 'dy.png');
    assert.equal(ctx.f('c2', 'old.png'), 'wx2.png', 'no douyin avatar: the current wechat one');
    assert.equal(ctx.f('', 'stranger.png'), 'stranger.png', 'strangers keep their own');
    assert.equal(ctx.f('me', 'mine.png'), 'mine.png');
    for (const k of ['v', 'cm', 'd', 'x']) assert.ok(app.includes(`dyFace(dyRA(${k}.cid,${k}.avatar),'sm')`), k);
    assert.doesNotMatch(app, /dyFace\((?:v|cm|d|x)\.avatar,'sm'\)/);
    assert.match(app, /if\(c\)return c\.dyAvatar\|\|c\.avatar;\}return m\.avatar\|\|'';\}/, 'douyin group members');
    assert.match(app, /onclick="dyRoleAvatarMenu\('\$\{p\.cid\}'\)"/);
    assert.match(app, /function dyRoleAvatarPick\(cid\)\{pickFile\('image\/\*',async f=>\{const c=getC\(cid\);if\(!c\)return;try\{c\.dyAvatar=await compress\(f,300,\.8\);/);
    assert.match(app, /function dyRoleAvatarReset\(cid\)\{const c=getC\(cid\);if\(!c\)return;delete c\.dyAvatar;/);
  });
}
