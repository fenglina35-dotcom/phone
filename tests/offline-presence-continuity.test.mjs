import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const privateSource = fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js', import.meta.url), 'utf8');

function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `missing ${name}`);
  const brace = source.indexOf('{', start);
  let depth = 0, quote = '', escaped = false;
  for (let i = brace; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

const blockSource = functionSource('roleOnlineProactiveBlocked');
assert.match(blockSource, /offlineWechatLiveState\(c\)/, 'an active date must block ordinary proactive contact from persisted state, not only a focus pointer');
assert.match(blockSource, /cohabOnlineQuiet\(id\)/, 'home and together-away co-living states must pause ordinary proactive contact');
assert.match(functionSource('cohabDeliverOnlineMessage'), /msgs\(c\.id\)\.push\(m\)/, 'an explicit in-scene WeChat action remains available');

const eventInfo = Function(`return (${functionSource('offEndReplyEventInfo')})`)();
const replyMatches = Function(`return (${functionSource('offEndReplyMatches')})`)();
const event = eventInfo('[系统：你和小北刚结束在「江边」的这次线下见面，已经回到微信聊天。]');
assert.deepEqual(event, { loc: '江边' });
assert.equal(replyMatches(event, '你一整天都没回我，干嘛一直不理我？'), false, 'the old no-reply accusation contradicts the just-ended meeting');
assert.equal(replyMatches(event, '刚才分开就开始想你了，路上注意安全。'), true);

const end = functionSource('offEnd');
assert.match(end, /这是本轮最新且必须先承接的真实事件/);
assert.match(end, /绝不能说ta一整天没回/);
const aiReply = functionSource('aiReply');
assert.match(aiReply, /_offEndInfo=replyAccount==='main'\?offEndReplyEventInfo\(note\):null/);
assert.match(aiReply, /if\(_offEndInfo&&!offEndReplyMatches\(_offEndInfo,content\)\)/);
assert.match(aiReply, /if\(fix&&offEndReplyMatches\(_offEndInfo,fix\)\)content=fix;else content=''/);
assert.match(privateSource, /offlineWechatLiveState\(c\).*cohabOnlineQuiet\(id\).*offlineFocusActive\(\)/, 'the private bundle must preserve the same presence block');
assert.doesNotMatch(privateSource, /offEndReplyFallback\(_offEndInfo\)/, 'the private bundle must not manufacture an end-of-date role line');

console.log('offline presence continuity tests passed');
