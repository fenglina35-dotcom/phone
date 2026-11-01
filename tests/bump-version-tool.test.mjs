// scripts/bump_version.py：发布时把版本号各加 1 的工具。只看不改地试跑，必须核对通过、不写任何文件。
import test from 'node:test';
import assert from 'node:assert/strict';
import cp from 'node:child_process';

const run = (args) => cp.spawnSync('python3', ['scripts/bump_version.py', ...args], { encoding: 'utf8' });
const status = () => cp.execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' });
const ver = (text) => (String(text).match(/const APP_VER='v(\d+) /) || [])[1];
// 发布进行到一半（版本号刚升、还没提交）时，工具按设计会拒绝再升一次，这两项跳过
const midRelease = ver(cp.execFileSync('git', ['show', 'HEAD:app.js'], { encoding: 'utf8', maxBuffer: 64e6 })) !== ver(cp.execFileSync('cat', ['app.js'], { encoding: 'utf8', maxBuffer: 64e6 }));

test('a full bump dry-run finds the last release, passes its own checks and writes nothing', { skip: midRelease && '版本号已升、还没提交' }, () => {
  const before = status();
  const r = run(['--label', '测试', '--dry-run']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /照着这次提交改：/);
  assert.match(r.stdout, /project\.pbxproj/);
  assert.match(r.stdout, /只看不改：没有写任何文件。/);
  assert.equal(status(), before);
});

test('a web-only bump dry-run leaves every private and iOS file alone', { skip: midRelease && '版本号已升、还没提交' }, () => {
  const r = run(['--label', '测试', '--web-only', '--dry-run']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.doesNotMatch(r.stdout, /\snative\//);
  assert.match(r.stdout, /私人 v(\d+) \/ iOS (\d+)　→　网页 v\d+ \/ 私人 v\1 \/ iOS \2/);
});
