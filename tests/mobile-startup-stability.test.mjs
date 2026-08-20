import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../小手机.html', import.meta.url), 'utf8');

function functionSource(name) {
  const asyncStart = app.indexOf(`async function ${name}`);
  const start = asyncStart >= 0 ? asyncStart : app.indexOf(`function ${name}`);
  assert.ok(start >= 0, `missing ${name}`);
  const brace = app.indexOf('{', start);
  let depth = 0, quote = '', escaped = false;
  for (let i = brace; i < app.length; i++) {
    const ch = app[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return app.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

test('startup hydrates only the image set appropriate to web or the private app', () => {
  assert.match(app, /function imageRefKeys\(root\)/);
  assert.match(app, /function imgMany\(keys\)/);
  assert.match(app, /function imgManyChunk\(keys\)/);
  assert.match(functionSource('imgMany'), /i\+=48/);
  assert.match(functionSource('imgMany'), /j\+=12/);
  const boot = functionSource('bootImages');
  assert.match(boot, /keys=lazy\?privateBootImageKeys\(\):imageRefKeys\(S\)/);
  assert.match(boot, /_imgCache=await imgMany\(keys\)/);
  assert.match(boot, /if\(!lazy\)_rehydrate\(S\)/);
  assert.doesNotMatch(boot, /await imgAll\(\)/);
});

test('stored avatar references render safely and refresh incoming call UI', () => {
  assert.match(functionSource('isImg'), /blob:/);
  assert.match(functionSource('av'), /isStoredImgRef\(v\)/);
  assert.match(functionSource('av'), /_imgCache\[key\]/);
  assert.match(functionSource('av'), /data-idb-avatar/);
  assert.match(functionSource('refreshHydratedUI'), /showCallBanner\(c\)/);
  assert.match(app, /else refreshHydratedUI\(\)/);
});

test('keyboard events can never resize or clip the global phone shell', () => {
  assert.doesNotMatch(html, /--north-app-height/);
  assert.match(html, /\.phone\{width:100%;height:100%;max-height:none/);
  assert.match(html, /html,body\{width:100%;height:100%;min-height:0;overflow:hidden\}/);
  assert.doesNotMatch(html, /@media \(pointer:coarse\)\{\.cin-watch,\.cin-stage\{height:100dvh/);
  assert.match(html, /\.livemap\{flex:1;min-height:0;height:auto\}/);
  assert.doesNotMatch(app, /function syncAppViewport/);
  assert.doesNotMatch(app, /function appVisibleViewportHeight/);
  assert.doesNotMatch(app, /document\.documentElement\.style\.setProperty\(['"]--north-app-height/);
  const ordinaryApp=app.replace(/function northViewportDiagnosticStart\([^\n]*\n/,'');
  assert.doesNotMatch(ordinaryApp, /visualViewport\.addEventListener\(['"](?:resize|scroll)['"]/, 'only the explicit read-only diagnostic panel may observe visualViewport');
});

test('mobile pages keep independent scrolling and home supports both swipe axes', () => {
  assert.match(app, /window\.addEventListener\('pageshow',e=>\{/);
  assert.match(html, /scroll-snap-stop:always/);
  assert.match(html, /\.scroll\{flex:1;min-height:0;[^}]*touch-action:pan-y/);
  assert.match(html, /\.home\{[^}]*overflow:hidden/);
  assert.match(html, /\.home-scroll\{[^}]*overflow-y:auto;[^}]*touch-action:pan-y/);
  assert.match(html, /\.appswipe\{[^}]*flex-shrink:0;[^}]*touch-action:pan-x pan-y/);
  assert.match(functionSource('homeSnapPage'), /p\*w/);
  assert.match(functionSource('homeRestorePage'), /_homePage\*\(el\.clientWidth\|\|1\)/);
});

test('cinema offers a user-triggered Android system fullscreen fallback', () => {
  assert.match(app, /data-cin-action="fullscreen"/);
  assert.match(functionSource('cinemaControlTap'), /a==='fullscreen'\)cinemaToggleFullscreen\(\)/);
  assert.match(functionSource('cinemaToggleFullscreen'), /requestFullscreen/);
  assert.match(functionSource('cinemaToggleFullscreen'), /orientation\.lock\('landscape'\)/);
  assert.match(app, /document\.addEventListener\('fullscreenchange',cinemaFullscreenChanged\)/);
});

test('new couple defaults are enabled without replacing an active bound role', () => {
  const defaults = functionSource('coupleDefaultState');
  assert.match(defaults, /walletAuth:true/);
  assert.match(defaults, /jailAuth:true/);
  assert.match(defaults, /wxLoginAuth:true/);
  assert.match(defaults, /remoteControlAuth:true/);
  assert.match(defaults, /remoteControlAutoApprove:true/);
  assert.match(defaults, /escalate:true/);
  assert.match(functionSource('coupleHasActiveRole'), /!c\.deleted/);
});
