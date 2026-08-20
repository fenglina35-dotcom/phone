import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);
const app = readFileSync(join(root, 'app.js'), 'utf8');
const html = readFileSync(join(root, '小手机.html'), 'utf8');

test('remote control always requires an explicit request and user choice', () => {
  assert.match(app, /\[申请远程操控\]/);
  assert.match(app, /function remoteControlRequest\(cid\)/);
  assert.match(app, /remoteControlDeny\('\$\{c\.id\}'\)/);
  assert.match(app, /remoteControlApprove\('\$\{c\.id\}'\)/);
  const request = app.match(/function remoteControlRequest\(cid\)[\s\S]*?(?=\nfunction remoteControlDeny)/)?.[0] || '';
  assert.doesNotMatch(request, /拒绝后不会获得任何内容|remote-consent-warning/);
});

test('remote control is exposed only through the bound couple space', () => {
  assert.match(app, /function remoteControlAllowed\(cid\)/);
  assert.match(app, /S\.couple&&S\.couple\.cid===cid/);
  assert.match(app, /!remoteControlAllowed\(cid\)/);
  assert.match(app, /id="cou_remote"/);
  assert.match(app, /允许 \$\{nm\} 发起远程操控申请/);
  const start=app.indexOf('function renderCouple()');
  const end=app.indexOf('function coupleWalletAuth()',start);
  const coupleUi=app.slice(start,end);
  assert.doesNotMatch(coupleUi,/每一次都会先弹出【同意 \/ 拒绝】/);
  assert.doesNotMatch(coupleUi,/不是苹果系统里的其他真实 App/);
  assert.match(coupleUi,/无需每次同意，允许 \$\{nm\} 直接接管/);
});

