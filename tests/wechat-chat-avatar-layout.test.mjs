import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const web = fs.readFileSync(new URL('小手机.html', root), 'utf8');
const privateWeb = fs.readFileSync(new URL('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/小手机.html', root), 'utf8');

for (const [name, html] of [['web', web], ['private', privateWeb]]) {
  test(`${name} chat avatars are slightly larger and top aligned with multiline bubbles`, () => {
    assert.match(html, /\.msg\{[^}]*align-items:flex-start[^}]*\}/);
    assert.match(html, /\.msg \.avatar\{[^}]*width:42px[^}]*height:42px[^}]*flex-basis:42px[^}]*border-radius:8px[^}]*\}/);
    assert.match(html, /\.msg\.them \.bubble:before,\.msg\.me \.bubble:after\{[^}]*top:15px[^}]*width:8px[^}]*height:12px[^}]*background:inherit[^}]*\}/);
    assert.match(html, /\.msg\.them \.bubble:before\{[^}]*left:-5px[^}]*clip-path:polygon\(100% 0,100% 100%,0 50%\)[^}]*\}/);
    assert.match(html, /\.msg\.me \.bubble:after\{[^}]*right:-5px[^}]*clip-path:polygon\(0 0,100% 50%,0 100%\)[^}]*\}/);
  });
}

test('web and private chat avatar layout stay identical', () => {
  const rule = text => ({
    row: text.match(/\.msg\{[^}]*\}/)?.[0],
    avatar: text.match(/\.msg \.avatar\{[^}]*\}/)?.[0]
  });
  assert.deepEqual(rule(privateWeb), rule(web));
});
