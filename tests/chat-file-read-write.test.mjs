import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const PRIVATE = '../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/';
const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const priv = readFileSync(new URL(PRIVATE + 'app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../小手机.html', import.meta.url), 'utf8');
const shell = readFileSync(new URL(PRIVATE + '小手机.html', import.meta.url), 'utf8');
const index = readFileSync(new URL(PRIVATE + 'index.html', import.meta.url), 'utf8');
const lines = app.split('\n');
const source = name => {
  const i = lines.findIndex(x => x.startsWith(`function ${name}(`) || x.startsWith(`async function ${name}(`));
  assert.ok(i >= 0, `找不到 ${name}`);
  let j = i + 1;
  while (j < lines.length && !/^(async function |function |let |const |\/\*)/.test(lines[j])) j++;
  return lines.slice(i, j).join('\n');
};

/* 以前发文件只留了个文件名，内容当场丢掉。现在两个方向都要真的通：
   她发的文件角色读得到正文，角色写的文件她点得开。 */

test('only formats we can actually read are treated as readable', () => {
  const ctx = vm.createContext({ String });
  vm.runInContext(
    'const CHAT_FILE_TEXT_EXT=' + app.match(/const CHAT_FILE_TEXT_EXT=(\[[^\]]*\]);/)[1] + ';\n' +
    'function aiMemoryFileExt(name){const m=String(name||"").toLowerCase().match(/\\.([a-z0-9]+)$/);return m?m[1]:"";}\n' +
    [source('chatFileExt'), source('chatFileReadable')].join('\n') + ';globalThis.R=chatFileReadable;', ctx);
  for (const n of ['日程.txt', '稿子.md', '数据.json', '表.csv', '信.docx', '歌词.lrc']) assert.equal(ctx.R(n), true, n + ' 应该读得出来');
  for (const n of ['照片.png', '包.zip', '书.pdf', '旧版.doc', '没有后缀']) assert.equal(ctx.R(n), false, n + ' 不该假装读得出来');
});

test('the file body reaches the character, and an unreadable file never gets faked', () => {
  const ctx = vm.createContext({ String });
  vm.runInContext('const CHAT_FILE_CTX=4000;\n' + source('chatFileContextBody') + ';globalThis.B=chatFileContextBody;', ctx);
  assert.match(ctx.B({ text: '第一行\n第二行' }), /文件正文如下：\n第一行\n第二行/, '正文要原样给角色');
  assert.match(ctx.B({ text: '内容' }), /你已经读过了/, '要告诉角色这是真的读过的');
  const none = ctx.B({ text: '', unreadable: '这种格式读不出文字' });
  assert.match(none, /这种格式读不出文字/);
  assert.match(none, /不要编造里面的内容/, '读不出来时必须明确禁止编造');
  assert.match(ctx.B({ text: '' }), /只有名字、没有正文/, '只有文件名的老卡片不该说成「读不出来」');
  assert.doesNotMatch(ctx.B({ text: '' }), /读不出文字/);
  const long = ctx.B({ text: '字'.repeat(9000) });
  assert.ok(long.length < 5000, '太长的文件要截断，不能整篇塞进每一轮');
  assert.match(long, /后面没给你/, '截断了要说一声');
  assert.match(app, /case 'file':return '\[我发了文件「'\+\(m\.name\|\|''\)\+'」'\+chatFileContextBody\(m\)/, '她发的文件要带正文');
  assert.match(app, /if\(m\.type==='file'\)return '\[我给你发了文件「'\+\(m\.name\|\|''\)\+'」'\+chatFileContextBody\(m\)/, '角色自己发的文件也要记得写了什么');
});

