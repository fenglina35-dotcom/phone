// 两个 app.js 都由 src/app 拼出来（scripts/build_app.py）。直接改了 app.js、没改 src/app，这里会失败。
import test from 'node:test';
import assert from 'node:assert/strict';
import cp from 'node:child_process';

test('both app.js files are exactly what src/app builds', () => {
  const r = cp.spawnSync('python3', ['scripts/build_app.py', '--check'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('a marker section in src/app is always closed and never nested', () => {
  const fs = cp.execFileSync('ls', ['src/app'], { encoding: 'utf8' }).split('\n').filter((f) => f.endsWith('.js'));
  for (const f of fs) {
    let state = 'both';
    const lines = cp.execFileSync('cat', ['src/app/' + f], { encoding: 'utf8', maxBuffer: 64e6 }).split('\n');
    lines.forEach((line, i) => {
      if (line === '//@@ web' || line === '//@@ private') { assert.ok(state === 'both' || (state === 'web' && line === '//@@ private'), f + ':' + (i + 1) + ' 标记顺序不对'); state = line.slice(5); }
      else if (line === '//@@ end') { assert.notEqual(state, 'both', f + ':' + (i + 1) + ' 多余的 //@@ end'); state = 'both'; }
    });
    assert.equal(state, 'both', f + ' 有没收尾的标记');
  }
});
