import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// v1352：glass-theme.css 不在离线缓存里、下载失败也不重试；打开瞬间网络一抖，主屏组件挤成小块、
// 音乐光盘消失、图片被压扁或整张放大，要退出重进几次才恢复。
const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../小手机.html', import.meta.url), 'utf8');

test('home and wedding stylesheets are kept offline by the service worker', () => {
  const optional = sw.slice(sw.indexOf('const OPTIONAL_FILES=['), sw.indexOf('];', sw.indexOf('const OPTIONAL_FILES=[')));
  for (const name of ['glass-theme.css', 'wedding-game.css', 'wechat-me.css', 'pet-game.css'])
    assert.ok(optional.includes("'./" + name + '?'), name + ' must be cached offline');
});

test('every stylesheet link retries once on its own when the download fails', () => {
  assert.match(html, /window\.__northCssRetry=function\(link\)/);
  const links = html.match(/<link rel="stylesheet" href="[^"]+"[^>]*>/g) || [];
  assert.ok(links.length >= 4);
  for (const link of links) assert.match(link, /onerror="__northCssRetry\(this\)"/, link);
  assert.ok(html.indexOf('window.__northCssRetry=') < html.indexOf('<link rel="stylesheet"'), 'retry helper must exist before the links');
});
