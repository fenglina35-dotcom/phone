import assert from "node:assert/strict";
import fs from "node:fs";

const backend = fs.readFileSync(new URL("../supabase/functions/phone-ai/index.ts", import.meta.url), "utf8");

function functionSource(name) {
  const start = backend.indexOf(`function ${name}`);
  assert.ok(start >= 0, `missing ${name}`);
  const next = backend.indexOf("\nasync function ", start + 9);
  return backend.slice(start, next < 0 ? backend.length : next);
}

const refund = functionSource("refund");
const recover = functionSource("recoverStalePendingCharges");
const finish = functionSource("finishCharge");

assert.match(backend, /const IMAGE_PENDING_REFUND_MS = 12 \* 60 \* 1000/);
assert.match(recover, /Date\.now\(\) - IMAGE_PENDING_REFUND_MS/);
assert.doesNotMatch(recover, /Date\.now\(\) - 2 \* 60 \* 1000/);
assert.match(recover, /await refund\(userId, clientSecret, row\.feature \|\| "image"/);

assert.match(refund, /for \(const status of \["pending", "done"\]\)/);
assert.match(refund, /\.update\(\{ status: "refunding"/);
assert.match(refund, /\.eq\("status", status\)/);
assert.match(refund, /\.eq\("points", current\)/);
assert.match(refund, /refund-balance-busy-retry-later/);
assert.match(refund, /return \{ refunded: 0, balance:/);
assert.match(refund, /status: "done",[\s\S]*request_id: ledgerId/);

assert.match(finish, /if \(ok\) query = query\.eq\("status", "pending"\)/);
assert.equal((backend.match(/charge-settlement-conflict/g) || []).length, 3);
assert.doesNotMatch(backend,/charge\(userId, clientSecret, "image"\)/);

console.log("AI billing consistency tests passed");
