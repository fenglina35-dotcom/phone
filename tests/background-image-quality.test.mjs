import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");

assert.match(source, /async function compressBackground\(file\)\{let out=await compress\(file,2048,\.88\);if\(out&&out\.length>1800000\)out=await compress\(file,1800,\.82\);try\{await primeImageForSave\(out\)/);
assert.match(source, /async function primeImageForSave\(v\)[\s\S]*?await imgPut\(key,v\);_imgReady\.add\(key\)/);
assert.match(source, /function setMusicBg\(\)[\s\S]*?S\.music\.bg=await compressBackground\(f\)/);
assert.match(source, /function setHomeBg\(\)[\s\S]*?homeBg=await compressBackground\(f\)/);
assert.match(source, /function setLockBg\(\)[\s\S]*?lockBg=await compressBackground\(f\)/);
assert.match(source, /function setCallBg\(\)[\s\S]*?callBg=await compressBackground\(f\)/);
assert.match(source, /function setChatBg\(id\)[\s\S]*?chatBg=await compressChatBackground\(f\)/);

/* 她说「我发现换了背景之后会压缩画质」。聊天背景是贴着整块屏幕看的：
   iPhone 一屏就是 1179 物理像素宽，compressBackground 把长边压到 2048，
   一张竖着的截图（1179×2556）长边是高，压完宽只剩 944，比屏幕还窄，
   所以一换上去就糊。聊天背景单独走一档更宽松的，并且按容量一级一级让步。 */
const chatLadder = source.match(/async function compressChatBackground\(file\)\{[\s\S]*?\n  return out;\}/);
assert.ok(chatLadder, '聊天背景要有自己那一档压缩');
const steps = [...chatLadder[0].matchAll(/compress\(file,(\d+),(\.\d+)\)/g)].map(m => [ +m[1], parseFloat(m[2]) ]);
assert.ok(steps.length >= 2, '至少要有一档让步，不能一压到底');
assert.ok(steps[0][0] >= 2400, `第一档只压到 ${steps[0][0]}，比一整屏还窄，一眼就看得出糊`);
assert.ok(steps[0][1] >= 0.9, `第一档画质 ${steps[0][1]} 太低`);
for (let i = 1; i < steps.length; i += 1) {
  assert.ok(steps[i][0] < steps[i - 1][0], '每一档要比上一档更省，不能越让越大');
  assert.ok(steps[i][1] < steps[i - 1][1]);
  assert.ok(steps[i][0] >= 1800, `最后让到 ${steps[i][0]} 就太狠了`);
}
const guards = [...chatLadder[0].matchAll(/out\.length>(\d+)\)/g)].map(m => +m[1]);
assert.equal(guards.length, steps.length - 1, '每一次让步都要先看看到底有多大');
assert.ok(guards.every(g => g >= 2000000), '还没到两三兆就开始压，白白糊掉');
assert.match(chatLadder[0], /await primeImageForSave\(out\)/, '换完要先塞进图库缓存，不然第一眼是空的');
/* 普通背景（桌面、锁屏、音乐、封面）还是走原来那档，不要顺手一起改大 */
assert.match(source, /async function compressBackground\(file\)\{let out=await compress\(file,2048,\.88\)/);
/* 短信里发出去的照片也别压太狠——她说「发送图片一定是原模原样的图片发送出去的」 */
assert.match(source, /function phSmsPic\(num,sk\)[\s\S]*?compress\(f,1400,\.82\)/);
assert.match(source, /function changeCover\(\)[\s\S]*?momentCover=await compressBackground\(f\)/);
assert.doesNotMatch(source, /S\.music\.bg=await compress\(f,1000,\.7\)/);
assert.doesNotMatch(source, /chatBg=await compress\(f,800,\.6\)/);

console.log("background image quality tests passed");
