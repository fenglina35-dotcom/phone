import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "小手机.html"), "utf8");

assert.match(
  source,
  /\['wechat','chat','pfchat','pfgroup','group','chatDetails','contactInfo','friendInfo','contactSettings','roleMoments','roleMomentDetail','roleFeatures'\]\.includes\(c\.p\)/,
  "white WeChat theme must include every role profile subpage",
);
assert.match(
  source,
  /m\.classList\.toggle\('wxmodal-light',S\.me\.wxTheme==='white'/,
  "contact edit modal must follow the WeChat theme",
);
assert.match(
  source,
  /background:\$\{S\.me\.wxTheme==='white'\?'#ededed':'#000'\}/,
  "contact profile background must switch with the theme",
);
assert.match(html, /\.wxlight \.manual-reply-chip\{background:#fff/);
assert.match(html, /\.wxlight \.inputbar\{background:#fff/);
assert.match(html, /\.wxlight \.inputbar \.plus\{background:#fff!important/);
assert.match(html, /\.modal\.wxmodal-light \.sheet\{background:#fff/);
assert.match(html, /\.modal\.wxmodal-light \.hint\{color:#6f7075!important/);
assert.match(html, /\.wxlight \.panel \.it \.b svg\{stroke:#8b8c92!important/);
assert.match(html, /\.wxlight \.ptabs>span\.on\{color:#55565b/);

console.log("wechat light theme tests passed");
