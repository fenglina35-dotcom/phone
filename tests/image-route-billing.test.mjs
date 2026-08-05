import assert from "node:assert/strict";
import fs from "node:fs";

const backend = fs.readFileSync(new URL("../supabase/functions/phone-ai/index.ts", import.meta.url), "utf8");
const retired = 'if (action === "image") return json({ ok: false, error: "image-feature-retired" }, 410);';

assert.match(backend, /if \(action === "image"\) return json\(\{ ok: false, error: "image-feature-retired" \}, 410\);/);
assert.ok(backend.indexOf(retired) < backend.indexOf('if (action === "account")'), "retired image requests must stop before account and billing work");
assert.doesNotMatch(backend, /await charge\(userId, clientSecret, "image"\)/, "retired image requests must never reserve points");
assert.doesNotMatch(backend, /await finishCharge\([^\n]+image|await refund\(userId, clientSecret, "image"/);
assert.doesNotMatch(backend, /configuredImageRoutes|generateImageThroughRoute|IMAGE_ROUTE_2|IMAGE_MODEL/);
assert.doesNotMatch(backend, /image_routes|image:\s*6/);

// Existing pending image ledger rows can still be refunded after the feature is retired.
assert.match(backend, /function recoverStalePendingCharges\(/);
assert.match(backend, /\.eq\("feature", "image"\)/);
assert.match(backend, /stale-pending-auto-refund/);

console.log("retired image route billing tests passed");
