import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// VISION_NO_SUPPORT_MSG_V1 (2026-10-30, her request): when the picked model cannot read images, say that plainly
// instead of a misleading 「HTTP 400 …」 / request-format error.
function fn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) return '';
  let d = 0, k = src.indexOf('{', i);
  for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
  return src.slice(i, k + 1);
}
for (const file of ['app.js', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js']) {
  const s = fs.readFileSync(file, 'utf8');
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(['visionNoSupportText', 'visionErrKind', 'visionPlainError'].map(n => fn(s, n)).join('\n'), ctx);
  const err = (message, kind) => { const e = new Error(message); e.visionInfo = { kind: kind || 'schema', message }; return e; };
  test(file + ': a model without image support is named as such', () => {
    assert.equal(ctx.visionErrKind(400, 'This model does not support image input'), 'no_vision');
    assert.equal(ctx.visionErrKind(422, '当前模型不支持图片输入'), 'no_vision');
    assert.equal(ctx.visionErrKind(400, 'invalid type for messages[0].content'), 'schema', 'other format errors are unchanged');
    assert.match(ctx.visionPlainError(err('vision-fail: HTTP 400 This model does not support image input', 'no_vision')), /没有识图功能/);
    assert.match(ctx.visionPlainError(err('vision-fail: 模型回复：抱歉，我看不到图片', 'no_image')), /没有识图功能/);
  });
  test(file + ': other failures keep their own reason', () => {
    assert.equal(ctx.visionPlainError(err('vision-fail: HTTP 401 invalid api key', 'auth')), 'HTTP 401 invalid api key');
    assert(s.includes("m.visionError=visionPlainError(e)"), 'the chat shows the plain message');
  });
}
