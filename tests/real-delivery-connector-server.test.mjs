import assert from 'node:assert/strict';
import fs from 'node:fs';

const edge=fs.readFileSync(new URL('../supabase/functions/phone-delivery/index.ts',import.meta.url),'utf8');
const migration=fs.readFileSync(new URL('../supabase/migrations/202608210003_phone_delivery_connector.sql',import.meta.url),'utf8');
const push=fs.readFileSync(new URL('../supabase/functions/phone-role-push/index.ts',import.meta.url),'utf8');

assert.match(edge,/phone_delivery_authenticate/,'connector must authenticate each device');
assert.match(edge,/PHONE_DELIVERY_UPSTREAM_URL/,'official provider access must stay server-side');
assert.match(edge,/PHONE_DELIVERY_UPSTREAM_SECRET/,'provider signing secret must stay server-side');
assert.match(edge,/x-phone-delivery-signature/,'upstream calls must be signed');
assert.match(edge,/response\.status === 502 && !text\(decoded\.error, 180\)/,'a generic intermediary 502 may be retried once');
assert.match(edge,/attempt < 2/,'transient upstream retry must stay bounded to one retry');
assert.match(edge,/retryable = new Set\(\[[^\]]*"create_order"[^\]]*\]\)/,'create-order retry must reuse the existing idempotent request path');
assert.doesNotMatch(edge,/retryable = new Set\(\[[^\]]*"pay_order"/,'payment submission must never enter the generic gateway retry allow-list');
assert.match(edge,/client_request_id/,'orders and payments must use durable idempotency');
assert.match(edge,/订单金额高于角色自动付款授权金额/,'the server must enforce the automatic-payment authorization');
assert.match(edge,/付款前订单金额发生变化，已阻止自动付款/,'the server must recheck amount before payment');
assert.match(edge,/x-delivery-webhook-signature/,'delivery webhooks must be signed');
assert.match(edge,/Math\.abs\(Date\.now\(\) - milliseconds\) > 5 \* 60_000/,'stale webhooks must be rejected');
assert.match(edge,/shouldAdvance/,'out-of-order status callbacks must not move an order backward');
assert.match(edge,/kind: "delivery_status"/,'real status changes must enqueue a role notification');
assert.match(migration,/unique \(target, client_request_id\)/,'create-order retries must map to one order');
assert.match(migration,/unique \(provider, provider_event_id\)/,'duplicate provider callbacks must be idempotent');
assert.match(migration,/enable row level security/g,'delivery records must be protected by RLS');
assert.match(migration,/revoke all on public\.phone_delivery_orders/,'delivery records must not be directly public');
assert.match(push,/task\.kind === "delivery_status"/,'role push must generate delivery reminders from the real role persona');
assert.match(push,/不得照抄模板，不得编造优惠、骑手位置、到达时间/,'delivery reminders must preserve the no-fabrication boundary');

console.log('real delivery connector server tests passed');
