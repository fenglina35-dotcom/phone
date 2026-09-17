import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../小手机.html", import.meta.url), "utf8");

function functionSource(name) {
  const start = app.indexOf(`function ${name}`);
  assert.ok(start >= 0, `missing ${name}`);
  const brace = app.indexOf("{", start);
  let depth = 0, quote = "", escaped = false, regex = false, regexClass = false, prev = "";
  for (let i = brace; i < app.length; i++) {
    const ch = app[i];
    if (regex) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === "[") regexClass = true;
      else if (ch === "]") regexClass = false;
      else if (ch === "/" && !regexClass) regex = false;
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") { quote = ch; continue; }
    if (ch === "/" && app[i + 1] !== "/" && app[i + 1] !== "*" && /[=(,:;!&|?\[{]/.test(prev)) { regex = true; continue; }
    if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return app.slice(start, i + 1);
    if (!/\s/.test(ch)) prev = ch;
  }
  throw new Error(`unterminated ${name}`);
}

const resultContext = vm.createContext({ chatAPI: async () => "unused", joinAIContinuation: (a, b) => a + b });
vm.runInContext(`async ${functionSource("chatResultText")}`, resultContext);
// rejectRefusal 本身仍是 chatResultText 支持的选项，只是通话不再使用它。
await assert.rejects(
  () => resultContext.chatResultText([], { rejectRefusal: true }, { choices: [{ message: { content: "" }, finish_reason: "content_filter" }] }),
  (error) => error?.code === "model-refusal" && error?.modelRefusal === true,
);
assert.equal(
  await resultContext.chatResultText([], { rejectRefusal: true }, { choices: [{ message: { content: "正常回复" }, finish_reason: "stop" }] }),
  "正常回复",
);

// 「通话防跳出角色」按用户要求整个移除。它此前写作 !_rawOutput && callRoleGuardOn()，
// 而模型原文输出升为全局默认后 _rawOutput 恒为真，这个开关早已恒为假、拨动无效，
// 因此删除它是零行为变化的清理。随它一起走的还有本轮自动切副模型那条兜底路径。
for (const gone of [
  "callRoleGuard",
  "callRoleGuardOn",
  "_callGuardOn",
  "_guardCallOutput",
  "_switchCallToAux",
  "_usedAuxFallback",
  "callAuxConfigured",
  "callRealSafetyError",
  "callExplicitSelfHarmIntent",
  "通话防跳出角色",
]) assert.equal(app.includes(gone), false, `防跳出残留：${gone}`);

// 通话首次请求回到单一路径，拒绝时就地重答，不再切模型
assert.match(app, /let content=await _callChat\(_initialCallMessages,_md\);/);
assert.match(app, /\{for\(let _ra=0;_ra<2&&isRefusal\(content\);_ra\+\+\)/);
// 外语通话缺翻译的纠正不再被防跳出挡住
assert.match(app, /if\(!_rawOutput&&_langN&&content\)/);

// 通话系统提示条本身保留（角色手动切换主/副模型仍然可用）
assert.match(app, /toast\(c\.model==='aux'\?'已切换副模型':'已切换主模型',3000\)/);
assert.match(app, /toast\('副模型未配置',3000\)/);
assert.match(app, /e\.callSystemText='回复未播放：'\+reason/);
const blockedContext = vm.createContext({ String });
vm.runInContext(functionSource('callOutputBlockedError'), blockedContext);
const blocked = blockedContext.callOutputBlockedError('视频通话没有可播放的角色台词');
assert.equal(blocked.code, 'call-output-blocked');
assert.equal(blocked.callSystemText, '回复未播放：视频通话没有可播放的角色台词');
assert.match(app, /toast\(text,10000\)/);
assert.match(app, /_callSystemNoticeTimer=setTimeout\([^\n]*,10000\)/);
assert.doesNotMatch(app, /callSystemNotice\([^\n]*(?:callRouteModelName|主模型「|副模型「)/);
assert.match(app, /“停止”“停下”“不要继续”“不玩了”“退出扮演”/);
assert.match(app, /who:systemText\?'system':'them'/);
assert.match(html, /\.csline\.system\{/);

console.log("call system notice tests passed");
