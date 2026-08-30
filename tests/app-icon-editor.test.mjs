import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../小手机.html", import.meta.url), "utf8");
const privateSource = fs.readFileSync(new URL("../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js", import.meta.url), "utf8");

const listStart = source.indexOf("const HOMEAPPS=");
const listEnd = source.indexOf("function appIconEditor", listStart);
assert.ok(listStart >= 0 && listEnd > listStart, "missing app icon editor list");
const list = source.slice(listStart, listEnd);

assert.match(list, /\['phoneapp','☎','电话'\]/);
assert.match(list, /\['douyin','🎵','抖音'\]/);
assert.match(list, /\['tale','🕯️','规则怪谈'\]/);
assert.match(list, /\['dread','🩸','惊悚抉择'\]/);
assert.match(privateSource, /const HOMEAPPS=[\s\S]*?\['tale','🕯️','规则怪谈'\]/);
assert.match(privateSource, /const HOMEAPPS=[\s\S]*?\['dread','🩸','惊悚抉择'\]/);
assert.match(source, /function compressSquare\(file,size,q\)/);
assert.match(source, /function setAppIcon\(key\)[\s\S]*?S\.me\.appIcons\[key\]=await compressSquare\(f,256,/);
assert.match(source, /custom\?' custom-app-icon':''/);
assert.match(source, /object-position:50% 50%/);
assert.match(html, /\.app \.ic\.custom-app-icon\{aspect-ratio:1\/1;min-width:0;max-width:none;flex:0 0 auto;box-sizing:border-box;overflow:hidden\}/);
assert.doesNotMatch(source, /loading="lazy" decoding="async" fetchpriority="low"/);
assert.match(html, /\.app \.app-label\{[^}]*width:100%;[^}]*height:20px;[^}]*min-height:20px;[^}]*flex:0 0 20px;[^}]*box-sizing:border-box/);
assert.match(source, /function appCell\(k\)[\s\S]*?aIco\(a\.icon\|\|k,a\.e,a\.c,badge\)\+homeAppLabel\(a\.t,locked\)/);

console.log("app icon editor tests passed");
