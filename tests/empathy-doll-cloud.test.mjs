import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const edge = readFileSync(
  join(root, 'supabase', 'functions', 'phone-role-push', 'index.ts'),
  'utf8',
);

test('doll events require a dedicated long bearer token and exact pairing', () => {
  assert.match(edge, /EMPATHY_DOLL_TOKEN/);
  assert.match(edge, /expected\.length >= 32/);
  assert.match(edge, /EMPATHY_DOLL_TARGET/);
  assert.match(edge, /EMPATHY_DOLL_ROLE_ID/);
  assert.match(edge, /empathy-doll-not-paired/);
  assert.match(edge, /lastSeenAt: String\(doll\.lastSeenAt \|\| ""\)/);
});

test('doll ingress accepts only the defined state machine events', () => {
  for (const event of ['DEVICE_ONLINE', 'HAND_TOUCH', 'HUG_STARTED', 'HUG_HELD', 'HUG_ENDED']) {
    assert.match(edge, new RegExp(`"${event}"`));
  }
  assert.match(edge, /invalid-empathy-doll-event/);
  assert.match(edge, /eventType === "HAND_TOUCH" \|\| eventType === "HUG_STARTED"/);
  assert.match(edge, /EMPATHY_DOLL_REPLY_COOLDOWN_SECONDS/);
  assert.match(edge, /\|\| 180\) \* 1000/);
  assert.match(edge, /status: roleReplyAllowed \? "pending" : "completed"/);
});

test('doll ingress is durable and idempotent without a new database table', () => {
  assert.match(edge, /externalKey = `empathy:\$\{deviceId\}:\$\{eventId\}`/);
  assert.match(edge, /eq\("external_key", externalKey\)/);
  assert.match(edge, /String\(taskError\.code \|\| ""\) === "23505"/);
  assert.match(edge, /automation_state: \{ \.\.\.automation, empathyDoll: state \}/);
});

test('doll replies reuse genuine model generation and APNs without canned fallbacks', () => {
  assert.match(edge, /payload\.empathyDoll === true/);
  assert.match(edge, /eventType === "HAND_TOUCH"/);
  assert.match(edge, /当前拥抱状态/);
  assert.match(edge, /await roleMessage\(/);
  assert.match(edge, /persistAndPush\(client, url, profile, decision\.body/);
  assert.match(edge, /\? "empathy-doll" : task\.kind/);
  assert.doesNotMatch(edge, /fallbackMessage/);
});
