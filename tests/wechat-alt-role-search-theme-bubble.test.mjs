import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const app = readFileSync(join(root, 'app.js'), 'utf8');
const privateApp = readFileSync(join(root, 'native', 'private-small-phone', 'XcodeProject', 'PhoneCompanionTest', 'PhoneWeb.bundle', 'app.js'), 'utf8');
const css = readFileSync(join(root, 'glass-theme.css'), 'utf8');
const privateCss = readFileSync(join(root, 'native', 'private-small-phone', 'XcodeProject', 'PhoneCompanionTest', 'PhoneWeb.bundle', 'glass-theme.css'), 'utf8');

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing ${name}`);
  let depth = 0;
  let opened = false;
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === '{') { depth += 1; opened = true; }
    if (source[i] === '}') {
      depth -= 1;
      if (opened && depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`unterminated ${name}`);
}

test('secondary account can find a role by WeChat ID or normalized phone number', () => {
  const sandbox = {
    S: {
      contacts: [
        { id: 'role_1', name: '先生', remark: '', wxid: 'Sir_WeChat_1025', phone: '138 6198-2698', deleted: false },
        { id: 'role_2', name: '已删除', wxid: 'gone_role', phone: '13900000000', deleted: true },
      ],
    },
  };
  vm.runInNewContext(
    `${functionSource(app, 'nfSearchNorm')}\n${functionSource(app, 'nfRoleSearchMatches')}\n` +
      'globalThis.findRoles=nfRoleSearchMatches;',
    sandbox,
  );
  assert.deepEqual(Array.from(sandbox.findRoles('sir_wechat_1025'), c => c.id), ['role_1']);
  assert.deepEqual(Array.from(sandbox.findRoles('13861982698'), c => c.id), ['role_1']);
  assert.deepEqual(Array.from(sandbox.findRoles('138-6198 2698'), c => c.id), ['role_1']);
  assert.deepEqual(Array.from(sandbox.findRoles('13900000000'), c => c.id), []);
});

test('adding a search result is scoped to the active secondary account', () => {
  const calls = [];
  const role = { id: 'role_1' };
  const sandbox = {
    getC: id => id === role.id ? role : null,
    isMain: () => false,
    addedHere: () => false,
    altAdd: id => calls.push(['altAdd', id]),
    openChat: id => calls.push(['openChat', id]),
  };
  vm.runInNewContext(`${functionSource(app, 'nfAddRole')};globalThis.addRole=nfAddRole;`, sandbox);
  sandbox.addRole('role_1');
  assert.deepEqual(calls, [['altAdd', 'role_1']]);
  assert.match(functionSource(app, 'altAdd'), /_added\[actId\(\)\]=true/);
});

test('incoming role bubble has no forced high-contrast outline', () => {
  const bubble = functionSource(app, 'bubbleLook');
  assert.match(bubble, /me\?bubbleReadableBorder\(bg\):'transparent'/);
  assert.ok(privateApp.includes(bubble), 'private App must use the same bubble renderer');
});

test('white theme empty search plus uses the light WeChat surface', () => {
  const rule = /\.wx-directory-page\.wxlight \.nf-empty i\{[^}]*background:#fff[^}]*color:#07c160[^}]*\}/;
  assert.match(css, rule);
  assert.match(privateCss, rule);
});

test('web and private App use the same role search implementation', () => {
  for (const name of ['nfSearchNorm', 'nfRoleSearchMatches', 'nfRoleSearchCard', 'nfAddRole', 'nfResultsHTML']) {
    assert.equal(functionSource(privateApp, name), functionSource(app, name), `${name} differs in private App`);
  }
});