test('a character can write a real multi-line file, and the body never leaks as chat bubbles', () => {
  const ctx = vm.createContext({ String });
  vm.runInContext('const CHAT_FILE_MAX=20000;\nconst ROLE_FILE_BLOCK=' + app.match(/const ROLE_FILE_BLOCK=(\/.*?\/g);/)[1] + ';\n' + source('roleFileExtract') + ';globalThis.E=roleFileExtract;', ctx);
  const out = ctx.E('给你写好了。\n[文件|周末安排.txt]\n六点起\n\n七点出门\n[/文件]\n看看行不行');
  assert.equal(out.files.length, 1);
  assert.equal(out.files[0].name, '周末安排.txt');
  assert.equal(out.files[0].text, '六点起\n\n七点出门', '正文原样保留，包括空行');
  assert.match(out.text, /\[文件@0\]/, '整段换成一个占位行，才不会被当成好几条消息发出去');
  assert.doesNotMatch(out.text, /六点起/, '正文不能同时又当聊天气泡发一遍');
  assert.equal(ctx.E('[文件|空的.txt]\n\n[/文件]').files.length, 0, '空文件不发');
  assert.equal(ctx.E('普通说话').files.length, 0);
  assert.equal(ctx.E('【文件|中文括号.txt】\n内容\n【/文件】').files.length, 1, '中文方括号也要认');
  assert.equal(ctx.E('[文件|一.txt]\n甲\n[/文件]\n[文件|二.txt]\n乙\n[/文件]').files.length, 2, '一轮能发两个');
  assert.match(app, /文件@\(\\d\+\)\\s\*\[\\\]】\]\$\//, '回复流水线要认这个占位行');
  assert.match(app, /_roleFiles=roleFileExtract\(content\)/, '要在按行拆分之前先把整段抠出来');
});

test('she can open what the character wrote, and copy or save it', () => {
  for (const f of ['chatFileOpen', 'chatFileCopy', 'chatFileSave', 'roleFileMessage', 'chatFileText']) {
    assert.ok(app.includes(`function ${f}(`) || app.includes(`async function ${f}(`), `${f} 缺失`);
    assert.ok(priv.includes(`function ${f}(`) || priv.includes(`async function ${f}(`), `私人版缺少 ${f}`);
  }
  assert.match(source('chatFileOpen'), /cfile-read/);
  assert.match(source('chatFileOpen'), /toast\(m\.unreadable/, '没正文就说清楚为什么，而不是弹一个空框');
  assert.match(app, /cfile-open/, '读得出正文的卡片才点得开');
  assert.match(app, /event\.stopPropagation\(\);chatFileOpen/, '点文件不该顺手触发气泡菜单');
  assert.match(source('cDoc'), /chatFileText\(f\)/, '发文件时要真的去读');
  assert.match(source('cDoc'), /scheduleReply\(id\)/, '读完才叫角色回，否则他看到的是空文件');
  for (const [name, css] of [['小手机.html', html], ['私人壳', shell], ['index.html', index]]) {
    assert.ok(css.includes('.cfile-read{'), `${name} 少了文件阅读器样式`);
    assert.ok(css.includes('white-space:pre-wrap') && css.includes('.cfile-read{'), `${name} 的阅读器要保留换行`);
  }
});

test('the model is told how to write a file, and told not to invent one it cannot read', () => {
  for (const src of [app, priv]) {
    assert.ok(src.includes('[文件|名字.txt]\\n这里写正文'), '要把多行写法教给模型');
    assert.ok(src.includes('[/文件]'), '要教收尾标记');
    assert.ok(src.includes('不要只写一句「详见附件」'), '要挡住敷衍的空文件');
    assert.ok(src.includes('就别编造里面写了什么'), '读不出的文件不许编');
  }
});

test('the dice button is back on page two of the WeChat function panel', () => {
  const panel = source('chatFunctionPanel');
  assert.match(panel, /chatFunctionItem\('骰子','dice',`cDice\('\$\{id\}'\)`\)/);
  const second = panel.slice(panel.indexOf('second=['));
  assert.match(second, /骰子/, '要在第二页，不是第一页');
  assert.ok(app.includes('function cDice(id){'), 'cDice 还得在');
  assert.ok(priv.includes("chatFunctionItem('骰子','dice'"), '私人版也要有');
});

test('a DM avatar hugs the top of its bubble, never the bottom', () => {
  for (const [name, css] of [['小手机.html', html], ['私人壳', shell], ['index.html', index]]) {
    assert.ok(css.includes('.dydm-line{display:flex;align-items:flex-start;'), `${name} 的头像还贴在气泡底部`);
    assert.ok(css.includes('.dydm-read{font-size:12px;color:#63636b;align-self:flex-end;'), `${name} 的「已读」要单独贴底`);
  }
});
