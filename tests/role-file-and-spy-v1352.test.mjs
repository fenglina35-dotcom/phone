import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// v1352：角色发过一次文件后，历史里把它写成“我给你发了文件「x」，文件正文如下：”，角色下次照抄这句，
// 文件就被拆成一行行文字气泡。查手机只给 1200 额度、把转账回执以 system 夹在对话中间、失败原因全被吞掉。
const BUILDS = [
  ['web', fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8')],
  ['private', fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js', import.meta.url), 'utf8')],
];
const fn = (src, name) => {
  const i = src.indexOf('function ' + name + '(');
  assert.ok(i >= 0, 'missing ' + name);
  let depth = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') depth++;
    else if (src[k] === '}' && !--depth) return src.slice(i, k + 1);
  }
};
const consts = (src, names) => src.split('\n').filter(l => names.some(n => l.startsWith('const ' + n + '='))).join('\n');
const body = '亲爱的未来小祺：\n' + '今天想跟你说很多话。'.repeat(15) + '\n爱你的我';

test('role files survive echoed context wording and a missing closing tag', () => {
  for (const [label, src] of BUILDS) {
    const ctx = {};
    vm.runInNewContext(consts(src, ['CHAT_FILE_MAX', 'CHAT_FILE_CTX', 'ROLE_FILE_BLOCK', 'ROLE_FILE_ECHO', 'ROLE_FILE_OPEN']) + '\n' + fn(src, 'roleFileExtract') + '\nglobalThis.x=roleFileExtract;', ctx);
    const echo = ctx.x('给你写好了\n[我给你发了文件「给未来小祺的一封信.txt」，文件正文如下：\n' + body + '\n（以上是这个文件的真实内容，你已经读过了，可以直接就里面的话回应）]\n看完告诉我');
    assert.equal(echo.files.length, 1, label + ': echoed wording must still become a file');
    assert.equal(echo.files[0].name, '给未来小祺的一封信.txt');
    assert.doesNotMatch(echo.text, /文件正文如下/, label + ': no raw context line left as a bubble');
    assert.equal(ctx.x('写好了\n[文件|信.txt]\n' + body).files.length, 1, label + ': a long body without [/文件] is still a file');
    assert.equal(ctx.x('好呀\n[文件|信.txt]\n' + body + '\n[/文件]\n收到记得看').files.length, 1, label + ': normal files still work');
    assert.equal(ctx.x('给你\n[文件|报告.pdf|2MB]\n看一下').files.length, 0, label + ': one-line cards are untouched');
    assert.equal(ctx.x('[文件|清单.txt]\n早点睡\n晚安').files.length, 0, label + ': short chat after a card is not swallowed');
  }
});

test('the role sees its own earlier files in its own file syntax', () => {
  for (const [label, src] of BUILDS) {
    const ctx = {};
    vm.runInNewContext(consts(src, ['CHAT_FILE_CTX']) + '\n' + fn(src, 'roleFileHistoryText') + '\nglobalThis.h=roleFileHistoryText;', ctx);
    assert.equal(ctx.h({ name: '信.txt', text: '你好' }), '[文件|信.txt]\n你好\n[/文件]');
    assert.match(fn(src, 'msgToText'), /m\.role==='assistant'&&m\.type==='file'\)return roleFileHistoryText\(m\)/, label + ': msgToText must route role files first');
  }
});

test('phone inspection has room to finish, sends no mid-chat system role and says why it failed', () => {
  for (const [label, src] of BUILDS) {
    const spy = fn(src, 'spyRefresh');
    assert.match(spy, /\{max:4000,aux:/, label + ': generation budget');
    assert.doesNotMatch(spy, /_transferReceipt\?'system'/, label + ': no system role inside history');
    assert.match(spy, /toast\('生成失败：'\+\(_spyWhy\|\|'原因未知'\)/, label + ': failure reason shown');
  }
});
