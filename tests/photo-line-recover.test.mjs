// PHOTO_LINE_RECOVER_V1：角色把发照片写成一句话时认回照片，普通聊天不误认。
// 设 FIX_TEST_OLD=1 时读取 HEAD 里的旧代码，用来确认这些测试在修复前会失败。
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { read, fnSource, PRIV_DIR } from './_helpers.mjs';

const PRIV = PRIV_DIR;
function recoverBlock(src) {
  const start = src.indexOf('/* PHOTO_LINE_RECOVER_V1');
  assert.notEqual(start, -1, '缺少 PHOTO_LINE_RECOVER_V1');
  const end = src.indexOf('function mergePhotoIntroLines(', start);
  return src.slice(start, end) + fnSource(src, 'mergePhotoIntroLines');
}

const PHOTO = [
  '我发了一张照片，画面是书房台灯下摊开的书',
  '我发了一张照片，书房台灯下摊开的书，旁边一杯冷掉的咖啡',
  '发了一张照片：书房台灯下摊开的书，旁边一杯冷掉的咖啡',
  '（发了一张照片：书房台灯下摊开的书，旁边一杯冷掉的咖啡）',
  '*发了张照片* 书房台灯下摊开的书，旁边一杯冷掉的咖啡',
  '给你拍了张照片：书房台灯下摊开的书，旁边一杯冷掉的咖啡',
  '【照片】书房台灯下摊开的书，旁边一杯冷掉的咖啡',
];
const CHAT = ['我刚发了张照片你看到没？', '我发了一张照片给你看看', '发了张图你收到了吗', '今天天气不错'];

for (const [label, file] of [['web', 'app.js'], ['private', PRIV + 'app.js']]) {
  const src = read(file);
  test(label + ' a role writing "I sent a photo: …" in words still sends a photo', () => {
    const ctx = vm.createContext({});
    vm.runInContext(fnSource(src, 'cleanPhotoDescText') + recoverBlock(src) + ';this.raw=rawPhotoLine;this.merge=mergePhotoIntroLines;', ctx);
    for (const line of PHOTO) assert.match(ctx.raw(line), /^\[图片\|书房台灯下摊开的书/, line);
    for (const line of CHAT) assert.equal(ctx.raw(line), line, '普通聊天原样不动：' + line);
    assert.deepEqual(Array.from(ctx.merge(['我发了一张照片', '书房台灯下摊开的书，旁边一杯冷掉的咖啡', '好看吗'])).map((x) => x.slice(0, 8)), ['[图片|书房台灯', '好看吗']);
    assert.deepEqual(Array.from(ctx.merge(['[发了一张照片]', '书房台灯下摊开的书，旁边一杯冷掉的咖啡'])).length, 1);
    assert.deepEqual(Array.from(ctx.merge(['我发了一张照片', '你看到没？'])), ['我发了一张照片', '你看到没？'], '下一行是问句就不并');
  });

  test(label + ' both the chat reply and the background message paths recover photos while raw output is on', () => {
    assert.match(src, /\(typeof mergePhotoIntroLines==='function'\?mergePhotoIntroLines:\(x=>x\)\)\(_rawOutput\?modelUnfilteredLines\(content\):splitChatBubbles\(content,30\)\)/);
    assert.match(src, /let line=_rawOutput\?\(typeof rawPhotoLine==='function'\?rawPhotoLine\(lines\[i\]\):lines\[i\]\)/);
    assert.match(fnSource(src, 'roleServerPushParts'), /mergePhotoIntroLines\(modelUnfilteredLines\(body\)\)\.map\(rawPhotoLine\)/);
    assert.match(fnSource(src, 'roleServerPushParts'), /for\(const raw of \(typeof mergePhotoIntroLines==='function'\?mergePhotoIntroLines\(_pushLines\)/);
  });
}
