import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const app = read('app.js');
const bundledApp = read(
  'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js'
);
const webView = read(
  'native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift'
);

function functionSource(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  let depth = 0;
  let quote = '';
  let escaped = false;
  let opened = false;
  for (let i = start; i < app.length; i += 1) {
    const ch = app[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '{') {
      depth += 1;
      opened = true;
    } else if (ch === '}') {
      depth -= 1;
      if (opened && depth === 0) return app.slice(start, i + 1);
    }
  }
  throw new Error(`unterminated function ${name}`);
}

test('private app time and number helpers never enter WebKit Intl', () => {
  let intlCalls = 0;
  const forbidden = () => {
    intlCalls += 1;
    throw new Error('private app must not enter Intl');
  };
  forbidden.supportedValuesOf = forbidden;
  const context = vm.createContext({
    console,
    Intl: { DateTimeFormat: forbidden, supportedValuesOf: forbidden },
    S: { settings: { timeZone: '' } },
    window: {
      __SMALL_PHONE_PRIVATE__: true,
      __SMALL_PHONE_NATIVE_ENV__: {
        timeZone: 'Asia/Shanghai',
        timeZoneOffsetMinutes: 480,
        timeZoneOffsets: {
          'Asia/Shanghai': 480,
          'Asia/Tokyo': 540
        }
      }
    },
    esc: value => String(value)
  });
  const names = [
    'privateNativeShellOn',
    'privateNativeAppOn',
    'nativeTimeEnvironment',
    'nativeTimeZoneOffsets',
    'nativeTimeZoneOffset',
    'deviceTimeZone',
    'timeZoneValid',
    'roleTimeFormatter',
    'localRoleTimeParts',
    'roleTimeParts',
    'timeZoneOffsetText',
    'timeZoneName',
    'timeZoneOptions',
    'northLocaleNumber',
    'northLocaleDate'
  ];
  vm.runInContext(
    `const ROLE_TIME_ZONE_CACHE_MS=300000;` +
      `let _deviceTimeZoneCache={value:'',at:0};` +
      `const _timeZoneValidCache=new Map(),_roleTimeFormatterCache=new Map();` +
      names.map(functionSource).join('\n'),
    context
  );
  assert.equal(vm.runInContext('deviceTimeZone()', context), 'Asia/Shanghai');
  assert.equal(vm.runInContext('timeZoneValid("Asia/Tokyo")', context), true);
  assert.equal(
    vm.runInContext('roleTimeParts(Date.UTC(2026,7,25,0,0,0),"Asia/Tokyo").hour', context),
    9
  );
  assert.equal(
    vm.runInContext('northLocaleNumber(1234567)', context),
    '1,234,567'
  );
  assert.match(
    vm.runInContext('northLocaleDate(new Date(2026,7,25,9,8,7),{hour12:false})', context),
    /^2026\/8\/25 09:08:07$/
  );
  assert.match(vm.runInContext('timeZoneOptions("local")', context), /日本时间/);
  assert.equal(intlCalls, 0);
});

test('all remaining Intl and locale fallbacks are fenced away from private app', () => {
  assert.match(functionSource('deviceTimeZone'), /nativeZone[\s\S]*?return nativeZone;[\s\S]*?if\(privateNativeShellOn\(\)\)[\s\S]*?return value;[\s\S]*?Intl\.DateTimeFormat/);
  assert.match(functionSource('timeZoneValid'), /if\(privateNativeShellOn\(\)\)[\s\S]*?return valid;[\s\S]*?new Intl\.DateTimeFormat/);
  assert.match(functionSource('roleTimeParts'), /if\(privateNativeShellOn\(\)\)[\s\S]*?return localRoleTimeParts[\s\S]*?roleTimeFormatter/);
  assert.match(functionSource('timeZoneOptions'), /if\(privateNativeShellOn\(\)\)[\s\S]*?else\{try\{all=Intl\.supportedValuesOf/);
  assert.match(functionSource('northLocaleNumber'), /if\(!privateNativeShellOn\(\)\)return n\.toLocaleString/);
  assert.match(functionSource('northLocaleDate'), /if\(!privateNativeShellOn\(\)\)return d\.toLocaleString/);
  const localeSites = [...app.matchAll(/\.toLocaleString\(/g)].map(match => match.index);
  const allowed = [
    functionSource('northLocaleNumber'),
    functionSource('northLocaleDate')
  ].reduce((sum, source) => sum + (source.match(/\.toLocaleString\(/g) || []).length, 0);
  assert.equal(localeSites.length, allowed);
  assert.match(functionSource('companionUsageDayAt'), /if\(typeof privateNativeShellOn[\s\S]*?privateNativeShellOn\(\)\)return local;[\s\S]*?Intl\.DateTimeFormat/);
});

test('native timezone snapshot is injected before bridge bootstrap', () => {
  const environmentIndex = webView.indexOf('source: Self.nativeEnvironmentBootstrap()');
  const bridgeIndex = webView.indexOf('source: Self.bridgeBootstrap');
  assert.notEqual(environmentIndex, -1);
  assert.notEqual(bridgeIndex, -1);
  assert.ok(environmentIndex < bridgeIndex);
  assert.match(webView, /TimeZone\.knownTimeZoneIdentifiers/);
  assert.match(webView, /"timeZoneOffsets": offsets/);
  assert.match(webView, /window\.__SMALL_PHONE_NATIVE_ENV__/);
});

test('terminated WebContent receives one delayed exact-bundle recovery without a Coordinator reset loop', () => {
  assert.match(webView, /func webViewWebContentProcessDidTerminate\(_ webView: WKWebView\)/);
  assert.match(webView, /now - \$0 < 120/);
  assert.match(webView, /smallPhone\.webContentTerminationTimes\.v4\.build248/);
  assert.match(webView, /UserDefaults\.standard[\s\S]*?terminationTimes/);
  assert.match(webView, /WebContent stable for 90s; recovery budget reset/);
  assert.match(webView, /guard attempt == 1 else/);
  assert.match(webView, /deadline: \.now\(\) \+ 10/);
  assert.match(webView, /webView\.loadFileURL\([\s\S]{0,160}?allowingReadAccessTo: readAccessURL/);
  assert.match(webView, /configureBundledPage\([\s\S]{0,140}?fileURL: fileURL[\s\S]{0,140}?readAccessURL: readAccessURL/);
  assert.doesNotMatch(webView, /webView\?\.reload\(\)/);
  assert.doesNotMatch(webView, /websiteDataStore\.removeData/);
});

test('root and private bundled app stay semantically identical', () => {
  const normalize = value => value.replace(/\r\n/g, '\n');
  assert.equal(normalize(bundledApp), normalize(app));
});
