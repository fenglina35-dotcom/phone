import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// v1396 拉黑后的追回：角色自己决定怎么联系（再申请/自己号码打/陌生号码打/短信/情侣强制远程），目的只有一个——被拉出黑名单。
for (const [label, path] of [['web', '../app.js'], ['private', '../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js']]) {
  const app = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
  const lines = app.split('\n');
  const grab = n => { const i = lines.findIndex(x => x.startsWith('function ' + n + '(') || x.startsWith('async function ' + n + '(')); assert.ok(i >= 0, 'missing ' + n); let j = i + 1; while (j < lines.length && /^\s/.test(lines[j])) j++; return lines.slice(i, j).join('\n'); };

  test(label + ': only couples may force, only after three ignored attempts, and every step is capped', () => {
    const ctx = { S: { couple: { cid: 'lover' }, friendRequests: [] }, friendRequestsInit() {} };
    vm.runInNewContext([lines.find(l => l.startsWith('const PURSUIT_MAX_STEPS=')), 'const PURSUIT_ACT={};', grab('pursuitState'), grab('pursuitCanForce'), grab('pursuitOptions'), 'globalThis.o=pursuitOptions;'].join('\n'), ctx);
    const mk = (id, ignored, steps, stranger = true) => ({ id, allowStrangerCall: stranger, _pursuit: { steps, ignored, log: [] } });
    assert.deepEqual(Array.from(ctx.o(mk('lover', 2, 2))), ['apply', 'call_own', 'call_stranger', 'sms', 'stop']);
    assert.ok(ctx.o(mk('lover', 3, 3)).includes('force'), 'the couple may choose to force after three ignored attempts');
    assert.ok(!ctx.o(mk('friend', 5, 5)).includes('force'), 'other roles never force');
    assert.ok(!ctx.o(mk('lover', 3, 3, false)).includes('call_stranger'), 'stranger calls need the role\'s permission');
    assert.deepEqual(Array.from(ctx.o(mk('friend', 8, 8))), ['stop'], 'at the cap only stopping is left');
    ctx.S.friendRequests = [{ contactId: 'friend', kind: 'readd', status: 'pending' }];
    assert.ok(!ctx.o(mk('friend', 0, 0)).includes('apply'), 'no second request while one is still pending');
  });

  test(label + ': answering or replying ends the pursuit; the role remembers why and what he did', () => {
    assert.match(app, /function pursuitGap\(\)\{return 8000\+Math\.floor\(Math\.random\(\)\*12001\);\}/, '8–20 seconds');
    assert.match(grab('pursuitCallAnswered'), /pursuitEnd\(c,'answered'\)/);
    assert.match(grab('pursuitOnUserSms'), /pursuitEnd\(c,'replied'\)/);
    assert.match(grab('pursuitPrompt'), /拉黑前你们最后的对话（她就是因为这些把你拉黑的）/);
    assert.match(grab('pursuitPrompt'), /你的目的只有一个：让'\+me\+'把你从微信黑名单里拉出来/);
    assert.match(grab('pursuitCallPrompt'), /你是用陌生号码 '\+phFmt\(num\)\+' 打给'\+S\.me\.name\+'的，她接起来前不知道是你/);
    assert.match(app, /s\+=_main\?friendReaddPrompt\(c\)\+\(typeof pursuitPromptRecent==='function'\?pursuitPromptRecent\(c\):''\):''/);
    assert.match(app, /if\(c\.blocked\)\{const now=Date\.now\(\);friendMetaSet\(c,'blockedAt',now\);if\(isMain\(\)\)pursuitStart\(c,now\);/);
    assert.match(app, /if\(_pz&&_pz\.stranger\)setTimeout\(\(\)=>phRoleSmsReply\(_pz\.cid,num,text,num\)/, 'a reply to the stranger number reaches the role');
  });

  test(label + ': the forced takeover cannot be stopped and ends with his own accept', () => {
    const force = app.slice(app.indexOf('async function pursuitForce('), app.indexOf('async function pursuitStep('));
    assert.match(force, /document\.body\.classList\.add\('remote-forced'\)/);
    assert.match(force, /acceptFriend\(req\.id,\{forced:true\}\)/);
    assert.match(force, /pursuitEnd\(c,'forced'\)/);
    assert.match(force, /自己点了同意，把自己从她的黑名单里拉了出来——她没有同意，是你自己做的/);
    assert.match(app, /content:opt\.forced\?\(c\.remark\|\|c\.name\)\+'远程操控了你的手机，自己通过了好友申请'/);
  });
}

test('the stop button is hidden during a forced takeover in every entry', () => {
  for (const p of ['../小手机.html', '../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html', '../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/小手机.html']) {
    assert.ok(fs.readFileSync(new URL(p, import.meta.url), 'utf8').includes('body.remote-forced .remote-stop{display:none!important}'), p);
  }
});
