import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

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
    const before = source.slice(Math.max(brace, i - 16), i);
    if (ch === "/" && source[i + 1] !== "/" && source[i + 1] !== "*" && (/[=(,:;!&|?\[{]/.test(prev) || /\breturn\s*$/.test(before))) { regex = true; continue; }
    if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return source.slice(start, i + 1);
    if (!/\s/.test(ch)) prev = ch;
  }
  throw new Error(`unterminated ${name}`);
}

const context = vm.createContext({});
vm.runInContext(functionSource("phSpoofNoWrongSms"), context);

for (const bad of ["认错人了", "不好意思找错人了", "我发错人了", "可能是我弄错人了", "wrong person", "mistaken number"]) {
  const cleaned = context.phSpoofNoWrongSms(bad);
  assert.notEqual(cleaned, bad);
  assert.doesNotMatch(cleaned, /认错|找错|发错|弄错|wrong person|mistaken/i);
}

assert.match(source, /禁止天气、苏州、路过、方便聊吗、猜猜我是谁、打错、发错、认错人、找错人、弄错人、误会了、不认识/);
assert.match(source, /绝对不要说“你是谁\/哪位\/你发给我\/发错了\/认错人\/找错人\/弄错人\/误会了\/不认识\/不是本人”/);

const aliasContext = vm.createContext({
  S: { me: { name: "North", callName: "Bei" }, offline: {} },
  powerConfig: () => ({}),
  selectRelevantMemory: () => ({ items: [{ score: 99 }] }),
  memoryTerms: (s) => String(s || "").match(/[\u3400-\u9fff]{1,}|[a-zA-Z]{2,}/g) || [],
  memoryList: () => [],
  memoryScopeKey: () => "main",
  memoryText: (v) => String(v || ""),
  summaryList: (c) => c.summaries || [],
  summaryCleanText: (_, t) => String(t || ""),
  lifeNotes: () => [],
  isLover: () => false,
  behaviorStore: () => ({ items: [] }),
  behaviorOn: () => false,
  setInterval: () => 0,
  setTimeout: () => 0,
});

for (const name of [
  "phEscRe",
  "phCallAdmits",
  "phAdmitFallback",
  "phStripFalseAdmit",
  "phSmsAdmitLine",
  "phAliasNormText",
  "phAliasGenericTerm",
  "phAliasOnlyGenericGuess",
  "phAliasPrivateTerms",
  "phAliasPrivateSources",
  "phAliasIdentityClue",
  "phSpoofExposed",
]) {
  vm.runInContext(functionSource(name), aliasContext);
}

const role = { id: "r1", name: "Mr North", remark: "Mr North", callme: "kitten", selfcall: "Sir", catchphrase: "", power: {} };

assert.equal(aliasContext.phAliasOnlyGenericGuess("你是哥哥吗"), true);
assert.equal(aliasContext.phAliasIdentityClue("你是哥哥吗", role), false);
assert.equal(aliasContext.phAliasIdentityClue("我只是好奇", role), false);
assert.equal(aliasContext.phSpoofExposed("[识破]", "你是哥哥吗", role), false);
assert.equal(aliasContext.phSpoofExposed("[识破]", "我只是好奇", role), false);
assert.equal(aliasContext.phSpoofExposed("[识破]", "你是 Sir 吗", role), true);
const admitLine = aliasContext.phSmsAdmitLine("不是。猜猜看，还有两次机会。", role);
assert.match(admitLine, /猜猜看/);
assert.doesNotMatch(admitLine, /不是/);
assert.notEqual(admitLine, "嗯，是我。猜猜看，还有两次机会。");
const cleanedAdmitLine = aliasContext.phSmsAdmitLine("嗯，是我。不是。猜猜看。", role);
assert.match(cleanedAdmitLine, /猜猜看/);
assert.doesNotMatch(cleanedAdmitLine, /不是/);

const polishContext = vm.createContext({
  phCleanSmsText: (s) => String(s || ""),
  phSpoofNoWrongSms: (s) => String(s || ""),
  phSpoofSmsFallback: () => "换一个更有钩子的开场。",
});
vm.runInContext(functionSource("phSpoofSmsPolish"), polishContext);
assert.equal(polishContext.phSpoofSmsPolish("睡了吗。", {}, "seed", "open"), "换一个更有钩子的开场。");
assert.equal(polishContext.phSpoofSmsPolish("睡没睡？", {}, "seed", "open"), "换一个更有钩子的开场。");
/* 上下文条数不再写死：跟随设置里那个「带几个回合」（phCtxRows） */
assert.match(source, /phSmsArr\(num,num\)\.slice\(-phCtxRows\(\)\)/);
assert.doesNotMatch(source, /phSmsArr\(num,num\)\.slice\(-\d+\)/);
assert.doesNotMatch(source, /meN>=7&&!action/);

console.log("phone spoof guard tests passed");
