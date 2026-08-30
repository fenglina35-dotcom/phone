import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const app = read('app.js');
const sync = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/CompanionSyncView.swift');

function lineFunction(name) {
  const match = app.match(new RegExp(`^function ${name}\\([^\\n]+$`, 'm'));
  assert.ok(match, `missing ${name}`);
  return match[0];
}

test('offline and cohab prompts use the same hidden long-term memory tag as WeChat', () => {
  assert.match(app, /function offlineMemoryRule\(c\)/);
  assert.match(app, /重要记忆（与微信使用同一套长期记忆）/);
  assert.equal((app.match(/s\+=offlineMemoryRule\(c\);/g) || []).length, 2);
  assert.match(app, /登录\/退出微信、查看手机、屏幕共享、远程控制、同步、读取、上传和报错都只是功能操作/);
  assert.match(app, /r=applyGrudgeTags\(r,c\);r=offlineApplyMemoryTags\(r,c,current\)\.text/);
  assert.match(app, /retry=applyGrudgeTags\(retry,c\);retry=offlineApplyMemoryTags\(retry,c,current\)\.text/);
  assert.match(app, /if\(!note\)offlineRememberExplicitRequest\(c,current\)/);
});

test('explicit offline memory requests are deterministic and operational events are rejected', () => {
  const sandbox = {
    aboutMeNoteText: value => String(value || '')
      .replace(/^[\s\[【]*(?:记住|小事簿)\s*[|｜:：]?/, '')
      .replace(/[\]】]\s*$/, '')
      .trim(),
  };
  vm.runInNewContext(
    lineFunction('memoryOperationalEventOnly') + '\n' +
      lineFunction('offlineExplicitMemoryText') + '\n' +
      'globalThis.pick=offlineExplicitMemoryText;globalThis.noise=memoryOperationalEventOnly;',
    sandbox,
  );

  assert.equal(sandbox.pick('把我不吃香菜记到那个微信的记忆里面'), '我不吃香菜');
  assert.equal(sandbox.pick('请记住：我妈妈生日是五月八号'), '我妈妈生日是五月八号');
  assert.equal(sandbox.pick('你还记得我昨天说什么吗'), '');
  assert.equal(sandbox.pick('把我登录了他的微信记到微信记忆里'), '');
  assert.equal(sandbox.noise('我刚登录了他的微信账号'), true);
  assert.equal(sandbox.noise('远程控制结束了'), true);
  assert.equal(sandbox.noise('我不吃香菜'), false);
});

test('offline model memory tags execute once and never leak into visible dialogue', () => {
  const remembered = [];
  let saves = 0;
  const sandbox = {
    String,
    rememberFromConversation: (_c, text, userText, replyText) => {
      remembered.push({text,userText,replyText});
      return 'added';
    },
    save() { saves += 1; },
  };
  vm.runInNewContext(
    lineFunction('offlineApplyMemoryTags') +
      ';globalThis.result=offlineApplyMemoryTags("【记住｜她不吃香菜】\\n【他把菜单收起来】\\n我记下了。",{},"我不吃香菜");',
    sandbox,
  );
  assert.equal(remembered.length,1);
  assert.equal(remembered[0].text,'她不吃香菜');
  assert.equal(remembered[0].userText,'我不吃香菜');
  assert.match(remembered[0].replyText,/我记下了/);
  assert.equal(sandbox.result.changed, true);
  assert.doesNotMatch(sandbox.result.text, /记住|不吃香菜/);
  assert.match(sandbox.result.text, /我记下了/);
  assert.equal(saves, 1);
});

test('feature-operation-only text cannot enter important chat memory', () => {
  assert.match(app, /if\(!v\|\|memoryOperationalEventOnly\(v\)\)return'none'/);
  assert.match(app, /if\(!full\|\|memoryOperationalEventOnly\(full\)\)return'rejected'/);
  assert.match(app, /登录或退出微信、查看手机、屏幕共享、远程控制、同步、读取、上传和报错都只是功能操作，不能写进长期记忆/);
});

test('native sync retries transient origin failures and never renders Cloudflare HTML', () => {
  assert.match(sync, /for attempt in 0\.\.<2/);
  assert.match(sync, /\[408, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524\]/);
  assert.match(sync, /contentType\.contains\("text\/html"\)/);
  assert.match(sync, /服务器连接超时（522），请稍后重试；本机已有数据未被覆盖/);
  assert.ok(sync.includes('服务器暂时不可用（HTTP \\(status)），请稍后重试；本机已有数据未被覆盖'));
  const rpcStart = sync.indexOf('private func rpc<T: Decodable>');
  const rpcEnd = sync.indexOf('private func deviceID()', rpcStart);
  const rpc = sync.slice(rpcStart, rpcEnd);
  assert.doesNotMatch(rpc, /object\?\["message"\][\s\S]{0,100}\?\?\s*String\(data:/);
  assert.match(sync, /case \.timedOut:\s+report = latestDirectUsageSnapshot/);
  assert.match(sync, /已保留上次有效使用量并继续上传其他真实数据/);
});
