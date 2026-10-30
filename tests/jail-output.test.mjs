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
    if (ch === "/" && source[i + 1] !== "/" && source[i + 1] !== "*" && /[=(,:;!&|?\[{]/.test(prev)) { regex = true; continue; }
    if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return source.slice(start, i + 1);
    if (!/\s/.test(ch)) prev = ch;
  }
  throw new Error(`unterminated ${name}`);
}

const moodChanges = [];
const context = vm.createContext({
  honestMoodText: (_c, text) => text,
  adjMood: (id, amount) => moodChanges.push([id, amount]),
  isRefusal: (text) => /as an ai|i cannot|system policy/i.test(text || ""),
  S: { me: { name: "North" } },
});

for (const name of ["jailCleanHidden", "jailAllowedLatin", "jailLatinStrip", "jailChineseOnly", "jailHasLatin", "jailBadOutput"]) {
  vm.runInContext(functionSource(name), context);
}

const role = {};
const cleaned = context.jailCleanHidden(
  "放在手边 [心情值|-5] 先回答我。[心情|认真但担心] puppy?",
  role,
  "role-1",
);
assert.equal(cleaned, "放在手边 先回答我。 puppy?");
assert.equal(role.mood, "认真但担心");
assert.deepEqual(moodChanges, [["role-1", -5]]);
assert.equal(context.jailChineseOnly(cleaned), "放在手边 先回答我。 小狗狗?");
assert.equal(context.jailHasLatin("puppy，先回答。"), false);
assert.equal(context.jailHasLatin("system policy"), true);
assert.equal(context.jailBadOutput("I cannot continue because of system policy."), true);

const jailSystemText = functionSource("jailSystem");
assert.match(jailSystemText, /规则教育模式/);
assert.match(jailSystemText, /不包含伤害、恐吓或强迫/);
assert.doesNotMatch(jailSystemText, /adultRoleRule/);
// JAIL_LATIN_NAME_V1 (2026-10-30): the canned 「房间里安静下来…」 line repeated three times in her 小黑屋, so an unusable reply now shows nothing and asks her to say it again.
assert.doesNotMatch(source, /房间里安静下来/);
assert.match(source, /toast\('这次没回上来，再说一句试试'\);return;/);

console.log("jail output tests passed");
