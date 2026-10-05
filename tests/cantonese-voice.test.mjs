import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const backend = fs.readFileSync(new URL("../supabase/functions/phone-ai/index.ts", import.meta.url), "utf8");

function functionSource(name) {
  const start = source.indexOf(`function ${name}`);
  assert.ok(start >= 0, `missing ${name}`);
  const brace = source.indexOf("{", start);
  let depth = 0, quote = "", escaped = false, regex = false, regexClass = false, prev = "";
  for (let i = brace; i < source.length; i++) {
    const ch = source[i];
    if (regex) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === "[") regexClass = true;
      else if (ch === "]") regexClass = false;
      else if (ch === "/" && !regexClass) regex = false;
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") { quote = ch; continue; }
    if (ch === "/" && source[i + 1] !== "/" && source[i + 1] !== "*" && /[=(,:;!&|?\[{]/.test(prev)) { regex = true; continue; }
    if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return source.slice(start, i + 1);
    if (!/\s/.test(ch)) prev = ch;
  }
  throw new Error(`unterminated ${name}`);
}

const context = vm.createContext({
  CJK_RE: /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g,
  CN_PUNCT_RE: /[（）()「」『』【】《》〈〉、，。．！？；：…—～·“”‘’]/g,
  hasCN: (value) => /[\u3400-\u9fff]/.test(value || ""),
});
for (const name of ["normVoiceLang", "voiceLangName", "voiceOriginalRule", "hasForeign", "pickSpoken"]) {
  vm.runInContext(functionSource(name), context);
}

assert.equal(context.normVoiceLang("粤语"), "粤");
assert.equal(context.normVoiceLang("cantonese"), "粤");
assert.equal(context.voiceLangName("yue-HK"), "粤语");
assert.match(context.voiceOriginalRule("粤"), /自然地道的粤语口语/);
assert.equal(context.hasForeign("我好掛住你", "粤"), true);
assert.equal(context.pickSpoken("我好掛住你（我很想你）", "粤"), "我好掛住你");

assert.match(source, /option value="粤"[^>]*>粤语<\/option>/);
assert.match(source, /option value="yue-HK"[^>]*>粤语 → 粤语文字<\/option>/);
assert.match(source, /option value="yue"[^>]*>粤语 \+ 普通话字幕<\/option>/);
assert.match(source, /'粤':'Chinese,Yue'/);
assert.match(source, /x==='粤'\?'yue':/);
assert.match(source, /我喺度呀，頭先有啲走神/);
assert.match(source, /粵語|粤语原文必须使用自然/);

assert.match(backend, /"Chinese,Yue"/);
assert.match(backend, /return "16k_yue"/);

console.log("Cantonese voice coverage tests passed");
