import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const web = fs.readFileSync(new URL('小手机.html', root), 'utf8');
const privateWeb = fs.readFileSync(new URL('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/小手机.html', root), 'utf8');

for (const [name, html] of [['web', web], ['private', privateWeb]]) {
  test(`${name} chat avatars are slightly larger and centered with the bubble`, () => {
    assert.match(html, /\.msg\{[^}]*align-items:center[^}]*\}/);
    assert.match(html, /\.msg \.avatar\{[^}]*width:42px[^}]*height:42px[^}]*flex-basis:42px[^}]*border-radius:8px[^}]*\}/);
  });
}

test('web and private chat avatar layout stay identical', () => {
  const rule = text => ({
    row: text.match(/\.msg\{[^}]*\}/)?.[0],
    avatar: text.match(/\.msg \.avatar\{[^}]*\}/)?.[0]
  });
  assert.deepEqual(rule(privateWeb), rule(web));
});
