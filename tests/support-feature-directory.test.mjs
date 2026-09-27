import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
function knowledge(prefix = '') {
  const source = fs.readFileSync(new URL(prefix + 'wechat-me.js', root), 'utf8');
  const context = vm.createContext({});
  vm.runInContext(source.slice(source.indexOf('const WX_HELP='), source.indexOf('function wxSupportRisk')) +
    '\nglobalThis.help=WX_HELP;globalThis.match=wxSupportMatch;', context);
  return {source, ...context};
}
for (const prefix of ['', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/']) {
  test(`${prefix || 'web'}: reported sticker question gives actual configuration paths`, () => {
    const {match} = knowledge(prefix);
    const hit = match('表情包在哪设置');
    assert.ok(hit, 'reported question must be answerable locally without a model');
    assert.match(hit.answer, /设置 → 聊天与媒体 → 角色的表情包/);
    assert.match(hit.answer, /笑脸/);
    assert.match(hit.answer, /开发中/);
  });
  test(`${prefix || 'web'}: recent changes have specific answers, not generic API/phone help`, () => {
    const {match} = knowledge(prefix);
    for (const [question, expected] of [
      ['电话频率在哪里调', /聊天与主动.*电话频率/],
      ['不让角色发表情包怎么设置', /不让角色发表情包/],
      ['怎么把表情包分组给不同角色', /常用表情包分区/],
      ['布置任务在哪里关', /情侣空间.*默认关闭/],
      ['回复长度在哪里改', /网络连接.*4096/],
      ['温度设置是什么', /网络连接.*已有/],
      ['共同生活气泡颜色在哪里改', /共同生活.*美化/],
      ['自己的表情包怎么上传', /笑脸.*添加/],
      ['空调温度设置在哪里', /HomeKit.*私人 App/],
      ['小黑屋在哪里', /情侣空间[\s\S]*游戏大厅/],
      ['真人好友在哪里加', /通讯录 → 小手机好友/],
    ]) assert.match(match(question)?.answer || '', expected, question);
    assert.equal(match('量子传送装置在哪里配置'), null);
  });
  test(`${prefix || 'web'}: every home app and settings category has a browseable path`, () => {
    const {help} = knowledge(prefix);
    const app = fs.readFileSync(new URL(prefix + 'app.js', root), 'utf8');
    const apps = app.match(/const APPDEFS=\{([\s\S]*?)\nconst APPRUN=/)[1];
    for (const [, label] of apps.matchAll(/\bt:'([^']+)'/g)) {
      assert.ok(help.some(x => x.path?.includes(label)), `missing home app ${label}`);
    }
    const categories = app.match(/const SETTINGS_CATEGORIES=\{([\s\S]*?)\n\};/)[1];
    for (const [, label] of categories.matchAll(/\btitle:'([^']+)'/g)) {
      assert.ok(help.some(x => x.path?.includes('设置 → ' + label)), `missing settings category ${label}`);
    }
    const games = app.match(/const GAMES=(\[[\s\S]*?\n\]);/)[1];
    for (const [, label] of games.matchAll(/\bn:'([^']+)'/g)) assert.ok(help.some(x => x.path?.endsWith('游戏大厅 → ' + label)), `missing game ${label}`);
    assert.equal(new Set(help.map(x => x.title)).size, help.length);
    for (const x of help) {
      assert.ok(x.category && x.path && x.scope && x.answer, x.title);
      assert.ok(x.aliases.length, x.title);
    }
  });
}
