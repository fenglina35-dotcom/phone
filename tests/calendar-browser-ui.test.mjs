import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../小手机.html', import.meta.url), 'utf8');

test('calendar follows the local day and supports month navigation and date location', () => {
  assert.match(source, /function calEnsure\(\)[\s\S]*todayStr\(\)/);
  assert.match(source, /function calShift\(step\)/);
  assert.match(source, /function calToday\(\)/);
  assert.match(source, /function calLocate\(\)/);
  assert.match(source, /function calLocateGo\(\)/);
  assert.match(source, /for\(let i=0;i<42;i\+\+\)/);
});

test('calendar has a real month grid without the old visible system notice', () => {
  const start = source.indexOf('function renderCalendar()');
  const end = source.indexOf('function addCalEvent(', start);
  const renderSource = source.slice(start, end);
  assert.match(renderSource, /cal-week/);
  assert.match(renderSource, /cal-grid/);
  assert.match(renderSource, /cal-agenda/);
  assert.doesNotMatch(renderSource, /你和ta都能加日程/);
  assert.doesNotMatch(renderSource, /节假日ta会发红包祝福/);
  assert.match(html, /\.cal-card\{/);
  assert.match(html, /\.cal-day\.today/);
});

test('browser presents a Baidu-style home and structured result view', () => {
  const start = source.indexOf('function renderBrowser(');
  const end = source.indexOf('async function browserModelSearch', start);
  const renderSource = source.slice(start, end);
  assert.match(renderSource, /br-logo/);
  assert.match(renderSource, /百度热搜/);
  assert.match(renderSource, /br-result/);
  assert.match(renderSource, /百度一下/);
  assert.match(html, /\.br-search\{/);
  assert.match(html, /\.br-result\{/);
});

test('non-drawing games use themed rooms, compact controls and line icons', () => {
  const start = source.indexOf('function renderGS()');
  const end = source.indexOf('function gsExit()', start);
  const renderSource = source.slice(start, end);
  assert.match(renderSource, /gs-theme-/);
  assert.match(renderSource, /gs-score/);
  assert.match(renderSource, /gs-compose/);
  assert.match(renderSource, /_gs\.kind==='tod'/);
  assert.doesNotMatch(renderSource, /🎲|⚡|💑|🎭/);
  assert.match(source, /function renderUC\(\)[\s\S]*uc-room/);
  assert.match(html, /\.gs-room\{/);
  assert.match(html, /\.uc-room\{/);
});
