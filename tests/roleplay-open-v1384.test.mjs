import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// v1384 角色扮演点开提示「这个红包找不到了」：红包的 rpOpen(scope,key,mid) 和角色扮演的 rpOpen(id) 同名，后者被覆盖。
for (const [label, path] of [['web', '../app.js'], ['private', '../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js']]) {
  test(label + ': role play and red packets have their own open functions', () => {
    const app = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
    const names = [...app.matchAll(/^(?:async )?function ([A-Za-z0-9_$]+)\(/gm)].map(m => m[1]);
    assert.equal(names.filter(n => n === 'rpOpen').length, 1, 'only the role-play rpOpen(id) remains');
    assert.match(app, /^function rpOpen\(id\)\{const d=rpData\(id\);/m);
    assert.match(app, /^function redpOpen\(scope,key,mid\)\{const r=rpResolve\(scope,key,mid\);/m);
    assert.doesNotMatch(app, /[^d]rpOpen\('(?:pf|group|role)'/, 'red packet cards call redpOpen');
  });
}
