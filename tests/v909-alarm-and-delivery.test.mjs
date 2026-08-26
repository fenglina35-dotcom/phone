import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const app = read('app.js');
const edge = read('supabase/functions/phone-role-push/index.ts');
const bridge = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift');
const alarm = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/NativeAlarmService.swift');
const info = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/Info.plist');

function functionSource(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const next = app.indexOf('\nfunction ', start + 10);
  return app.slice(start, next < 0 ? undefined : next);
}

test('app-watch freshness comes from the Screen Time payload, not an empty outer timestamp', () => {
  assert.match(edge, /function snapshotScreenTime\(/);
  assert.match(edge, /snapshotTime\(screen\.generatedAt\)/);
  const uses = [...edge.matchAll(/const captured = snapshotScreenTime\(snapshot\);/g)];
  assert.ok(uses.length >= 2, 'both immediate and autonomous app-watch paths use Screen Time freshness');
});

test('role push acknowledgement follows durable local persistence', () => {
  const pull = functionSource('roleServerPushPull');
  assert.match(pull, /needsPersist&&\!\(await persistWechatMessagesNow\(\)\)/);
  assert.ok(pull.indexOf('await persistWechatMessagesNow()') < pull.indexOf("phone_role_push_ack"));
  assert.match(pull, /roleServerPushDeliveryBlocked\(c\.id\)\)\{roleServerPushSyncSoon\(c\.id\);continue;\}/);
});

test('private iOS app synchronizes web alarms through AlarmKit while web fallback remains', () => {
  assert.match(info, /<key>NSAlarmKitUsageDescription<\/key>/);
  assert.match(bridge, /case "alarm\.sync"/);
  assert.match(alarm, /import AlarmKit/);
  assert.match(alarm, /requestAuthorization\(\)/);
  assert.match(alarm, /manager\.schedule\(id: nativeID, configuration: configuration\)/);
  assert.match(alarm, /\.weekly\(\[\.monday, \.tuesday, \.wednesday, \.thursday, \.friday, \.saturday, \.sunday\]\)/);
  assert.match(alarm, /firedIDs\.append\(item\.webID\)/);
  assert.match(app, /SmallPhoneNative\.request\('alarm\.sync'/);
  assert.match(functionSource('checkAlarms'), /_nativeAlarmAuthorized/);
  assert.match(app, /setInterval\(checkAlarms,15000\)/);
});
