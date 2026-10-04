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
assert.match(list, /\['pixelhome','','像素少女'\]/);
assert.match(list, /\['pet','','电子宠物'\]/);
assert.match(privateSource, /const HOMEAPPS=[\s\S]*?\['pixelhome','','像素少女'\]/);
assert.match(privateSource, /const HOMEAPPS=[\s\S]*?\['pet','','电子宠物'\]/);
assert.match(source, /function compressSquare\(file,size,q\)/);
assert.match(source, /function setAppIcon\(key\)[\s\S]*?S\.me\.appIcons\[key\]=await compressSquare\(f,256,/);
assert.match(source, /custom\?' custom-app-icon':''/);
assert.match(source, /object-position:50% 50%/);
assert.match(html, /\.app \.ic\.custom-app-icon\{aspect-ratio:1\/1;min-width:0;max-width:none;flex:0 0 auto;box-sizing:border-box;overflow:hidden\}/);
assert.doesNotMatch(source, /loading="lazy" decoding="async" fetchpriority="low"/);
assert.match(html, /\.app \.app-label\{[^}]*width:100%;[^}]*height:20px;[^}]*min-height:20px;[^}]*flex:0 0 20px;[^}]*box-sizing:border-box/);
assert.match(source, /function appCell\(k\)[\s\S]*?aIco\(a\.icon\|\|k,a\.e,a\.c,badge\)\+homeAppLabel\(a\.t,locked\)/);



// All home and dock icons share a hollow glass rim without a dark backing gutter.
const glass = fs.readFileSync(new URL('../glass-theme.css', import.meta.url), 'utf8');
const privateGlass = fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/glass-theme.css', import.meta.url), 'utf8');
assert.equal(glass.match(/\.home \.app \.ic:after\{[^}]+\}/)?.[0], privateGlass.match(/\.home \.app \.ic:after\{[^}]+\}/)?.[0]);
assert.match(glass, /\.home \.app \.ic\{[^}]*border:0!important/);
assert.match(glass, /\.ic\.custom-app-icon\{background:transparent!important\}/);
const rim = glass.match(/\.home \.app \.ic:after\{([^}]+)\}/)?.[1];
assert.ok(rim);
assert.match(rim, /padding:\.8px/);
assert.match(rim, /mask-composite:exclude/);
assert.match(rim, /pointer-events:none/);
assert.doesNotMatch(rim, /brightness\(/, "masked icon rims must not brighten the whole imported artwork");
assert.doesNotMatch(rim, /blur\(/);

console.log("app icon editor tests passed");

// Rim preference is saved independently from artwork and round-trips in beauty exports.
for (const js of [source,privateSource]) {
 assert.match(js,/function appIconRimSet\(tone\)[^\n]*S\.me\.appIconRim=tone==='black'\?'black':'white';applyGlassTheme\(\);save\(\);render\(\)/);
 assert.match(js,/'appIconPack','appIconRim'/);
 assert.match(js,/north-icon-rim-black',appIconRim\(\)==='black'/);
 assert.match(js,/白色线条/);assert.match(js,/黑色线条/);
}
assert.match(glass,/north-icon-rim-black \.home \.app \.ic:after\{[^}]*rgba\(0,0,0,\.86\)[^}]*backdrop-filter:none/);

// A successful late image load must undo the temporary error hiding.
for(const js of [source,privateSource]){
 const fn=js.slice(js.indexOf('function aIco('),js.indexOf('// 通用线条图标',js.indexOf('function aIco(')));
 const handler=fn.match(/onload="([^"]+)"/)[1];
 const image={style:{display:'none'},previousElementSibling:{hidden:false}};
 Function(handler).call(image);
 assert.equal(image.style.display,'');assert.equal(image.previousElementSibling.hidden,true);
}
