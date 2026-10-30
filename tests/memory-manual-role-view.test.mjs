import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// MEMORY_MANUAL_ROLE_VIEW_V1 (2026-10-30, her report): a role memory she typed as 「我的…」 was saved as 「North的…」.
// Manual add and edit went through aboutMeNoteText, which rewrites 我 into her name. She writes role memories from the
// role's own view, so manual entries are now kept as written (rolePerspective), and the prompt reads them with memoryText.
function fn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  assert(i >= 0, name);
  let d = 0, k = src.indexOf('{', i);
  for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
  return src.slice(i, k + 1);
}
for (const file of ['app.js', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js']) {
  const s = fs.readFileSync(file, 'utf8');
  test(file + ': editing a memory to 「我的…」 keeps it as the role wrote it', () => {
    const role = { id: 'r1', name: '克劳德', remark: '先生', memory: ['North喜欢猫'] };
    const meta = {};
    const ctx = { S: { me: { name: 'North' } }, getC: () => role, memoryList: c => c.memory, memoryMetaStore: () => meta, memoryScopeKey: () => 'main', saveNow: () => {}, editMemory: () => {}, toast: () => {} };
    vm.createContext(ctx);
    vm.runInContext(['aboutMeNoteText', 'roleMemoryPerspectiveText', 'memoryText', 'memoryNorm', 'memoryEditAt'].map(n => fn(s, n)).join('\n'), ctx);
    ctx.memoryEditAt('r1', 0, '我的生日是三月二号');
    assert.equal(ctx.memoryText(role.memory[0]), '我的生日是三月二号');
    assert.doesNotMatch(JSON.stringify(role.memory[0]), /North/);
  });
  test(file + ': manual add saves from the role\'s view, and the prompt does not print [object Object]', () => {
    assert(s.includes("r=rememberForChar(c,text,{rolePerspective:true})"), 'manual add keeps the role view');
    assert(!s.includes("_mem.map((m,i)=>(i+1)+'. '+aboutMeNoteText(m))"), 'prompt reads memories with memoryText');
  });
}
