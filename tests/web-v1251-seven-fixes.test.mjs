import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const line = name => {
  const found = app.split('\n').find(l => l.startsWith(`function ${name}(`) || l.startsWith(`async function ${name}(`));
  assert.ok(found, `missing ${name}`);
  return found;
};

test('①②⑥ every stored-image surface resolves the idb reference before painting', () => {
  // 存档压缩会把大图就地换成 'idb:键'。任何直接把它塞进 img/url() 的地方都会画成破图或纯黑，
  // 而毛玻璃组件下面一旦没有壁纸，就会连带变成黑块。
  assert.match(app, /const stk=storedImageDisplaySource\(m\.img\);/, '微信单聊表情包');
  assert.match(app, /\$\{isImg\(stk\)\?`<img src="\$\{stk\}">`:''\}/);
  assert.match(app, /const bg=storedImageDisplaySource\(S\.me\.lockBg\|\|S\.me\.homeBg\|\|''\)/, '锁屏壁纸');
  assert.match(app, /\$\{isImg\(bg\)\?'background-image:url\('\+bg\+'\);':''\}/);
  assert.match(app, /storedImageDisplaySource\(S\.me\.homeBg\)/, '主屏壁纸');
  assert.match(app, /isImg\(storedImageDisplaySource\(photo\)\)/, '主屏自定义照片组件');
  assert.match(app, /isImg\(storedImageDisplaySource\(img\)\)/, '朋友圈动态配图');
  assert.match(app, /isImg\(storedImageDisplaySource\(cover\)\)/, '朋友圈封面');
  // 不能再出现"直接把状态里的图片塞进 src"的写法
  assert.match(app, /isImg\(storedImageDisplaySource\(m\.img\)\)/, '群聊表情包');
  assert.doesNotMatch(app, /stickermsg"><img src="\$\{m\.img\}">/, '不能再有不做还原就直接渲染的表情包');
  assert.doesNotMatch(app, /\$\{S\.me\.homeBg\?'background:url\('\+S\.me\.homeBg/);
});

test('③ the role is told who sent the friend request, per origin', () => {
  const sandbox = { S: { me: { name: 'North' } }, fmtDT: () => '9月16日', fmtDur: () => '2分钟', Date, String };
  vm.runInNewContext(line('friendOriginPrompt') + '\nglobalThis.p=friendOriginPrompt;', sandbox);
  const now = Date.now();
  const nearby = sandbox.p({ friendOrigin: { kind: 'nearby', source: '附近的人', acceptedAt: now } });
  assert.match(nearby, /主动发来好友申请，你同意了/, '附近的人是用户发起的');
  assert.match(nearby, /绝不能说成你申请加ta、或你终于等到ta通过/);
  assert.match(nearby, /刚同意ta的申请的/);
  const created = sandbox.p({ friendOrigin: { kind: 'created', source: 'AI 生成角色', intent: '想认识你', requestMsg: '你好', acceptedAt: now } });
  assert.match(created, /你最初通过「AI 生成角色」申请添加North/, '角色自己申请的方向不变');
  assert.match(created, /刚被通过的/);
});

test('④ a stranger who dialed out is told so and must not ask who is calling', () => {
  const reply = line('phSimReply');
  assert.match(reply, /这通电话是你自己拨给'\+S\.me\.name\+'的/);
  assert.match(reply, /绝对不要反问“你是谁”“你哪位”/);
  assert.match(reply, /只有当你确实打错了号码、需要核对时才可以问一次/);
  // 反过来：用户拨给陌生人时，对方本来就不认识来电者
  assert.match(reply, /这通电话是'\+S\.me\.name\+'拨给你的，你是接听方/);
  assert.match(reply, /c\.dir==='in'\?/, '按真实来电方向分支，而不是写死');
});

test('⑤ the notebook records everyday life yet still refuses fabrication and misattribution', () => {
  const prompt = line('lifeNoteModelPrompt');
  assert.match(prompt, /记不记、记哪一条，完全由你自己判断/, '由角色自己决定，不做成机械规则');
  assert.match(prompt, /喜好和习惯、在意或讨厌的东西/, '说清这个本子是用来记什么的');
  assert.doesNotMatch(prompt, /类型只能写/, '不再限定只能记情绪和约定');
  assert.match(prompt, /S\.couple\.cid!==c\.id\)return''/, '仍然只有恋人角色会记');

  const sandbox = { S: { me: { name: 'North' } }, String, RegExp, aboutMeNoteText: v => String(v || ''), memoryCandidateGrounded: () => true };
  vm.runInNewContext(line('lifeNoteCandidateValid') + '\nglobalThis.v=lifeNoteCandidateValid;', sandbox);
  const c = { name: '先生' }, ok = (t, u, e, vis = '') => sandbox.v(c, t, u, e, '', vis);

  // 日常生活：以前几乎全被挡掉，现在应当记得下
  assert.equal(ok('North喜欢在下雨天窝在床上听歌', '我下雨天就想窝床上听歌', '下雨天'), true);
  assert.equal(ok('North习惯熬到凌晨才肯睡', '我又熬到三点', '熬到三点'), true);
  assert.equal(ok('North的生日是农历四月十四', '我生日是农历四月十四', '农历四月十四'), true);
  assert.equal(ok('North今天被同事说了几句，心里不太舒服', '同事今天说我几句，有点不舒服', '说我几句'), true);

  // 仍然要挡住的
  assert.equal(ok('我今天很累', '我今天很累', '今天很累'), false, '照搬原话');
  assert.equal(ok('North养了一只叫米香的猫', '今天天气不错', '米香'), false, '依据不在本轮对话里');
  assert.equal(ok('North说她其实是因为', '我其实是因为', '其实是因为'), false, '断句');
  assert.equal(ok('我答应她周末陪她去甜品店', '你能答应周末陪我吗？', '你能答应周末陪我吗？', '嗯……再看吧。'), false, '只是问，不算答应');
  assert.equal(ok('我答应她周末陪她去那家甜品店', '周末陪我去甜品店好不好', '我答应你，周末陪你去那家甜品店', '好，我答应你，周末陪你去那家甜品店。'), true, '真的答应了就该记下');
});

test('⑦ a native request cannot hang the backup forever', async () => {
  const src = line('privatePhoneAccountCall');
  assert.match(src, /NATIVE_TIMEOUT/);
  const sandbox = {
    Promise, Error, Math, Number, String, setTimeout, clearTimeout,
    privatePhoneAccountAvailable: () => true,
    window: { SmallPhoneNative: { request: () => new Promise(() => {}) } },
  };
  vm.runInNewContext(src + '\nglobalThis.call=privatePhoneAccountCall;', sandbox);
  const started = Date.now();
  await assert.rejects(sandbox.call('account.backup.chunk', {}, 5000), e => {
    assert.equal(e.code, 'NATIVE_TIMEOUT');
    assert.match(e.message, /没有回应/);
    return true;
  });
  assert.ok(Date.now() - started >= 4500, '必须真的等到超时才中断');

  // 正常回应不受影响
  sandbox.window.SmallPhoneNative.request = () => Promise.resolve({ ok: true });
  assert.deepEqual(await sandbox.call('account.status', {}), { ok: true });
});
