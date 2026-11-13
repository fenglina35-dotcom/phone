// scripts/bump_version.py：发布时把版本号各加 1 的工具。只看不改地试跑，必须核对通过、不写任何文件。
import test from 'node:test';
import assert from 'node:assert/strict';
import cp from 'node:child_process';

const run = (args) => cp.spawnSync('python3', ['scripts/bump_version.py', ...args], { encoding: 'utf8' });
const status = () => cp.execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' });
const ver = (text) => (String(text).match(/const APP_VER='v(\d+) /) || [])[1];
// 发布进行到一半（版本号刚升、还没提交）时，工具按设计会拒绝再升一次，这两项跳过
const midRelease = ver(cp.execFileSync('git', ['show', 'HEAD:app.js'], { encoding: 'utf8', maxBuffer: 64e6 })) !== ver(cp.execFileSync('cat', ['app.js'], { encoding: 'utf8', maxBuffer: 64e6 }));

test('web-only guard marking preserves private pending releases', () => {
  const r = cp.spawnSync('python3', ['-c', `import runpy
f = runpy.run_path('scripts/bump_version.py')['mark_pending_guards']
source = '\\n'.join('{release:"pending",scope:"%s"}' % scope for scope in ['web', 'private', 'both'])
web = f(source, 'web fixture', True)
assert web.count('release:"pending"') == 1
assert '{release:"pending",scope:"private"}' in web
assert web.count('release:"web fixture"') == 2
assert 'release:"pending"' not in f(source, 'full fixture', False)
`], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('a full bump dry-run finds the last release, passes its own checks and writes nothing', { skip: midRelease && '版本号已升、还没提交' }, () => {
  const before = status();
  const r = run(['--label', '测试', '--dry-run']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /照着这次提交改：/);
  assert.match(r.stdout, /project\.pbxproj/);
  assert.match(r.stdout, /\sapp\.js\n/, '完整升版包含网页当前版本');
  assert.match(r.stdout, /PhoneWeb\.bundle\/app\.js/, '网页独立发布后仍能找到私人版升版模板');
  assert.match(r.stdout, /只看不改：没有写任何文件。/);
  assert.equal(status(), before);
});

test('a web-only bump dry-run leaves every private and iOS file alone', { skip: midRelease && '版本号已升、还没提交' }, () => {
  const r = run(['--label', '测试', '--web-only', '--dry-run']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.doesNotMatch(r.stdout, /\snative\//);
  assert.match(r.stdout, /私人 v(\d+) \/ iOS (\d+)　→　网页 v\d+ \/ 私人 v\1 \/ iOS \2/);
});

test('full bump changes each APP_VER once when private next equals old web', () => {
 const r=cp.spawnSync('python3',['-c',`import ast,types
+from pathlib import Path
+from types import SimpleNamespace
+import re
+tree=ast.parse(Path('scripts/bump_version.py').read_text())
+main=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='main')
+tr=next(n for n in main.body if isinstance(n,ast.FunctionDef) and n.name=='tr')
+scope=dict(re=re,web=100,priv=99,ios=20,nw=101,np_=100,ni=21,web_label='web',priv_label='private',a=SimpleNamespace(web_only=False,label='new'))
+exec(compile(ast.Module(body=[tr],type_ignores=[]),'bump-tr','exec'),scope)
+f=scope['tr']
+assert f("const APP_VER='v100 · web';")=="const APP_VER='v101 · new';"
+assert f("const APP_VER='v99 · private';")=="const APP_VER='v100 · new';"
+`.replace(/^\+/gm,'')],{encoding:'utf8'});
 assert.equal(r.status,0,r.stdout+r.stderr);
});
