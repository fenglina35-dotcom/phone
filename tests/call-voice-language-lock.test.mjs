import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// 用户报告：角色语音选了英文，但角色偶尔在英文里混进中文，这些中文会被真的念出口。
// 根因有两处，都在"送去语音合成的那一份文本"上，和屏幕显示无关：
//   1. 通话发声行让「模型原文输出（实验）」直接绕过 pickSpoken，中文原样进了合成。
//   2. ttsArr 本身没有语言兜底，而微信语音消息是不经过 pickSpoken 直接把正文交给它的。

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const lines = app.split('\n');
const block = name => {
  const start = lines.findIndex(l => l.startsWith(`function ${name}(`) || l.startsWith(`const ${name}=`));
  assert.ok(start >= 0, `missing ${name}`);
  let depth = 0;
  const out = [];
  for (let i = start; i < lines.length; i++) {
    out.push(lines[i]);
    for (const ch of lines[i]) { if (ch === '{') depth++; else if (ch === '}') depth--; }
    if (i > start && depth <= 0) break;
    if (i === start && depth === 0) break;
  }
  return out.join('\n');
};
const raw = name => { const f = lines.find(l => l.startsWith(`const ${name}=`)); assert.ok(f, `missing ${name}`); return f; };

const DEPS = [
  raw('CJK_RE'), raw('CN_PUNCT_RE'), block('normVoiceLang'), block('pickSpoken'),
  raw('CJK_TEST'), block('hasCN'), block('hasForeign'), block('callCnTermFix'),
  block('callNormalizeCnTranslationLine'), block('callNormalizeForeignOrig'),
  block('callNormalizeLine'), block('callIsActionLine'), block('callBadForeignMix'),
  block('callBadForeignLine'), block('ttsTidyOrphanPunct'), block('ttsDropOffLanguage'),
].join('\n');

// app.js:12831 的发声行，照抄进沙箱跑，而不是只做字符串断言
const CALL_PIPELINE = `
function callSpokenRows(pieces,_vlang,_rawOutput,video){
  const units=[];
  pieces.forEach(p=>{p=_rawOutput?String(p||''):callNormalizeLine((p||'').trim(),_vlang);if(!p)return;
    if(!_rawOutput&&callBadForeignLine(p,_vlang))return;
    const isTrans=/^[（(][^）)]*[）)]$/.test(p)&&hasCN(p);
    if(isTrans&&(!_rawOutput||units.length&&!units[units.length-1].trans)){if(units.length&&!units[units.length-1].trans)units[units.length-1].trans=p;return;}
    units.push({orig:p,trans:''});});
  let _prefetchP='';
  return units.map(u=>{const duplicate=!_rawOutput&&u.orig===_prefetchP;_prefetchP=u.orig;
    const isAction=video&&callIsActionLine(u.orig);
    return (duplicate||isAction)?'':(_rawOutput&&(!_vlang||_vlang==='zh'))?u.orig:pickSpoken(u.orig,_vlang);}).filter(Boolean);
}
globalThis.callSpokenRows=callSpokenRows;`;

const sandbox = () => {
  const ctx = { String, RegExp, Array, Object, Math, JSON, S: { settings: {} } };
  vm.runInNewContext(DEPS + '\n' + CALL_PIPELINE, ctx);
  return ctx;
};

const EN_REPLY = [
  "I couldn't stop thinking about you today, 宝贝.",
  '（今天一整天都在想你，宝贝。）',
  'You know that, right?',
  '（你知道的吧？）',
];

test('通话发声行在源码里不再让原文输出绕过外语过滤', () => {
  assert.match(app, /const isAction=video&&callIsActionLine\(u\.orig\),spoken=\(duplicate\|\|isAction\)\?'':\(_rawOutput&&\(!_vlang\|\|_vlang==='zh'\)\)\?u\.orig:pickSpoken\(u\.orig,_vlang\)/);
  assert.doesNotMatch(app, /spoken=\(duplicate\|\|isAction\)\?'':_rawOutput\?u\.orig:pickSpoken/, '原文输出不能再整段绕过语音语言过滤');
});

test('英文通话：开不开原文输出，念出口的都不含中文', () => {
  const ctx = sandbox();
  for (const rawOutput of [false, true]) {
    const spoken = ctx.callSpokenRows(EN_REPLY, '英', rawOutput, true);
    assert.ok(spoken.length >= 2, `原文输出=${rawOutput} 时应当仍有台词可念`);
    for (const row of spoken) {
      assert.doesNotMatch(row, /[㐀-䶿一-鿿]/, `原文输出=${rawOutput} 时把中文念了出来：${row}`);
      assert.match(row, /[A-Za-z]/, '英文台词不能被清空成哑音');
    }
  }
});

test('中文角色不受影响，原文输出仍然保留模型正文', () => {
  const ctx = sandbox();
  const zh = ['我今天一直在想你。', '你知道的吧？'];
  // 跨 vm realm 的数组原型不同，先搬回本 realm 再比
  assert.deepEqual([...ctx.callSpokenRows(zh, 'zh', true, true)], zh);
});

test('ttsArr 的语言锁只清理污染，绝不把整句变成哑音', () => {
  const ctx = sandbox();
  const en = { voice: { lang: '英' } };
  ctx.ttsCfg = () => ({});
  ctx.ttsUseRelay = () => false;
  ctx.ttsContentLang = c => (c && c.voice && c.voice.lang) || 'zh';
  vm.runInNewContext(block('ttsDropOffLanguage') + '\nglobalThis.drop=ttsDropOffLanguage;', ctx);

  assert.equal(ctx.drop("I missed you, 宝贝.", en), 'I missed you.');
  assert.equal(ctx.drop('Good night.', en), 'Good night.', '干净的英文原样通过');
  // 整句都是中文时不能清空：清完没有英文就退回原文，宁可念错也不能静音
  assert.equal(ctx.drop('我想你了。', en), '我想你了。');
  // 中文角色完全不碰
  assert.equal(ctx.drop('我想你了。', { voice: { lang: 'zh' } }), '我想你了。');
  // 粤语和日语用汉字，必须排除在外
  assert.equal(ctx.drop('我好掛住你呀。', { voice: { lang: '粤' } }), '我好掛住你呀。');
  assert.equal(ctx.drop('君のことを考えてた。', { voice: { lang: '日' } }), '君のことを考えてた。');
  // 韩语里混进的中文同样要清掉
  assert.equal(ctx.drop('보고 싶었어, 宝贝.', { voice: { lang: '韩' } }), '보고 싶었어.');
});

test('语言锁挂在 ttsArr 上，覆盖所有语音入口（含不走 pickSpoken 的微信语音消息）', () => {
  assert.match(app, /async function ttsArr\(text,o,opt\)\{opt=Object\.assign\(\{\},opt\|\|\{\}\);text=ttsDropOffLanguage\(text,o\);/);
  assert.match(app, /function warmVoiceMsg\(m,o\)/);
  assert.ok(app.includes('await ttsArr(m.content,o,{cue:m.voiceCue})'), '微信语音消息仍然直接把正文交给 ttsArr');
});
