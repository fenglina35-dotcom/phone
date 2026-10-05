import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

assert.match(app, /function showManual\(section\)/);
assert.match(app, /路线一至路线四/);
assert.doesNotMatch(app, /内置图片怎么用|启用图片生成/);
assert.match(app, /\/images\/generations/);
assert.match(app, /Failed to fetch \/ Network \/ CORS/);
assert.match(app, /Android System WebView/);
assert.match(app, /返回 <b>&lt;!doctype html&gt;<\/b>/);
assert.match(app, /section==='ai'/);

console.log("manual guide tests passed");