test('refusal never starts a session and produces a personality reaction', () => {
  const deny = app.match(/function remoteControlDeny\(cid\)[\s\S]*?(?=\nfunction remoteControlApprove\(cid\))/)?.[0] || '';
  assert.doesNotMatch(deny, /remoteControlSnapshot|remoteControlRun/);
  assert.match(deny, /status:'denied'/);
  assert.match(deny, /scheduleReply\(cid/);
  assert.match(deny, /绝对不能假装看到了/);
});

test('remote operations are allowlisted and destructive actions verify ownership', () => {
  assert.match(app, /REMOTE_ALLOWED_OPS=new Set\(\[/);
  for (const op of ['send_wechat', 'post_moment', 'delete_moment', 'post_x', 'delete_x', 'delete_douyin', 'lock_app']) {
    assert.match(app, new RegExp(`'${op}'`));
  }
  assert.match(app, /a\.op==='delete_moment'[\s\S]*?t\.authorId!=='me'/);
  assert.match(app, /a\.op==='delete_x'[\s\S]*?t\.who!=='me'/);
  assert.match(app, /a\.op==='delete_douyin'[\s\S]*?t\.cid!=='me'/);
  assert.doesNotMatch(app, /eval\s*\(|new Function\s*\(/);
});

test('live overlay blocks the phone while preserving an emergency stop', () => {
  assert.match(html, /id="remoteControlLayer"/);
  assert.match(html, /id="remoteRoleName"/);
  assert.match(html, /id="remoteCaption"/);
  assert.match(html, /<div class="remote-caption" id="remoteCaption"><\/div>/);
  assert.doesNotMatch(html, /id="remoteCaption">正在建立连接/);
  assert.match(html, /onclick="remoteControlStopByUser\(\)"/);
  assert.match(html, /\.remote-control-layer\{position:absolute;inset:0;z-index:550/);
  assert.match(html, /\.remote-live-dot\{[^}]*background:#ff2942/);
});

test('only one natural role subtitle is visible and navigation stays in the top progress label', () => {
  const remote = app.match(/let _remoteCtl[\s\S]*?(?=\/\/ ===== 他登录我的微信)/)?.[0] || '';
  assert.match(app, /function remoteControlCaptionMs\(t\)\{return Math\.max\(1800,Math\.min\(4200/);
  assert.doesNotMatch(remote, /SpeechSynthesisUtterance|speechSynthesis|remoteControlSpeak/);
  assert.match(app, /function remoteControlCaption\(say\)/);
  assert.match(app, /replaceChildrenCompat\(cap,b\)/);
  assert.doesNotMatch(remote, /cap\.appendChild\(b\);while\(cap\.children\.length>3\)/);
  assert.match(app, /function remoteControlStageCaption\(a,r\)/);
  assert.match(app, /function remoteControlClearCaption\(\)/);
  assert.match(app, /await sleep\(remoteControlCaptionMs\(line\)\);remoteControlClearCaption\(\)/);
  assert.doesNotMatch(remote, /remoteControlCaption\('我先在桌面上找一下/);
  assert.doesNotMatch(remote, /remoteControlCaption\('找到了，我现在打开/);
  assert.equal((remote.match(/remoteControlCaption\(/g)||[]).length,2,'only the caption function and role-line renderer may write the bottom bubble');
  assert.doesNotMatch(html, /remote-caption-bubble:nth-last-child/);
  const scene = app.match(/function remoteControlScene\(r,status,i,total,a\)[\s\S]*?(?=\nasync function remoteControlFocusViewedTarget)/)?.[0] || '';
  assert.match(scene, /app\.textContent=step\+\(status\|\|name\)\+' · LIVE'/);
  assert.doesNotMatch(scene, /remoteControlCaption\(/);
  assert.match(html, /\.remote-caption-bubble/);
  assert.match(html, /\.remote-caption-wrap\{[^}]*bottom:max\(20px,env\(safe-area-inset-bottom\)\)/);
  assert.match(html, /@keyframes remoteCaptionUp/);
  assert.match(app, /remoteControlRemember\(c,\{ts:Date\.now\(\),startedAt/);
  assert.match(app, /function remoteControlHistoryPrompt\(c\)/);
  assert.match(app, /'remoteControlHistory'/);
});

test('remote caption replacement and clearing work at runtime', () => {
  const replace = app.match(/function replaceChildrenCompat\(el,node\)\{[^\n]+\}/)?.[0] || '';
  const caption = app.match(/function remoteControlCaption\(say\)\{[^\n]+\}/)?.[0] || '';
  const clear = app.match(/function remoteControlClearCaption\(\)\{[^\n]+\}/)?.[0] || '';
  assert.ok(replace && caption && clear);
  const cap = {children: [], replaceChildren(...nodes){this.children=nodes;}};
  const document = {createElement(){return {className:'',textContent:''};}};
  const run = Function('$','document','cap',`${replace};${caption};${clear};remoteControlCaption('第一句');remoteControlCaption('第二句');const after=cap.children.map(x=>x.textContent);remoteControlClearCaption();return {after,count:cap.children.length};`);
  const result = run(sel=>sel==='#remoteCaption'?cap:null,document,cap);
  assert.deepEqual(result.after,['第二句']);
  assert.equal(result.count,0);
});

test('role opens the real small-phone pages and searches the current desktop layout', () => {
  assert.doesNotMatch(html, /class="remote-device"/);
  assert.match(html, /\.remote-control-layer\{[^}]*background:transparent/);
  assert.match(app, /function remoteControlSetPage\(p,params\)/);
  assert.match(app, /function remoteControlNavigate\(a,r\)/);
  assert.match(app, /function remoteControlDesktopPage\(key\)/);
  assert.match(app, /S\.me\.appLayout\[i\]\.indexOf\(key\)/);
  assert.match(app, /sw\.scrollTo\(\{left:sw\.clientWidth\*pg,behavior:'smooth'\}\)/);
  assert.match(app, /document\.querySelector\('\.app\[data-k="'\+key\+'"\]'\)/);
  assert.match(app, /await remoteControlOpenApp\(a,c\)/);
});

test('locking apps never opens settings and completion carries actual actions into a reliable event', () => {
  assert.match(app, /op==='lock_app'\|\|op==='unlock_app'\?'home'/);
  assert.match(app, /a\.op==='lock_app'\|\|a\.op==='unlock_app'\?'home'/);
  assert.match(app, /base\.app='home';base\.label='主屏幕'/);
  assert.match(app, /锁软件不需要也不允许打开普通设置页/);
  const finish = app.match(/async function remoteControlFinish\(reason\)[\s\S]*?(?=\n\/\/ ===== 他登录我的微信)/)?.[0] || '';
  assert.match(finish, /remoteControlCompletionDetail\(ctl,reason\)/);
  assert.match(finish, /scheduleFeatureReply\(c\.id,featureEventNote\('远程操控结束',detail\),120,resume\)/);
  assert.doesNotMatch(finish, /delayedAccountReply/);
  const detail = app.match(/function remoteControlCompletionDetail\(ctl,reason\)[\s\S]*?(?=\nasync function remoteControlFinish)/)?.[0] || '';
  assert.match(detail, /a\.memory\|\|a\.detail/);
  assert.match(detail, /失败、未执行或记录外的操作/);
  assert.match(detail, /绝不能装作不知道自己刚做了什么/);
  assert.doesNotMatch(detail, /随机选择话题/);
});

test('X and Weibo posting, deletion and likes are part of the control plan', () => {
  assert.match(app, /post_x/);
  assert.match(app, /delete_x/);
  assert.match(app, /toggle_x_like/);
  assert.match(app, /推特\|微博\|X/);
  assert.match(app, /x:'X \/ 微博'/);
  assert.match(app, /发布微博 \/ X/);
  assert.match(app, /delete_x_dm/);
  assert.match(app, /delete_douyin_dm/);
});
