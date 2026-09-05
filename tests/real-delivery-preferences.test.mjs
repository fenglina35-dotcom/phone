import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = await readFile(new URL('../delivery.js', import.meta.url), 'utf8');
const bundled = await readFile(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/delivery.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../glass-theme.css', import.meta.url), 'utf8');

for (const [name, src] of [['web', root], ['private', bundled]]) {
  test(`${name}: preference values are independent typed candidates`, () => {
    assert.match(src, /split\(\/\[\\n,，;；\]\+\//);
    assert.match(src, /'merchant'\]/);
    assert.match(src, /'product'\]/);
    assert.match(src, /'spec'\]/);
    assert.match(src, /delivery-pref-chip/);
    assert.match(src, /deliveryPreferenceAdd/);
    assert.match(src, /deliveryPreferenceRemove/);
  });

  test(`${name}: merchant and product semantics cannot be merged`, () => {
    assert.match(src, /每一个「」条目都是独立候选/);
    assert.match(src, /先判断本次类别，再选一家门店，再逐件选择商品/);
    assert.match(src, /门店候选”只能用于确定一家商家，绝不能当成要买的食物/);
    assert.match(src, /商品候选”必须一件一件加入，绝不能把多个候选拼成一次搜索/);
    assert.match(src, /例如「曼玲粥」是品牌/);
  });

  test(`${name}: category rules preserve meal combos and KFC signature-bundle completion`, () => {
    assert.match(src, /KFC 门店固定为肯德基/);
    assert.match(src, /招牌汉堡4件套/);
    assert.match(src, /没有说套餐[\s\S]*多个单品[\s\S]*一个一个搜索并加入购物车/);
    assert.match(src, /明确说套餐、四件套时/);
    assert.match(src, /套餐已经包含的商品不得重复/);
    assert.match(src, /其余归为普通主食/);
    assert.match(src, /主食允许套餐或单点/);
    assert.match(src, /明确说套餐或单点，必须照做/);
    assert.match(src, /主动决定时，也只能从某一类别中选一家门店和少量具体商品/);
  });

  test(`${name}: sold-out options pause the same task and return to the real role`, () => {
    assert.match(src, /kind:'unavailable_item'/);
    assert.match(src, /requestRoleUnavailable/);
    assert.match(src, /应视为当前售罄或不可选/);
    assert.match(src, /句式必须由你自己生成/);
    assert.match(src, /沿用同一个 taskId 继续/);
  });
}

test('preference editor renders independent chips', () => {
  assert.match(css, /\.delivery-pref-chip\s*\{/);
  assert.match(css, /\.delivery-pref-chip button\s*\{/);
  assert.match(css, /\.delivery-pref-entry\s*\{/);
  assert.match(css, /\.delivery-pref-entry button\s*\{/);
});
