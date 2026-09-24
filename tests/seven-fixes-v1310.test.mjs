import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const PRIVATE = '../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/';
const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const priv = readFileSync(new URL(PRIVATE + 'app.js', import.meta.url), 'utf8');
const shells = [
  readFileSync(new URL('../小手机.html', import.meta.url), 'utf8'),
  readFileSync(new URL(PRIVATE + '小手机.html', import.meta.url), 'utf8'),
  readFileSync(new URL(PRIVATE + 'index.html', import.meta.url), 'utf8'),
];
const src = (text, name) => {
  const lines = text.split('\n');
  const i = lines.findIndex(x => x.startsWith(`function ${name}(`) || x.startsWith(`async function ${name}(`));
  assert.ok(i >= 0, `找不到 ${name}`);
  let depth = 0; const out = [];
  for (let j = i; j < lines.length; j++) {
    out.push(lines[j]);
    for (const ch of lines[j]) { if (ch === '{') depth++; else if (ch === '}') depth--; }
    if (depth <= 0 && j > i) break;
    if (depth <= 0 && j === i && /\}$/.test(lines[j])) break;
  }
  return out.join('\n');
};

test('朋友圈回复别人的评论不再用 @ 这个标志', () => {
  /* 她说「之前那个朋友圈艾特 @ 的那个要去掉，不要那个标志了」。
     微信自己回复评论写的是「某某回复某某：」，这里照微信来。 */
  for (const fn of ['momentCommentLine', 'momentSocialHTML']) {
    const s = src(app, fn);
    assert.equal(/ @<b>/.test(s), false, fn + ' 里那个 @ 标志又回来了');
  }
  assert.match(src(app, 'momentCommentLine'), /<span class="cmt-re">回复<\/span><b>\$\{esc\(cm\.replyToName\)\}<\/b>/);
  assert.match(src(app, 'momentSocialHTML'), /<span class="cmt-re">回复<\/span>/);
  /* 光写 /\.cmt-re\{/ 太松：'.wx-role-detail-social .cmt-re{' 里也含这一段，
     把独立那条改坏了照样能匹配上。这里盯的是独立那条本身。 */
  for (const s of shells) assert.match(s, /\n\.cmt-re\{color:/, '少了「回复」两个字的样式');
});

test('设了每天一封信就只写一封：先占坑再写，写失败再退回去', () => {
  /* 她说「明明设置的每天一封信，角色一天写了两三封」。
     原来是写成了才记账：genLetter 里先把信塞进 S.mail 又 save() 一次，回来之后才
     pc.n++ 再 save() 一次——两次分开的防抖保存。中间她一退出或 App 被系统回收，
     信留下了、计数没留下，下次开机又写一封。 */
  for (const [text, label] of [[app, '网页版'], [priv, '私人版']]) {
    const s = src(text, 'scanMail');
    assert.match(s, /const prevLast=pc\.last;pc\.n\+\+;pc\.last=Date\.now\(\);save\(0\);/,
      label + '：要先把这一封记进计数并立刻落盘');
    /* 占坑必须在发起生成【之前】，不然等于没改 */
    assert.ok(s.indexOf('pc.n++') < s.indexOf('genLetter(c.id)'),
      label + '：占坑跑到生成后面去了，那还是老毛病');
    assert.match(s, /live\.n--;live\.last=prevLast;save\(\);/, label + '：写失败要把坑退回去');
    assert.match(s, /const live=S\._mailCount&&S\._mailCount\[c\.id\]/,
      label + '：退坑要重新从 S 取，因为云恢复可能把整个 S 换掉了');
    assert.match(s, /if\(pc\.n>=c\.mailPerDay\|\|_mailBusy\[c\.id\]\)/, label + '：上限判断不能丢');
  }
});

test('不许角色替她把还没发生的事演完', () => {
  /* 她说「线上我跟他说和他一起看动画片，他直接说已经看完了该睡觉，
     这就是直接跳过环节了，角色自己把事情预演了一遍」 */
  for (const x of [app, priv]) {
    assert.match(x, /不许替'\+S\.me\.name\+'把还没发生的事演完/, '规则没进提示词');
    assert.match(x, /只能回应【此刻这一步】/, '要说清只能走当下这一步');
    assert.match(x, /一起看动画片，你就说看完了该睡了/, '得把她碰到的那个例子摆出来');
    assert.match(x, /在ta真的和你一句一句经历过之前，都还没有发生/, '要讲清为什么这算编造');
    assert.match(x, /不要凭空断定ta做了什么、去了哪里、吃了什么、和谁在一起/, '顺带堵住凭空断定');
  }
});

test('通话里的动作描写永远是中文', () => {
  /* 她说「打电话打久了就容易出现动态描写变成英文，类似于【I love you too】」。
     两处语言检查都【明确跳过】动作行（callBadForeignLine 和 callDrifted 里都写着
     callIsActionLine 就 return false），所以动作行一直没人管。 */
  const f = src(app, 'callActionLineForeign');
  assert.match(f, /if\(\/\[ぁ-んァ-ヶ가-힣\]\/\.test\(inner\)\)return true;/,
    '日文里也有汉字，只看汉字会把日文动作当中文放过去——假名谚文要先判');
  assert.ok(f.indexOf('ぁ-ん') < f.indexOf('hasCN(inner)'), '假名判断必须在汉字判断前面');
  assert.match(f, /if\(hasCN\(inner\)\)return false;/, '中文动作不能误伤');
  const strip = src(app, 'callStripForeignActions');
  assert.match(strip, /callIsActionLine\(l\)&&callActionLineForeign\(l\)/, '只丢动作行，不碰台词');
  assert.match(strip, /return \(kept\.length\?kept:rows\)\.join/,
    '整条只有一个外文动作时不能清空，留着让 ensureVideoCallAction 去补中文的');
  for (const x of [app, priv])
    assert.match(x, /content=callStripForeignActions\(content\);if\(!_rawOutput&&video\)content=ensureVideoCallAction/,
      '要挂在通话回复的处理链上，而且排在补中文动作之前');
});

test('在后台说话不该报成「网络连接中断」', () => {
  /* 她说「打电话退到后台，在浮框里跟他说话，会弹一个网络问题让我重试，
     他是在我发出去的瞬间就弹出来的，正常识别也不可能识别这么快」。
     不是网络的事：页面在后台被系统掐了。原来只认「请求进行当中才切后台」，
     她是【本来就在后台】，切后台的时间戳远早于这次请求，所以判不出来。 */
  const f = src(app, 'callBackgroundInterrupted');
  assert.match(f, /if\(typeof document!=='undefined'&&document\.hidden\)return true;/,
    '「现在就还在后台」这一种要认');
  assert.match(f, /return mark>=now-elapsed-3000;/, '原来那种「请求中途切后台」也得继续认');
  assert.match(f, /if\(!mark\|\|mark>now\)return false;/, '从来没切过后台就别乱认');
  assert.match(src(app, 'callFailureText'), /callBackgroundInterrupted\(e,hiddenMark\)\)return'\(刚才小手机切到后台了/);
});

test('地图跟着人物资料里的城市走', () => {
  /* 她说「已经在个人资料里改成苏州了，点开地图还是定位在之前的伦敦」。
     原来把 city、人设、签名、职业拼成一大段再找【最长的那个别名】：
     人设里留着 London（6 个字母）就压过 city 里的「苏州」（2 个字）。 */
  const m = src(app, 'liveLocMatch');
  assert.match(m, /return best;/, '这个只负责认，认不出就返回 null，不许兜底');
  assert.equal(/fallback/.test(m), false, '一兜底就分不清「认出来了」和「没认出来」');
  const role = src(app, 'roleLiveLoc');
  assert.match(role, /liveLocMatch\(hint\)\|\|liveLocMatch\(c\.city\)\|\|liveLocMatch\(charHomeCity\(c\)\)\|\|liveLocCity\(/,
    '优先级：他这次真的分享的位置 > 资料里的城市 > 其余文字里猜');
  assert.ok(role.indexOf('liveLocMatch(c.city)') < role.indexOf('liveLocCity('),
    '资料里的城市必须排在「整段文字里猜」前面');
  const me = src(app, 'meLiveLoc');
  assert.match(me, /\(fresh&&liveLocMatch\(geo\.city\)\)\|\|liveLocMatch\(S\.me&&S\.me\.city\)\|\|liveLocCity\(/,
    '我这边同理：真实定位 > 我资料里的城市 > 猜');
  for (const x of [app, priv]) assert.ok(x.includes('function liveLocMatch('), '私人版少了这个');
});
