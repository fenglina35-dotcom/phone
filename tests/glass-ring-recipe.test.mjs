import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* 她说「你能不能把这个方法写入，以后再想弄的时候就不用来回调整」。
   做法写在 docs/maintenance/液态玻璃_磨砂加细高光_做法.md，
   环的 clip-path 由 scripts/glass_ring_polygon.py 生成。
   这条测试卡住两件事：
   ① 三个壳子里的 clip-path 必须真的是那个脚本生成的（不许手改数值，
      否则下次照文档跑一遍脚本，生成的东西和线上对不上）；
   ② 文档和脚本不许被删掉。 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(root, 'scripts', 'glass_ring_polygon.py');
const recipe = path.join(root, 'docs', 'maintenance', '液态玻璃_磨砂加细高光_做法.md');

test('做法和生成脚本都还在', () => {
  assert.ok(fs.existsSync(script), '生成脚本没了，下次又要从头调');
  assert.ok(fs.existsSync(recipe), '做法文档没了');
  const text = fs.readFileSync(recipe, 'utf8');
  assert.match(text, /铺满整块形状的白[^\n]*backdrop-filter/, '最关键那条规矩要写在里面');
  assert.match(text, /scripts\/glass_ring_polygon\.py/, '要指向生成脚本');
  assert.match(text, /mask-composite:exclude/, '圆角矩形那套也要写进去');
});

test('三个壳子里的 clip-path 就是脚本生成的那四条', () => {
  const out = execFileSync(process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3'), [script, '--check'], { cwd: root, encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
  assert.match(out, /都是这个脚本生成的/, out);
});

test('描边的粗细还是她认可的 0.75px', () => {
  const src = fs.readFileSync(script, 'utf8');
  const inset = parseFloat(src.match(/^INSET = ([\d.]+)/m)[1]);
  assert.equal(inset, 0.75, '她说过高光要细；0.75 是她确认「非常好」的那一版');
  const tail = parseFloat(src.match(/^TH = ([\d.]+)/m)[1]);
  assert.ok(tail <= 11, `尾巴高 ${tail}px，她说过要瘦一点小一点`);
});
