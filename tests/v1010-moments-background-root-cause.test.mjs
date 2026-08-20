import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const edge = fs.readFileSync(new URL('../supabase/functions/phone-role-push/index.ts', import.meta.url), 'utf8');

function functionSource(name) {
  const start = edge.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `missing ${name}`);
  const brace = edge.indexOf('{', start);
  let depth = 0, quote = '', escaped = false;
  for (let i = brace; i < edge.length; i += 1) {
    const ch = edge[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth += 1;
    else if (ch === '}' && --depth === 0) return edge.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

test('server strips copied date, speaker and nickname wrappers from generated messages', () => {
  const source = functionSource('roleNormalizeGeneratedText')
    .replace('value: string, roleName = ""', 'value, roleName = ""');
  const normalize = Function(`${source}; return roleNormalizeGeneratedText;`)();
  assert.equal(
    normalize('2026年8月20日 15:27 先生^^：[图片|一张整洁冷硬的医院办公桌]', '先生^^'),
    '[图片|一张整洁冷硬的医院办公桌]',
  );
  assert.equal(normalize('先生^^：给你点了燕麦牛奶粥。', '先生^^'), '给你点了燕麦牛奶粥。');
  assert.match(edge, /roleMessageParts\(normalizedText, messageMax\)/);
});

test('an already-sent APNs dedupe row completes a background retry idempotently', () => {
  const persist = functionSource('persistAndPush');
  assert.match(persist, /if \(!row\?\.id\) return false;[\s\S]*if \(row\.push_status === "sent"\) return true;/);
  assert.doesNotMatch(persist, /row\.push_status === "sent"\) return false/);
});
