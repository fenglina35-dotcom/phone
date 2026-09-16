import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

function functionSource(name) {
  const match = app.match(new RegExp(`\\n(?:async )?function ${name}\\(`));
  assert.ok(match, `missing ${name}`);
  const start = match.index + 1;
  let depth = 0, quote = '', escaped = false;
  for (let i = app.indexOf('{', start); i < app.length; i += 1) {
    const char = app[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') quote = char;
    else if (char === '{') depth += 1;
    else if (char === '}' && --depth === 0) return app.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

test('① a full backup skips unreadable images instead of aborting', () => {
  const blob = functionSource('fullBackupFileBlob');
  assert.doesNotMatch(blob, /throw new Error\('有备份图片暂时无法读取/, '坏图不能再中止整份备份');
  assert.match(blob, /_fullBackupSkippedImages\.add\(key\)/);
  assert.match(blob, /const _fullBackupSkippedImages=new Set\(\)/, '计数是本次导出内的局部状态，不跨次累积');
  assert.match(functionSource('exportData'), /stats\.skippedImages/, '导出结果要如实告知跳过了几张');
  // 聊天存档本身仍然不允许缺失，那是正文不是配图。
  assert.match(blob, /throw new Error\('聊天存档暂时无法读取/);
});

test('② a missed scheduled phone check still runs later the same day', () => {
  const check = functionSource('checkSpyTime');
  assert.doesNotMatch(check, /sp\.time===hhmm/, '精确到分钟匹配会被后台节流整天错过');
  assert.match(check, /nowMin<toMin\(sp\.time\)/, '到点之后才补');
  assert.match(check, /sp\.timedDay===today/, '当天已经查过就不再重复');
  assert.match(check, /sp\.timedDay=today/, '当天标记要写进存档，刷新页面后不能重来');
  assert.match(check, /cohabOnlineQuiet\(c\.id\)/, '面对面时仍然不查岗');
});

test('③ group recall is offered for either side and the role can perceive it', () => {
  const menu = functionSource('gMsgMenu');
  assert.match(menu, /gRecallMsg\('\$\{gid\}','\$\{mid\}'\)/);
  assert.doesNotMatch(menu, /\$\{me\?`<button class="btn d"[^`]*gRecallMsg/, '撤回不再只对自己的消息开放');
  assert.match(functionSource('gmText'), /m\.type==='sys'\?String\(m\.content\|\|''\)/, '撤回行不能再喂成无意义的 [消息]');
  assert.match(app, /m\.type==='sys'\?'（'\+gmText\(m\)\+'）'/, '群记录里事件行与发言行要分开');
  assert.match(app, /撤回了一条消息」时，你只知道有人撤回了，看不到原内容，绝对不要编造/);
});

test('④ starting a new date archives an unfinished one instead of wiping it', () => {
  assert.match(functionSource('offBeginSession'), /offArchiveUnfinishedSession\(o\)/);
  const sandbox = { uid: () => 'u' + Math.random().toString(36).slice(2, 8), Date, Math, Number, String, Array, Object, S: { settings: {} } };
  vm.runInNewContext(
    [functionSource('offArchiveUnfinishedSession'), functionSource('offSummarySourceRows'), functionSource('offSummaryMode'), functionSource('offMemLabel')].join('\n'),
    sandbox,
  );
  const o = {
    session: 's1', startedAt: 1, loc: '咖啡馆', when: '2026-09-16 15:00', daypart: '下午', summaryCursor: 0,
    msgs: [
      { id: 'm0', who: '日期', text: '2026-09-16 下午 · 咖啡馆' },
      { id: 'm1', who: 'me', text: '今天好开心' },
      { id: 'm2', who: 'ta', text: '我也是' },
    ],
    history: [],
  };
  assert.equal(sandbox.offArchiveUnfinishedSession(o), true);
  assert.equal(o.history.length, 1);
  assert.deepEqual(o.history[0].msgs.map(m => m.id), ['m0', 'm1', 'm2'], '未结束的原始记录必须整段保留');
  assert.equal(o.history[0].loc, '咖啡馆');
  assert.ok(o.history[0].summaryError.includes('自动保留'));

  // 只有日期标记、没有真正内容时不该产生空归档。
  const empty = { session: 's2', msgs: [{ id: 'x', who: '日期', text: '标记' }], history: [] };
  assert.equal(sandbox.offArchiveUnfinishedSession(empty), false);
  assert.equal(empty.history.length, 0);
});

test('⑤ the role may call while living together but not face to face', () => {
  const incoming = functionSource('incomingCall');
  assert.doesNotMatch(incoming, /if\(cohabRestricted&&!opt\.requestedByUser\)return false;/, '共同生活不再一律挡掉角色来电');
  assert.match(incoming, /roleOnlineProactiveBlocked\(id\)&&!\(cohabRestricted&&opt\.requestedByUser\)/);
  // 面对面仍然安静：roleOnlineProactiveBlocked 里含 cohabOnlineQuiet，后者只在同处一室时为真。
  assert.match(functionSource('roleOnlineProactiveBlocked'), /cohabOnlineQuiet\(id\)/);
  assert.match(functionSource('cohabOnlineQuiet'), /cohabTogetherScene\(d\)/);
});

test('⑥ a fully English narration block is dropped locally, never regenerated', () => {
  const sandbox = {};
  vm.runInNewContext(functionSource('roleReplyDropEnglishNarration') + '\nglobalThis.drop=roleReplyDropEnglishNarration;', sandbox);
  const drop = sandbox.drop;
  assert.equal(drop('【slowly leaned forward, voice dropped】\n你今天怎么这么乖。'), '你今天怎么这么乖。');
  assert.equal(drop('【他缓缓凑近，声音压低】\n你今天怎么这么乖。'), '【他缓缓凑近，声音压低】\n你今天怎么这么乖。', '中文旁白不动');
  assert.equal(drop('【他笑着说 OK，然后靠过来】\n嗯。'), '【他笑着说 OK，然后靠过来】\n嗯。', '夹英文单词的中文旁白不动');
  assert.equal(drop('[内心|好想抱她]\n【他抬眼】\n过来。'), '[内心|好想抱她]\n【他抬眼】\n过来。', '隐藏标签不动');
  assert.equal(drop('【slowly leaned forward】'), '【slowly leaned forward】', '整条都是英文旁白时原样退回，交给纯英文拦截，不能产出空回复');
  assert.equal(drop('【he smiled】\n乖。\n【he leaned back】'), '乖。');

  // 判定挂在语言守卫上，而且不抛错，所以不会触发任何重新生成。
  const result = functionSource('chatResultText');
  assert.match(result, /text=roleReplyDropEnglishNarration\(text\)/);
  assert.match(result, /opt\.roleReplyLanguageGuard&&!\(opt\.roleVoiceFormatRepair/);
  assert.doesNotMatch(functionSource('roleReplyDropEnglishNarration'), /throw|chatAPI/);
  // 提示词层面同时堵住来源。
  assert.match(app, /动作行必须用中文写/);
  assert.match(app, /【】里的旁白必须用中文写/);
});
