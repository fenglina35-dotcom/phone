// 2026-10-30 她报的三处，两版都要满足：
// JAIL_CHOICE_HISTORY_V1：小黑屋选完选项，答案当成她说的话进记录，角色不再复述选项。
// BIRTHDAY_ONLINE_V1：她生日当天，情侣角色不看主动消息开关、9 点前也检查、忙也照样祝福，打开 App 就发一次。
// SPY_PARSE_LENIENT_V1：查他手机刷新时放宽读取，被截断时用上已写完的部分，失败说清原因并留下原话。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ROOT = process.env.FIX_TEST_ROOT || new URL('..', import.meta.url).pathname;
const FILES = {
  private: ROOT + '/native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js',
  web: ROOT + '/app.js',
};

// 从「function 名字(」取到下一个顶层定义（函数大多一行写完；多行的取到下一行顶格的 function）
function grab(src, name) {
  const m = src.match(new RegExp('\\n((?:async\\s+)?function\\s+' + name + '\\s*\\()'));
  if (!m) return '';
  const start = m.index + 1;
  const re = /\n(?=(?:async\s+)?function\s|let\s|const\s|\/\*|if\(|setInterval|setTimeout|document\.|window\.)/g;
  re.lastIndex = start + 1;
  const n = re.exec(src);
  return src.slice(start, n ? n.index : src.length);
}

function run(src, names, ctx) {
  vm.createContext(ctx);
  vm.runInContext(names.map(n => grab(src, n)).join('\n'), ctx);
  return ctx;
}

for (const [label, file] of Object.entries(FILES)) {
  const src = fs.readFileSync(file, 'utf8');

  test(`${label}：小黑屋点了选项，答案进对话记录，提示不再写出选项原文`, () => {
    let note = '';
    const S = { me: { name: '她' }, jail: { active: true, choice: { q: '你错在哪', opts: ['不该晚回', '不该撒谎'] }, msgs: [], optRounds: 0 } };
    const ctx = run(src, ['jailEchoKey', 'jailChoose'], {
      S, _jailBusy: false, uid: () => 'id1', save() {}, jailRender() {}, jailBump() {}, jailAI: n => { note = n; },
    });
    ctx.jailChoose(1);
    const last = S.jail.msgs[S.jail.msgs.length - 1];
    assert.ok(last && last.who === 'me' && last.text === '不该撒谎', '她点的答案要当成她说的话存进记录');
    assert.equal(last.choiceQ, '你错在哪', '记录里带上题目');
    assert.ok(!note.includes('不该撒谎'), '给角色的提示里不再写出选项原文');
  });

  test(`${label}：小黑屋角色开头复述选项的那句会被去掉`, () => {
    const block = src.slice(src.indexOf('{const _jopt=S.jail._lastOpt;'), src.indexOf('await jailReveal(items);', src.indexOf('{const _jopt=S.jail._lastOpt;')));
    assert.ok(block.length > 20, '要有去掉复述的处理');
    const S = { jail: { _lastOpt: '不该撒谎' } };
    const items = [{ text: '你选了「不该撒谎」。' }, { text: '那你说说，以后怎么做？' }];
    const ctx = run(src, ['jailEchoKey'], { S, items });
    vm.runInContext(block, ctx);
    assert.deepEqual(ctx.items.map(x => x.text), ['那你说说，以后怎么做？']);
    // 全部都是复述时不清空，至少留一句
    const only = { S: { jail: { _lastOpt: 'A' } }, items: [{ text: 'A' }] };
    const c2 = run(src, ['jailEchoKey'], only);
    vm.runInContext(block, c2);
    assert.equal(c2.items.length, 1);
  });

  test(`${label}：她生日当天情侣角色没开主动消息也会来祝福`, () => {
    const delivered = [];
    const today = '2026-10-30';
    const S = { me: { birthday: '1999-10-30' }, couple: { cid: 'r1', anniversaries: [] }, contacts: [{ id: 'r1', proactive: { enabled: false } }, { id: 'r2', proactive: { enabled: false } }] };
    const ctx = run(src, ['birthdayNorm', 'birthdayIsToday', 'holidayCareImportant', 'holidayCareWindow', 'birthdayCareTick'], {
      S, calendarDeliver: key => { delivered.push(key); return true; }, holidayCare() {}, birthdayCare() {},
    });
    ctx.birthdayCareTick(today, new Date(2026, 9, 30, 8, 0), {});
    assert.deepEqual(delivered, ['bday_me_r1'], '情侣角色要来；没开主动消息的普通角色照旧不打扰');
  });

  test(`${label}：生日检查排在早上 9 点的限制前面，切回前台也会检查`, () => {
    const body = grab(src, 'checkCalendar');
    const b = body.indexOf('birthdayCareTick(today,now,F)'), h = body.indexOf('if(h<9)return;');
    assert.ok(b > 0 && h > 0 && b < h, '生日要在 9 点限制之前检查');
    assert.match(src, /visibilitychange',\(\)=>\{if\(!document\.hidden\)setTimeout\((\(\)=>northNativeBackgroundTask\('calendar',checkCalendar\)|checkCalendar),1500\)/, '切回前台要检查');
  });

  test(`${label}：角色在忙也照样发生日祝福`, () => {
    const ctx = run(src, ['birthdayCareNote', 'roleOnlineProactiveBlocked'], {
      getC: () => ({ id: 'r1' }), roleBusyActive: () => true, _call: null,
    });
    assert.equal(ctx.roleOnlineProactiveBlocked('r1'), true, '平时忙还是挡');
    assert.equal(ctx.roleOnlineProactiveBlocked('r1', { ignoreBusy: true }), false, '生日不因为忙被挡');
    assert.equal(ctx.birthdayCareNote('[生日祝福｜真实事实：今天是…]'), true);
    assert.equal(ctx.birthdayCareNote('[节日心意｜真实事实：今天是2026-10-30，她的生日（她在个人资料里写的生日）。]'), true);
    assert.equal(ctx.birthdayCareNote('[节日心意｜真实事实：今天是中秋。]'), false);
    assert.match(grab(src, 'roleBusyDeferReply'), /birthdayCareNote\(note\)\)return false;/, '生日祝福不被延后到忙完');
  });

  test(`${label}：查他手机被截断时用上已写完的部分，夹带思考也能读`, () => {
    const ctx = run(src, ['parseObj', 'stripJSON', 'spyJsonText', 'spyJsonOpen', 'spyJsonRepair', 'spyParseLoose', 'spyFailWhy'], {});
    const cut = '```json\n{"balance":"1200","chats":[{"name":"妈妈","msgs":["吃饭了吗"]},{"name":"同事","msgs":["明天开';
    const o = ctx.spyParseLoose(cut);
    assert.ok(o && o.balance === '1200' && o.chats[0].name === '妈妈' && o.chats[0].msgs[0] === '吃饭了吗', '截断前写完的部分要能用');
    const think = '<think>先想想 {不是数据}</think>\n好的：{"balance":"88","notes":["买花"]}';
    assert.equal(ctx.spyParseLoose(think).balance, '88');
    assert.match(ctx.spyFailWhy(''), /空内容/);
    assert.match(ctx.spyFailWhy('我不能这样做'), /没有写 JSON/);
    assert.match(ctx.spyFailWhy('<think>想了很久</think>'), /只写了思考/);
    assert.match(ctx.spyFailWhy('{"a":[1,2'), /写到一半/);
  });

  test(`${label}：查他手机失败会留下模型原话，设置里能看`, () => {
    assert.match(src, /spyRawKeep\(id,content,_spyWhy\)/);
    assert.match(src, /row\('看模型原话'/);
    // SPY_ROLE_ROUTE_V1 起续写带上角色线路 _spyRoute
    assert.match(src, /content=await spyContinueJson\(_spyMsgs,content,_spyRoute\)/);
  });
}
