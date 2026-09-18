import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// 用户的三个诉求：关掉共同生活之后角色仍然记得一起发生过的事；共同生活记忆不要被硬上限吃掉、
// 可以自己清理；以及微信那个「清理」按钮点了没反应。
// 核查发现：cohabWechatPrompt 整段在共同生活关闭/暂停时都不进提示词，旧记忆和现场原文绑在一起
// 一并消失；共同生活记忆硬编码上限 60；而 pruneSummaries 只在超过上限时才删，且自动清理一关就
// 直接 return，手动按钮完全空转。5 星本来就永不删除，只是从没写给用户看。

const WEB = new URL('../app.js', import.meta.url);
const PRIVATE = new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js', import.meta.url);
const read = u => fs.readFileSync(u, 'utf8').replace(/\r\n/g, '\n');
const one = (src, name) => {
  const f = src.split('\n').find(l => l.startsWith(`function ${name}(`) || l.startsWith(`async function ${name}(`));
  assert.ok(f, `missing ${name}`);
  return f;
};
const BUILDS = [['web', read(WEB)], ['private', read(PRIVATE)]];

test('关掉共同生活之后，一起生活过的记忆仍然进提示词', () => {
  for (const [label, src] of BUILDS) {
    assert.match(src, /if\(_cohabLive\)s\+=cohabWechatPrompt\(c,_cohabLive\);else s\+=cohabMemoryAfterPrompt\(c\);/, `${label}: 关闭分支要接上记忆`);
    const ctx = {
      String, Object, Array, Math, Number,
      S: { cohabitation: { homes: { r1: { summaries: [{ text: '一起煮了面', imp: 4 }], settings: {} } } } },
      msgs: () => [{ role: 'user', content: '面' }],
      msgToText: m => m.content,
      cohabWechatState: () => null,
      cohabMemoryPrompt: () => '\n\n# 共同生活已经自动整理的旧记忆（角色第一人称）\n· 4星｜一起煮了面',
      cohabContextLimit: () => 30,
    };
    vm.runInNewContext(one(src, 'cohabMemoryAfterPrompt') + '\nglobalThis.f=cohabMemoryAfterPrompt;', ctx);
    const out = ctx.f({ id: 'r1' });
    assert.match(out, /你们一起生活过的那段时间留下的记忆/, `${label}: 改成往事的说法`);
    assert.match(out, /一起煮了面/, `${label}: 记忆内容要在`);
    assert.match(out, /不要说成此刻正在一起/, `${label}: 但不能装作还在同居`);
    // 共同生活仍然开着时不重复输出
    ctx.cohabWechatState = () => ({});
    vm.runInNewContext(one(src, 'cohabMemoryAfterPrompt') + '\nglobalThis.g=cohabMemoryAfterPrompt;', ctx);
    assert.equal(ctx.g({ id: 'r1' }), '', `${label}: 开着的时候不该重复`);
    // 没有记忆就什么都不加
    ctx.cohabWechatState = () => null;
    ctx.S.cohabitation.homes.r1.summaries = [];
    assert.equal(ctx.f({ id: 'r2' }), '');
  }
});

test('共同生活记忆上限可调，0 表示不限', () => {
  for (const [label, src] of BUILDS) {
    assert.match(src, /x\.memoryCap=x\.memoryCap===0\?0:Math\.max\(20,Math\.min\(2000,Math\.round\(\+x\.memoryCap\|\|200\)\)\)/, `${label}: 设置带上限`);
    assert.match(src, /cohabMemoryPrune\(d,cohabMemoryCap\(d\)\)/, `${label}: 裁剪按设置走`);
    assert.doesNotMatch(src, /cohabMemoryPrune\(d,60\)/, `${label}: 不能再写死 60`);
    assert.match(src, /记忆上限<small>共存多少条，0 表示不限<\/small>/, `${label}: 设置页要有这一格`);
    const ctx = { Math, Number, String };
    vm.runInNewContext(one(src, 'cohabMemoryPrune') + '\nglobalThis.p=cohabMemoryPrune;', ctx);
    const rows = Array.from({ length: 10 }, (_, i) => ({ text: 't' + i, imp: 1 }));
    ctx.p({ summaries: rows }, 0);
    assert.equal(rows.length, 10, `${label}: 0 表示不限，一条都不该删`);
    ctx.p({ summaries: rows }, 5);
    assert.equal(rows.length, 5, `${label}: 给了上限就按上限裁`);
  }
});

test('清理低星是主动动作，而且 5 星绝对不删', () => {
  for (const [label, src] of BUILDS) {
    const ctx = { Array, Math, Number };
    vm.runInNewContext(one(src, 'memoryPruneLowStars') + '\nglobalThis.f=memoryPruneLowStars;', ctx);
    const rows = [{ imp: 1 }, { imp: 2 }, { imp: 3 }, { imp: 4 }, { imp: 5 }, {}];
    assert.equal(ctx.f(rows, 2), 2, `${label}: 只清 1、2 星`);
    assert.deepEqual(rows.map(x => x.imp), [3, 4, 5, undefined], `${label}: 没打星的按 3 星算，阈值 2 时保留`);
    const all = [{ imp: 5 }, { imp: 5 }];
    assert.equal(ctx.f(all, 4), 0, `${label}: 全是 5 星时一条都不动`);
    assert.deepEqual(all.map(x => x.imp), [5, 5]);
    assert.equal(ctx.f(null, 3), 0);
  }
});

test('微信那个清理按钮不再空转', () => {
  for (const [label, src] of BUILDS) {
    const prune = one(src, 'pruneSummaries');
    assert.match(prune, /function pruneSummaries\(c,aid,opt\)/, `${label}: 要能被强制`);
    assert.match(prune, /S\.settings\.memAutoClean===false&&!\(opt&&opt\.force\)\)return;/, `${label}: 手动点击不受自动清理开关影响`);
    assert.match(src, /pruneSummaries\(cc,null,\{force:true\}\)/, `${label}: 面板按钮要传 force`);
    assert.match(src, /wechatMemoryPruneLowStars\('\$\{id\}',2\)/, `${label}: 微信面板要有清理低星`);
    assert.match(src, /cohabMemoryPruneLowStars\(this\.dataset\.cid,2\)/, `${label}: 共同生活面板也要有`);
    // 规则要写给用户看
    assert.match(src, /自动清理只在条数超过上限时才动手/, `${label}: 说明要讲真话`);
    assert.match(src, /5星永远保留/, `${label}: 5 星规则要写明`);
  }
});
