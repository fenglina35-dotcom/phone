// OFF_REAL_TIME_V1：单次约会不再选日期、时间、时段，按现实里此刻（每次写给角色前刷新）。
// GROUP_MSG_EDIT_V1：AI 群聊消息菜单能编辑（角色说的也能改），菜单不放 emoji。
// 设 FIX_TEST_OLD=1 时读取 HEAD 里的旧代码，用来确认这些测试在修复前会失败。
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { read, fnSource, BUNDLES } from './_helpers.mjs';

for (const [label, file] of BUNDLES) {
  const src = read(file);

  test(label + ' date invitation has no date/time/daypart pickers and starts at the real time', () => {
    let html = '', began = null;
    const now = new Date(2026, 10, 2, 23, 47);
    const ctx = vm.createContext({
      getC: () => ({ id: 'r1', name: '林深', remark: '先生' }), esc: (s) => String(s), todayStr: () => '2026-11-02', openModal: (h) => { html = h; }, closeModal: () => {},
      $: (sel) => ({ '#of_loc': { value: '江边' } })[sel] || null, Date: class extends Date { static now() { return now.getTime(); } },
      roleTimeParts: () => ({ year: 2026, month: 11, day: 2, hour: 23, minute: 47 }), S: { me: { name: '她' } },
      offData: () => ({ msgs: [] }), offBeginSession: (cid, o, loc, when, part) => { began = { loc, when, part }; o.when = when; o.daypart = part; },
      uid: () => 'u', save: () => {}, go: () => {}, offAI: () => {}, _off: null,
    });
    const names = ['dayPartNow', 'offlineInvite', 'offlineStart'].concat(src.includes('function offRealClock(') ? ['offRealClock'] : []);
    vm.runInContext("const DAYPARTS=['白天','中午','下午','傍晚','晚上','深夜'];" + names.map((n) => fnSource(src, n)).join('\n') + ';this.inv=offlineInvite;this.start=offlineStart;', ctx);
    ctx.inv('r1');
    assert.doesNotMatch(html, /id="of_date"|id="of_time"|id="of_part"/, '邀请框里不再选日期、时间、时段');
    ctx.start('r1');
    assert.deepEqual(began, { loc: '江边', when: '2026-11-02 23:47', part: '深夜' });
  });

  test(label + ' date time follows the real clock every time the role is prompted', () => {
    assert.match(fnSource(src, 'offlineSystem'), /offRealTimeSync\(S\.offline\[c\.id\]\)/);
    assert.match(fnSource(src, 'offlineWechatLivePrompt'), /offRealTimeSync\(o\)/);
    assert.doesNotMatch(fnSource(src, 'offSetting'), /id="os_when"|id="os_part"/, '约会设定里不再改时间、时段');
    const ctx = vm.createContext({ roleTimeParts: () => ({ year: 2026, month: 11, day: 3, hour: 7, minute: 5 }), Date });
    vm.runInContext(['dayPartNow', 'offRealClock', 'offRealTimeSync'].map((n) => fnSource(src, n)).join('\n') + ';this.sync=offRealTimeSync;', ctx);
    const o = { started: true, when: '2026-11-02 19:00', daypart: '晚上' };
    ctx.sync(o);
    assert.equal(o.when, '2026-11-03 07:05');
    assert.equal(o.daypart, '清晨');
  });

  test(label + ' AI group: any text message can be edited, including what a role said', () => {
    let html = '';
    const g = { id: 'g1', msgs: [{ id: 'm1', senderId: 'r1', role: 'assistant', type: 'text', content: '旧的话' }] };
    const ctx = vm.createContext({ S: { groups: [g] }, _lpFired: false, getC: () => ({ name: '林深', remark: '先生' }), esc: (s) => String(s), openModal: (h) => { html = h; }, closeModal: () => {}, save: () => {}, render: () => {}, toast: () => {}, document: { getElementById: () => ({ value: ' 新的话 ' }) } });
    vm.runInContext(['gMsgMenu', 'gSenderName', 'gEditMsg', 'gEditSave'].map((n) => fnSource(src, n)).join('\n') + ';this.menu=gMsgMenu;this.save=gEditSave;', ctx);
    ctx.menu('g1', 'm1');
    assert.match(html, /编辑（先生说的）/);
    assert.doesNotMatch(html, /\p{Extended_Pictographic}/u, '菜单里没有 emoji');
    ctx.save('g1', 'm1');
    assert.equal(g.msgs[0].content, '新的话');
  });
}
