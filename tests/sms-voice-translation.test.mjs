import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

/* 她说「我还想给这个短信里面做，可以让角色发语音的功能，发的语音也是带有翻译的哦，
   如果是外语的话，就是跟微信的一样，气泡的话不跟微信一样，和现在这个短信一样就行」。
   所以这一组盯两件事：能力必须和微信同一套（同一个 TTS、同一套外语原文＋中文翻译），
   外观必须是短信自己那套气泡，一点微信的绿皮都不许带过来。 */
const PRIVATE = '../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/';
const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const priv = readFileSync(new URL(PRIVATE + 'app.js', import.meta.url), 'utf8');
const shells = [
  readFileSync(new URL('../小手机.html', import.meta.url), 'utf8'),
  readFileSync(new URL(PRIVATE + '小手机.html', import.meta.url), 'utf8'),
  readFileSync(new URL(PRIVATE + 'index.html', import.meta.url), 'utf8'),
];
const lines = app.split('\n');
const source = name => {
  const i = lines.findIndex(x => x.startsWith(`function ${name}(`) || x.startsWith(`async function ${name}(`));
  assert.ok(i >= 0, `找不到 ${name}`);
  let depth = 0, out = [];
  for (let j = i; j < lines.length; j++) {
    out.push(lines[j]);
    for (const ch of lines[j]) { if (ch === '{') depth++; else if (ch === '}') depth--; }
    if (depth <= 0 && j > i) break;
    if (depth <= 0 && /\}$/.test(lines[j]) && j === i) break;
  }
  return out.join('\n');
};

test('提示词里真的把「短信也能发语音」告诉角色了', () => {
  const fn = source('phSmsVoiceHelp');
  assert.match(fn, /\[语音\|要说的话\]/, '得把标签写法给他');
  assert.match(fn, /VOICE_MAX_CHARS/, '字数上限跟微信同一个常量');
  assert.match(fn, /VOICE_MAX_SECONDS/, '秒数上限也是');
  assert.match(fn, /语气:温柔/, '语气也要能带');
  /* 外语必须带中文翻译，这是她点名的 */
  assert.match(fn, /ttsContentLang/, '得按角色真实的语音语言判断，不能写死');
  assert.match(fn, /原文\|中文翻译/, '外语必须写成 原文|中文翻译');
  assert.match(fn, /第二栏是真正的译文，不能省/, '得把「必须真译」说死');
  /* 设置里关了语音就一个字都不提 */
  assert.match(fn, /voiceFreq==null\?1:S\.settings\.voiceFreq\)===0\)return''/, '关了语音就别提这件事');
  /* 只挂在真角色那条短信线上：陌生号和伪装号一开口就露馅 */
  assert.match(source('phRoleSmsReply'), /\+phSmsVoiceHelp\(c\)\+phFxTagHelp\(\)/, '真角色那条线要挂上');
  for (const fnName of ['phRoleAliasReply', 'phRoleSpoofSmsReply', 'phAutoSmsReply'])
    assert.equal(/phSmsVoiceHelp/.test(source(fnName)), false, fnName + ' 不该给语音——一开口就露馅了');
});

