import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const account = fs.readFileSync(new URL("../ai-account.js", import.meta.url), "utf8");

assert.match(app, /function showManual\(section\)/);
assert.match(app, /AI账户不是聊天模型接口/);
assert.match(app, /路线一至路线四/);
assert.match(app, /不需要另外注册密码/);
assert.match(app, /不会自动搬走AI用户ID和余额/);
assert.match(app, /上传付款截图/);
assert.match(app, /等待人工核对/);
assert.match(app, /内置语音怎么用/);
assert.doesNotMatch(app, /内置图片怎么用|启用图片生成/);
assert.match(app, /使用下方外置图片接口生成，由对应平台计费/);
assert.match(app, /\/images\/generations/);
assert.match(app, /Failed to fetch \/ Network \/ CORS/);
assert.match(app, /Android System WebView/);
assert.match(app, /返回 <b>&lt;!doctype html&gt;<\/b>/);
assert.match(app, /section==='ai'/);
assert.match(account, /onclick="showManual\('ai'\)"/);
assert.match(account, /AI账户使用说明与常见问题/);

console.log("manual guide tests passed");
