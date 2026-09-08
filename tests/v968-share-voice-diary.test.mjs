import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const app = read('app.js');
const bridge = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift');
const pip = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/CallPictureInPictureController.swift');

function functionSource(name) {
  const marker = 'function ' + name + '(';
  const start = app.indexOf(marker);
  assert.notEqual(start, -1, name + ' should exist');
  const brace = app.indexOf('{', start);
  let depth = 0, quote = '', escaped = false;
  for (let i = brace; i < app.length; i++) {
    const ch = app[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return app.slice(start, i + 1);
  }
  throw new Error('unterminated ' + name);
}

test('screen-share start and end receive bounded context instead of a state-only echo', () => {
  const context = vm.createContext({
    _call: { session: 's1' },
    S: { me: { name: '小北' } },
    msgs: () => [
      { _call: true, _cs: 'old', type: 'text', role: 'user', content: '旧通话' },
      { _call: true, _cs: 's1', type: 'text', role: 'user', content: '我们刚才在看菜单' },
      { _call: true, _cs: 's1', type: 'text', role: 'assistant', content: 'The red one.', _callTrans: '红色那个。' },
      { _call: true, _cs: 's1', type: 'text', role: 'assistant', content: '红色那个。', _callTranslationOf: 'x' },
    ],
    msgToText: m => m.content,
  });
  vm.runInContext(functionSource('callScreenShareEventContext') + ';this.contextFor=callScreenShareEventContext', context);
  const result = context.contextFor({ id: 'role' });
  assert.match(result, /我们刚才在看菜单/);
  assert.match(result, /The red one\. \/ 红色那个/);
  assert.doesNotMatch(result, /旧通话/);
  assert.equal((result.match(/红色那个/g) || []).length, 1);
  assert.match(functionSource('callScreenShareRoleEvent'), /context=callScreenShareEventContext\(c\)/);
  assert.match(functionSource('callScreenShareRoleEvent'), /不能把“屏幕共享已开始／已结束”直接复述/);
});

test('robotic share notices and missing translations are repaired once with the same context', () => {
  const issue = functionSource('callScreenShareEventIssue');
  assert.match(issue, /callOutputIssue\(content,c,video/);
  assert.match(issue, /Got it|got it/);
  const callAI = app.slice(app.indexOf('async function callAI('), app.indexOf('function callSystemPrompt', app.indexOf('async function callAI(')));
  assert.match(callAI, /if\(!_rawOutput&&_screenShareEvent\)\{let issue=callScreenShareEventIssue/);
  assert.match(callAI, /\{role:'user',content:sysNote\}/);
  assert.match(callAI, /共享状态回复只允许重试这一次/);
  assert.doesNotMatch(callAI, /for\(let[^\n]*callScreenShareEventIssue/);
  assert.match(callAI, /throw callOutputBlockedError\(issue\|\|'共享状态回复重试仍不可用'/);
});

test('shared-media role speech uses unclamped settings and a public native gain stage', () => {
  const play = app.match(/async function playCallMediaWait[\s\S]*?async function prepareCallSpeech/)?.[0] ?? '';
  assert.match(play, /volume:Math\.max\(0,Math\.min\(3,volMul\(\)\)\)/);
  assert.match(bridge, /let mime = arguments\["mime"\]/);
  assert.match(bridge, /mime: mime/);
  assert.match(pip, /if mixWithMedia, playEnhancedAudio/);
  assert.match(pip, /AVAudioEngine\(\)/);
  assert.match(pip, /AVAudioUnitEQ\(numberOfBands: 0\)/);
  assert.match(pip, /gainUnit\.globalGain = min\(12, 5 \+ extraGain\)/);
  assert.doesNotMatch(pip, /AVAudioUnitDynamicsProcessor/);
  assert.doesNotMatch(pip, /completionCallbackType/);
  assert.match(bridge, /preserveCurrentSession: mixWithMedia/);
  assert.match(pip, /enhancedAudioEngine\?\.stop\(\)/);
});

test('role phone diary opens today on demand and preserves only favorites past expiry', () => {
  let saves = 0;
  const context = vm.createContext({
    ymd: t => { const d = new Date(t); return (d.getMonth() + 1) + '月' + d.getDate() + '日'; },
    hm: () => '12:00',
    uid: () => 'id-' + (++saves),
    save: () => { saves++; },
  });
  vm.runInContext([
    functionSource('roleDiaryDayStart'),
    functionSource('roleDiaryDateKey'),
    functionSource('roleDiaryDisplayDate'),
    functionSource('roleDiaryHasDay'),
    functionSource('roleDiaryTodayIndex'),
    functionSource('roleDiaryPrune'),
    'this.prune=roleDiaryPrune;',
  ].join('\n'), context);
  const now = Date.now();
  const diary = { _diaryLegacyMigrated: true, diaryLog: [
    { id: 'expired', text: '未收藏', expiresAt: now - 1, favorite: false },
    { id: 'saved', text: '已收藏', expiresAt: now - 1, favorite: true },
    { id: 'legacy', text: '旧日记' },
  ] };
  context.prune(diary, now);
  assert.deepEqual(Array.from(diary.diaryLog, x => x.id), ['saved', 'legacy']);
  assert.match(functionSource('roleDiaryRecentFacts'), /m\._call\?\(m\._ck==='video'\?'视频通话':'语音通话'\):'微信'/);
  assert.match(functionSource('roleDiaryRecentFacts'), /S\.cohabitation/);
  assert.match(functionSource('roleDiaryGenerateDay'), /篇幅完全跟随当天内容/);
  assert.match(functionSource('roleDiaryGenerateDay'), /expiresAt:openedAt\+86400000/);
  assert.match(functionSource('spyDiaryOpenToday'), /roleDiaryGenerateDay\(c,sp,roleDiaryDayStart\(Date\.now\(\)\)\)/);
  assert.match(functionSource('spyDiaryPinInput'), /spyDiaryOpenToday\(id,false\)/);
  assert.match(functionSource('spyDiaryListHTML'), /正在打开/);
  assert.match(functionSource('spyDiaryListHTML'), /filter\(x=>x\.i!==today\)/);
  assert.match(functionSource('spyDiaryListHTML'), /spyDiaryOpenToday\('\$\{id\}',true\)/);
  assert.doesNotMatch(functionSource('spyDiaryListHTML'), /正在生成|模型|系统|字幕/);
  assert.doesNotMatch(app, /roleDiaryDailyTick|roleDiarySchedule|roleDiaryMissingDay/);
  assert.match(app, /普通手机刷新不得生成或覆盖/);
});

test('diary security, full-screen reading and collapsed call records are wired', () => {
  assert.match(functionSource('spyDiaryDefaultPwd'), /S\.couple\.startDate/);
  assert.match(functionSource('spyDiaryDefaultPwd'), /m\[1\]\+m\[2\]/);
  assert.match(functionSource('spyDiaryPinInput'), /spyDiaryBusted\(id\)/);
  assert.match(functionSource('spyDiaryEntryView'), /position:absolute;inset:0/);
  assert.match(functionSource('spyDiaryEntryView'), /repeating-linear-gradient/);
  assert.match(functionSource('spyDiaryToggleFavorite'), /delete e\.expiresAt/);
  assert.doesNotMatch(app, /\['diary','日记','📔'/);
  assert.match(functionSource('renderCallLog'), /<details/);
  assert.match(functionSource('renderCallLog'), /内容默认折叠/);
  assert.match(functionSource('rolePhoneCallCard'), /<details/);
});

test('changing my remark in his WeChat is discovered only on the next chat', () => {
  assert.match(functionSource('hisSaveMyRemark'), /meRemarkChange=/);
  assert.doesNotMatch(functionSource('hisSaveMyRemark'), /scheduleReply|hisDiscover/);
  assert.match(functionSource('hisRemarkDiscoveryNote'), /刚刚回到与你的微信聊天并发来一条新消息/);
  assert.match(functionSource('sendText'), /hisRemarkDiscoveryNote\(c\)/);
  assert.match(app, /hisChangeMyRemark\('\$\{cid\}'\)/);
});

test('role tweets use daily life and gentle one-retry diversity', () => {
  assert.match(functionSource('roleTweetLifeContext'), /roleDiaryRecentFacts/);
  assert.match(functionSource('roleTweetGenerate'), /账号圈子定位/);
  assert.match(functionSource('roleTweetGenerate'), /今天的真实生活/);
  assert.match(functionSource('roleTweetGenerate'), /attempt<2/);
  assert.match(functionSource('roleTweetGenerate'), /if\(!sim\.soft\)return text/);
  assert.match(functionSource('publishRoleTweet'), /sim\.hard/);
  assert.doesNotMatch(functionSource('publishRoleTweet'), /sim\.soft/);
});
