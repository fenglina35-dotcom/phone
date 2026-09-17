import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// 用户报告：角色锁软件不受角色控制。他只是威胁「再不睡觉就把抖音锁掉」，抖音就真锁了；
// 说「明天解开」，现在就解开了；而且会重复锁一个已经锁着的 App，像不知道它已经锁着。
// 排查：锁/解锁并非角色自己的标签说了算——小手机会再调一次模型当「指令解析器」，
// 把角色那句话解析成 {"lock":[...],"unlock":[...]}，解析器填什么就执行什么。
// 解析器此前只知道「可操作的 App 有哪些」，既不知道谁已经锁着，也没有任何时间/条件概念。
// 用户选了 B 方案：保留自然说话，但把解析器修明白，并给外置路径补上幂等判断。

const WEB = new URL('../app.js', import.meta.url);
const PRIVATE = new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js', import.meta.url);
const read = u => fs.readFileSync(u, 'utf8').replace(/\r\n/g, '\n');
const one = (src, name) => {
  const found = src.split('\n').find(l => l.startsWith(`function ${name}(`) || l.startsWith(`async function ${name}(`));
  assert.ok(found, `missing ${name}`);
  return found;
};
const BUILDS = [['web', read(WEB)], ['private', read(PRIVATE)]];

test('解析器拿得到当前锁定状态', () => {
  for (const [label, src] of BUILDS) {
    assert.match(src, /availableNames\.join\('、'\)\+companionControlLedgerForParser\(\)/, `${label}: 台账要接进提示词`);
    const ctx = {
      String, Object, Array,
      LOCKABLE: { game: '游戏', video: '视频' },
      S: { couple: { grant: { game: true, video: true }, locks: { game: { pwd: '1234' } } } },
      companionState: () => ({ apps: [{ name: '抖音', locked: true }, { name: '小红书', locked: false }] }),
    };
    vm.runInNewContext(one(src, 'companionControlLedgerForParser') + '\nglobalThis.l=companionControlLedgerForParser;', ctx);
    const out = ctx.l();
    assert.match(out, /抖音：当前已锁/, `${label}: 外置已锁要写出来`);
    assert.match(out, /小红书：当前可用/, `${label}: 外置可用也要写出来`);
    assert.match(out, /游戏：当前已锁/, `${label}: 内置已锁要写出来`);
    assert.match(out, /视频：当前可用/, `${label}: 内置可用要写出来`);
    // 没有任何可控 App 时不要塞一段空标题进提示词
    ctx.companionState = () => ({ apps: [] });
    ctx.S.couple.grant = {};
    assert.equal(ctx.l(), '');
  }
});

test('提示词明确不认威胁、未来时、陈述现状和空操作', () => {
  for (const [label, src] of BUILDS) {
    for (const phrase of [
      '条件或威胁', '再不睡就把X锁掉', '未来或延后', '明天给你解开',
      '只是在陈述现状', '抖音还锁着呢', '目标已经是那个状态',
      '只有"已经给你锁了""现在就给你解开"这种当下已成事实的说法才填进数组',
    ]) assert.ok(src.includes(phrase), `${label}: 提示词缺少「${phrase}」`);
  }
});

test('外置路径不再重复下发同一个状态', () => {
  for (const [label, src] of BUILDS) {
    const ctx = { String, Date, Boolean };
    vm.runInNewContext(one(src, 'companionExternalAlreadyInState') + '\nglobalThis.f=companionExternalAlreadyInState;', ctx);
    const st = {};
    // 已经锁着，再锁一次没有意义
    assert.equal(ctx.f(st, { locked: true }, 'lock'), true);
    assert.equal(ctx.f(st, { locked: true }, 'unlock'), false, '锁着的可以解');
    assert.equal(ctx.f(st, { locked: false }, 'unlock'), true);
    assert.equal(ctx.f(st, { locked: false }, 'lock'), false, '可用的可以锁');
    // 设备只回报了 reportedLocked 也算数
    assert.equal(ctx.f(st, { reportedLocked: true }, 'lock'), true);
    // 命令还在路上时按「期望状态」判断，避免等回执期间重复下发
    ctx.companionExternalCommandState = () => ({ kind: 'pendingLock' });
    vm.runInNewContext(one(src, 'companionExternalAlreadyInState') + '\nglobalThis.g=companionExternalAlreadyInState;', ctx);
    assert.equal(ctx.g(st, { locked: false }, 'lock'), true, '锁定命令已在路上，不要再发一次');
    assert.equal(ctx.g(st, { locked: false }, 'unlock'), false, '但可以改主意去解锁');
    // 其他动作一概不拦
    assert.equal(ctx.f(st, { locked: true }, 'limit'), false);
    assert.equal(ctx.f(st, null, 'lock'), false);
    assert.match(src, /if\(opt\.by==='role'&&companionExternalAlreadyInState\(st,app,action\)\)continue;/, `${label}: 派发前要过滤`);
  }
});

test('用户自己解锁时，角色的话不再被模板顶替', () => {
  for (const [label, src] of BUILDS) {
    const guard = one(src, 'manualUnlockReplyNeedsRepair');
    assert.match(guard, /return'silent'/, `${label}: 什么都没说仍然要兜底`);
    assert.match(guard, /return'perspective'/, `${label}: 人称写错仍然要兜底`);
    assert.doesNotMatch(guard, /manualUnlockReplyRepeated\([^)]*\)\)return'repeat'/, `${label}: 重复不该再被模板顶替`);
    // 事件框架：这是关系事件，不是设备读数汇报
    assert.match(src, /这不是设备读数汇报/, `${label}: 要改掉快照汇报的框架`);
    assert.match(src, /可以生气、追问、心软、调侃、再锁回去、也可以算了，全由你决定/, `${label}: 要把决定权交回角色`);
    // 兜底文案不再像收据
    assert.doesNotMatch(src, /我看到你刚刚解锁「/, `${label}: 收据式文案要去掉`);
    assert.doesNotMatch(src, /这次我收到了/, `${label}: 收据式文案要去掉`);
  }
});
