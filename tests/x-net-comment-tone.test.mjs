import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const bundledApp = fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../小手机.html', import.meta.url), 'utf8');
const bundledHtml = fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html', import.meta.url), 'utf8');

function featureBlock(source) {
  const start = source.indexOf('function xNetCommentTone()');
  const end = source.indexOf('/* ---------- 抖音 ---------- */', start);
  assert.notEqual(start, -1, 'X comment-tone helper is present');
  assert.notEqual(end, -1, 'X comment-tone feature ends before Douyin');
  return source.slice(start, end);
}

function normalizedLines(source) {
  return source.replace(/\r\n/g, '\n');
}

for (const source of [app, bundledApp]) {
  test('X profile exposes friendly, hostile, and mixed comment settings', () => {
    assert.match(source, /netCommentTone:'mixed'/);
    const profile = source.slice(source.indexOf('function xProfile()'), source.indexOf('function editXProfile()'));
    const editor = source.slice(source.indexOf('function editXProfile()'), source.indexOf('function changeXCover()'));
    assert.doesNotMatch(profile, /网友评论风格/);
    assert.match(editor, /网友评论风格/);
    assert.match(editor, /option value="friendly"[^\n]+>友善</);
    assert.match(editor, /option value="hostile"[^\n]+>恶劣</);
    assert.match(editor, /option value="mixed"[^\n]+>一半一半</);
    assert.match(editor, /S\.x\.profile\.netCommentTone=\['friendly','hostile','mixed'\]\.includes\(tone\)\?tone:'mixed'/);
  });

  test('only comments on my own tweets use the chosen tone', () => {
    assert.match(source, /if\(!tweet\|\|tweet\.who!=='me'\)return '评论整体自然多样/);
    assert.match(source, /xNetCommentToneGuide\(tweet\)/);
    assert.match(source, /xNetCommentToneGuide\(t\)/);
    assert.match(source, /角色本人的评论不受影响/);
  });

  test('hostile comments retain explicit safety boundaries', () => {
    assert.match(source, /整体恶劣[^;]+禁止威胁、仇恨歧视、人肉隐私、暴力和违法内容/);
    assert.match(source, /大约一半友善、一半恶劣/);
    assert.doesNotMatch(featureBlock(source), /function genNetDM[\s\S]*?xNetCommentToneGuide/);
  });
}

test('web and private app use the same X comment-tone implementation', () => {
  assert.equal(normalizedLines(featureBlock(bundledApp)), normalizedLines(featureBlock(app)));
});

test('X profile cover is taller in web and private shells', () => {
  for (const source of [html, bundledHtml]) {
    assert.match(source, /\.xprofh\{height:160px;/);
    assert.doesNotMatch(source, /\.xprofh\{height:100px;/);
  }
});
