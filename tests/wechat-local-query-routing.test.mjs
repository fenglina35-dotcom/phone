import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} must exist`);
  const brace = source.indexOf("{", start);
  let depth = 0;
  for (let i = brace; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

const sandbox = {
  S: { settings: { web: { enabled: true } } },
  meHomeCity: () => "上海",
  charHomeCity: () => "北京",
};
vm.runInNewContext(extractFunction("localPersonalStateQuery") + extractFunction("autoWebQuery") + ";globalThis.route=autoWebQuery;globalThis.local=localPersonalStateQuery;", sandbox);

assert.equal(sandbox.local("你查一下微信是不是有人给你发消息了"), true);
assert.equal(sandbox.route("你查一下微信是不是有人给你发消息了", {}), "");
assert.equal(sandbox.route("刚刚有人加你微信吗，你查一下", {}), "");
assert.equal(sandbox.route("你看看自己手机里有没有新消息", {}), "");
assert.equal(sandbox.route("帮我查一下今天北京天气", {}), "");
assert.equal(sandbox.route("联网查一下微信最新版本", {}), "");
assert.match(source, /if\(wq&&_localPersonalQuery\)/);
assert.match(source, /绝对不要联网，也不要输出\[联网\]/);

console.log("wechat local query routing tests passed");
