import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// v1376 名片换成真实微信的简约样式；多人剧场「对谁说」透明磨砂、先打字再选人也按选的人先接话、微信来客也能点一下出一句。
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../小手机.html', import.meta.url), 'utf8');
const theater = fs.readFileSync(new URL('../cohab-theater.js', import.meta.url), 'utf8');

test('name cards look like WeChat: dark grey in the dark theme, white in the light theme', () => {
  const i = app.indexOf("if(m.type==='namecard'){const his=m.dir==='his';");
  const body = app.slice(i, app.indexOf("if(m.type==='weblink'&&m.webShare)", i));
  assert.match(body, /class="card wxcard"/);
  assert.match(body, /<span>个人名片<\/span>/);
  assert.match(body, /addHisCard\('\$\{m\.id\}'\)/, 'his recommended card can still be accepted');
  assert.doesNotMatch(body, /#13361f/, 'the old green card is gone');
  assert.match(html, /\.card\.wxcard\{width:240px;border-radius:6px;background:#2c2c2c/);
  assert.match(html, /\.wxlight \.card\.wxcard\{background:#fff\}/);
});

test('changing who I talk to before tapping reply retargets the pending lines', () => {
  const fn = theater.slice(theater.indexOf('function cohabTheaterAddress('), theater.indexOf('window.cohabTheaterAddress'));
  assert.match(fn, /start=offlinePendingStart\(rows\);if\(start>=0\)rows\.slice\(start\)\.forEach\(m=>\{if\(theaterActorKind\(m\)==='me'&&m\.who!=='旁白'&&m\.addressTo\)\{m\.addressTo=t\.addressTo;/);
});

test('guest lines wait for a tap like the host, and the target pill is frosted glass', () => {
  assert.match(theater, /if\(i<list\.length-1&&typeof cohabTapOn==='function'&&cohabTapOn\(d\)\)cohabTapWait\(id,item,timing\)\.then\(resolve\)/);
  assert.match(html, /\.offstage:not\(\.off-classic\) \.cohab-theater-target select\{border:0;background:rgba\(120,122,132,\.34\)/);
});
