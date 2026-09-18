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
/* 工程里绝大多数函数写在一行，但这几个页面函数带模板字面量、跨了好几行，
   所以按「下一个顶格声明」来切块，而不是只取第一行。 */
const source = name => {
  const i = lines.findIndex(x => x.startsWith(`function ${name}(`) || x.startsWith(`async function ${name}(`));
  assert.ok(i >= 0, `找不到 ${name}`);
  let j = i + 1;
  while (j < lines.length && !/^(async function |function |let |const |\/\*)/.test(lines[j])) j++;
  return lines.slice(i, j).join('\n');
};

/* 这四页是照着真实抖音做的仿真页面：编辑资料、主页访客、作品详情（漂浮弹幕）、
   底部弹出的评论区。页面里不预置任何人的文字，昵称简介一律由用户自己填。 */

test('the profile shell routes to all four new pages', () => {
  for (const f of ['dyEditView', 'dyVisitorsView', 'dyWorkView', 'dyCmSheet']) {
    assert.ok(app.includes(`function ${f}(`), `${f} 缺失`);
    assert.ok(priv.includes(`function ${f}(`), `私人版缺少 ${f}`);
  }
  const render = app.slice(app.indexOf('function renderDouyin()'), app.indexOf('function dyCmLayer()'));
  assert.match(render, /_dySub==='edit'\)return dyEditView\(\)/);
  assert.match(render, /_dySub==='visitors'\)return dyVisitorsView\(\)/);
  assert.match(render, /_dySub==='work'\)return dyWorkView\(\)/);
  assert.match(render, /dyCmLayer\(\)/, '评论区要能盖在任何一页上');
});

test('the edit page fills nothing in for her', () => {
  const src = app.slice(app.indexOf('function dyEditView()'), app.indexOf('function dyEditField('));
  assert.match(src, /资料完成度/);
  assert.match(src, /更换封面/);
  assert.match(src, /更换头像/);
  assert.doesNotMatch(src, /记录美好生活|恋人：/, '页面里不能预置任何人的简介');
  const rows = source('dyProfileRows');
  for (const label of ['名字', '简介', '性别', '生日', '所在地', '抖音号']) {
    assert.ok(rows.includes(label), `编辑页少了「${label}」这一行`);
  }
  assert.match(source('dyEditRow'), /暂不设置/, '没填的项照抖音显示「暂不设置」');
  assert.match(source('dyProfileDone'), /Math\.round\(got\/8\*100\)/);
});

test('a filled-in birthday drives the age shown on the profile', () => {
  const ctx = vm.createContext({});
  vm.runInContext(`${source('dyAgeFromBirth')};globalThis.f=dyAgeFromBirth;`, ctx);
  assert.equal(ctx.f(''), '');
  assert.equal(ctx.f('不是日期'), '');
  const y = new Date().getFullYear();
  assert.equal(ctx.f(`${y - 20}-01-01`), 20);
});

test('visitors come from her own world, never from invented names', () => {
  const src = source('dyVisitorSync');
  assert.match(src, /d\.following\|\|\[\]/, '关注过的角色会来看她的主页');
  assert.match(src, /d\.mine\|\|\[\]/, '在她作品下评论过的网友也会');
  assert.doesNotMatch(src, /chatAPI/, '访客列表不该再花一次模型调用');
  assert.match(source('dyVisitorRow'), /回关/);
  assert.match(source('dyVisitorsView'), /仅展示 30 天内已授权的访客，访客记录仅你可见/);
  assert.match(source('dyVisitorClear'), /S\.dy\.visitors=\[\]/, '访客记录可以自己清空');
});

test('the work page floats danmu over the video and keeps the rail', () => {
  const src = app.slice(app.indexOf('function dyWorkView()'), app.indexOf('/* ===== 抖音评论区'));
  assert.match(src, /\$\{dyWorkDanmu\(v\)\}\$\{dyWorkRail\(v\)\}/);
  const rail = app.slice(app.indexOf('function dyWorkRail('), app.indexOf('function dyStar('));
  for (const call of ['dyLike(', 'dyComments(', 'dyStar(', 'dyWorkMore(']) {
    assert.ok(rail.includes(call), `右侧操作栏少了 ${call}`);
  }
  assert.match(rail, /拍同款/);
  assert.match(src, /视频分析/);
  assert.match(html, /@keyframes dydm\{/, '弹幕要慢慢浮动');
});

test('the comment sheet slides up from the bottom and supports replies', () => {
  assert.match(source('dyComments'), /_dyCmOpen=true/, '点评论不再开弹窗，而是掀起底部面板');
  const sheet = app.slice(app.indexOf('function dyCmSheet('), app.indexOf('function dyCmAt('));
  assert.match(sheet, /dycm-mask/);
  assert.match(sheet, /有爱评论，说点儿好听的/);
  for (const t of ['评论', '赞', '收藏']) assert.ok(sheet.includes(`tab('${t}'`), `少了「${t}」这一栏`);
  assert.match(source('dyCmRow'), /展开 \$\{reps\.length\} 条回复/);
  assert.match(source('dyCmSend'), /host\.replies=host\.replies\|\|\[\]/, '回复要挂到被回复的那条下面');
  assert.match(source('dyCmRow'), /dycm-author">作者/);
  assert.match(html, /@keyframes dycmup\{/);
});

test('every shell carries the styles for the four pages', () => {
  for (const [name, css] of [['小手机.html', html], ['私人壳', shell], ['index.html', index]]) {
    for (const cls of ['.dyed-cover{', '.dyvi-row{', '.dywk-danmu{', '.dycm{']) {
      assert.ok(css.includes(cls), `${name} 少了 ${cls}`);
    }
  }
});
