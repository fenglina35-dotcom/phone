/* 快捷指令与查岗页面外观（2026-10-16 实机截图）：返回键是大白块、文字是黑色看不清、滑动时会卡住。
   原因：返回键用了系统按钮（自带白底）；页面不在深色设置页名单里，文字默认黑色；
   后台每 15 秒检查一次就整页重画，正在滑动时被打断。这里锁住三处修正，网页版与私人版两份都要有。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
for(const file of ['phone-shortcuts.js','native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/phone-shortcuts.js']){
  test(file+': back key has no white block, text is light, unchanged page is not re-rendered',()=>{
    const s=read(file);
    assert.doesNotMatch(s,/<button class="l" onclick="back\(\)"/,'back key is not a system button');
    assert.match(s,/<div class="nav"><span class="l" role="button" tabindex="0" onclick="back\(\)" aria-label="返回">‹<\/span>/);
    assert.match(s,/#shortcut-settings-page\{color:#f2f2f4/,'light text on the dark page');
    assert.doesNotMatch(s,/<main class="scroll"/);
    const start=s.indexOf("let shownPage='';"),end=s.indexOf('}',s.indexOf('function paint(',start))+1;
    assert.ok(start>0,'paint remembers what is shown');
    let renders=0,html='A';
    const ctx=vm.createContext({cur:()=>({p:'shortcutSettings'}),render:()=>{renders++;},page:()=>html});
    vm.runInContext(s.slice(start,end)+';shownPage="A";',ctx);
    ctx.paint();assert.equal(renders,0,'same content: no full re-render that would interrupt scrolling');
    html='B';ctx.paint();assert.equal(renders,1,'changed content still re-renders');
  });
}
