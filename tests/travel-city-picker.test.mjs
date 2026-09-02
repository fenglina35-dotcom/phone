import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");

const expectedCodes = [
  "MFM", "TPE", "LXA", "URC", "KMG", "KUL", "ARN", "AKL", "MCO",
  "SIN", "MEL", "FCO", "SVO", "SYD", "KEF", "BKK", "ZRH", "PPT",
  "YYZ", "IST", "HEL", "CPH", "DUB", "OSL", "KHN", "CGQ",
];
for (const code of expectedCodes) {
  assert.match(source, new RegExp(`c:'${code}'`), `missing city code ${code}`);
}

assert.match(source, /\{n:'拉萨',c:'LXA'/, "Lhasa must use LXA; LAX belongs to Los Angeles");
assert.equal((source.match(/c:'KUL'/g) || []).length, 1, "KUL should not be duplicated");
assert.match(source, /const TV_CITY_GROUPS=\['国内','亚洲','欧洲','北美','大洋洲','太平洋岛屿'\]/);
assert.match(source, /function tvCitySearchText\(c\)/);
assert.match(source, /function tvCityPickerHTML\(which,q\)/);
assert.match(source, /function tvFilterCities\(which\)/);
assert.match(source, /placeholder="搜索城市、地区或机场代码"/);
assert.match(source, /a:\['马来西亚'\]/);
assert.match(source, /a:\['云南'\]/);
assert.match(source, /\{n:'南昌',c:'KHN'[\s\S]*?r:'江西',a:\['江西'\]\}/);
assert.match(source, /\{n:'长春',c:'CGQ'[\s\S]*?r:'吉林',a:\['吉林','吉林长春'\]\}/);

console.log("travel city picker tests passed");