test('收到语音标签，存成和微信同一个形状的语音消息', () => {
  const fn = source('phReceiveSms');
  assert.match(fn, /parseVoiceTagLine\(phCleanSmsText\(text\)\)/, '复用微信那个解析器，不要再写一份');
  assert.match(fn, /const vt=c&&typeof parseVoiceTagLine==='function'/, '只有真角色那条线认语音标签');
  /* type/role/content 必须照微信语音消息的形状存，
     warmVoiceMsg / speakMsg / refreshVoiceBubble 才能原样拿来用 */
  assert.match(fn, /m\.voice=1;m\.type='voice';m\.role='assistant';m\.content=say;m\.text=say;/);
  assert.match(fn, /m\.trans=String\(vt\.trans\|\|''\)\.trim\(\)/, '翻译要存下来');
  assert.match(fn, /if\(vt\.cue\)m\.voiceCue=vt\.cue/, '语气要存下来，TTS 要用');
  assert.match(fn, /m\.dur=voiceEstimatedSeconds\(say\)/, '时长用微信同一个算法估');
  assert.match(fn, /m\.showText=false/, '一开始不显示文字，点一下才转');
  assert.match(fn, /\[\.\.\.String\(vt\.text\|\|''\)\]\.slice\(0,VOICE_MAX_CHARS\)/, '超长要截断，不能塞爆 TTS');
  /* TTS 预热走微信那条队列 */
  assert.match(fn, /if\(m\.voice&&c&&ttsApiOn\(c\)\)\{m\._ttsLoading=true;scheduleVoiceWarm\(m,c,voiceProgressiveOn\(\)\)/,
    '收到就该开始生成语音，别等她点');
});

test('语音条用的是短信自己的气泡，不是微信那个', () => {
  const fn = source('renderPhoneIMsg');
  assert.match(fn, /class="imsg-b imsgv/, '气泡还是 .imsg-b 这一套（磨砂＋细高光＋剪出来的小尾巴）');
  assert.equal(/voiceb/.test(fn), false, '不许把微信的 .voiceb 搬过来');
  assert.match(fn, /data-vid="\$\{m\.id\}"/, 'data-vid 要挂上，TTS 好了才能就地刷新这条');
  assert.match(fn, /phVoiceTap\('\$\{esc\(num\)\}','\$\{m\.id\}'/, '点气泡＝播放');
  assert.match(fn, /class="imsgv-wave"/, '要有波形');
  assert.match(fn, /class="imsgv-dur"/, '要有秒数');
  assert.match(fn, /m\.showText\?`<div class="imsg-vtext"/, '点过之后把文字留在下面');
  assert.match(fn, /m\.trans\?`<span class="tr">/, '外语底下要跟一行中文翻译');
  for (const s of shells) {
    assert.match(s, /\.imsg-b\.imsgv>i\{display:inline-flex/, '少了语音条的样式');
    assert.match(s, /\.imsgv-wave i\{/, '少了波形');
    assert.match(s, /\.imsg-b\.imsgv\.playing \.imsgv-wave i\{/, '放的时候波形要动起来');
    assert.match(s, /\.imsg-vtext\{/, '少了转文字那一条');
    assert.match(s, /\.imsg-vtext \.tr:before\{content:'译 '/, '翻译那行要有「译」字打头');
    /* 气泡本身不许被改样子：语音条只是往 .imsg-b 里塞内容 */
    assert.equal(/\.imsg-b\.imsgv\{[^}]*background:/.test(s), false, '别给语音条另配底色，它就该和别的短信一样');
  }
});

test('点一下就放，放完把原文和翻译留在下面', () => {
  const fn = source('phVoiceTap');
  assert.match(fn, /audioUnlock\(\)/, 'iOS 必须在这一下点击里同步解锁音频，晚了就没声');
  assert.match(fn, /voiceTtsPending\(m\)\)\{m\._playWhenReady=true/, '还在生成就排队，好了自动放');
  assert.match(fn, /speakMsg\(m,c\)/, '复用微信那个播放器');
  assert.match(fn, /el\.classList\.add\('playing'\)/, '放的时候波形要动');
  assert.match(fn, /if\(!m\.showText\)\{m\.showText=true;save\(\);render\(\);\}/, '放过一次就把文字留下');
});

test('语音在上下文、通知和列表里都写得明明白白', () => {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(source('phSmsVoiceLine'), ctx);
  const line = o => vm.runInContext(`phSmsVoiceLine(${o})`, ctx);
  assert.equal(line("{text:'我也想你了'}"), '[语音]我也想你了');
  assert.equal(line("{text:'I miss you',trans:'我想你'}"), '[语音]I miss you（中文：我想你）',
    '外语要把中文翻译一起带进上下文，不然下一轮他自己都不知道说了什么');
  assert.match(source('phRoleSmsReply'), /phSmsLineText\(m\)/, '上下文要走这个helper');
  assert.match(source('phReceiveSms'), /phSmsNotify\(num,m\.voice\?'给你发来一条语音':text,c\)/,
    '通知栏不该把语音正文直接抖出来');
  assert.match(app, /m\.voice\?\('\[语音\] '\+\(m\.text\|\|''\)\)/, '短信列表的预览要标出来是语音');
  assert.match(source('phReceiveSms'),
    /phMirrorSMS\(num,'them',m\.voice\?\(m\.text\+\(m\.trans\?'（'\+m\.trans\+'）':''\)\):text\)/,
    '镜像进微信的要把说的话和翻译都带过去');
});

test('两份 app.js 的语音改动逐字一样', () => {
  for (const name of ['phSmsVoiceHelp', 'phVoiceTap', 'phSmsVoiceLine', 'phSmsLineText'])
    assert.ok(priv.includes(`function ${name}(`), '私人版少了 ' + name);
  for (const k of ['imsgv-wave', 'imsg-vtext', 'phVoiceTap(', "m.voice=1;m.type='voice'"])
    assert.ok(priv.includes(k), '私人版少了 ' + k);
});
