import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// 2026-10-30 second batch from her list: alarm row (ALARM_ROW_V1), voice page row (VOICE_TUNE_ROW_V1), round 共同生活
// arrow (COHAB_TAP_ROUND_V1), home widgets redrawn after the app comes back (HOME_GLASS_KEEP_V1), birthdays (BIRTHDAY_V1).
function fn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  assert(i >= 0, name);
  let d = 0, k = src.indexOf('{', i);
  for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
  return src.slice(i, k + 1);
}
const PB = 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/';
for (const [app, css, me] of [['app.js', 'glass-theme.css', 'wechat-me.js'], [PB + 'app.js', PB + 'glass-theme.css', PB + 'wechat-me.js']]) {
  const s = fs.readFileSync(app, 'utf8'), c = fs.readFileSync(css, 'utf8'), w = fs.readFileSync(me, 'utf8');
  test(app + ': the alarm row has a readable tag and a switch that stays in the box', () => {
    assert(s.includes('class="alarm-tag"') && s.includes('class="alarm-sw') && !s.includes('<span class="tag">${a.repeat'));
    assert(/\.alarm-row \.alarm-tag\{[^}]*background:#3d2531[^}]*color:#ff9cc4/.test(c));
    assert(/\.alarm-row \.alarm-sw\.on\{background:#07c160/.test(c));
    assert(/\.alarm-row \.alarm-ctl\{flex:0 0 auto/.test(c), 'controls never squeezed');
  });
  test(app + ': the voice page tuning row no longer borrows the list row style', () => {
    assert(s.includes('<label class="voice-tune-row" for="v_api_tuning">') && !s.includes('<label class="it" style="padding:9px 0"><span>API音色'));
    assert(/\.voice-tune-row\{display:flex!important/.test(c));
  });
  test(css + ': the tap-next arrow is a round bubble', () => {
    assert(/\.cohab-stage \.cohab-tap-next\{[^}]*width:40px;height:40px;border-radius:20px/.test(c));
  });
  test(app + ': home glass is redrawn when the app comes back', () => {
    const canvases = [{ dataset: { lgKey: 'k1' } }, { dataset: { lgKey: 'k2' } }];
    let soon = 0;
    const ctx = { document: { hidden: false, querySelectorAll: () => canvases }, lgActive: () => true, lgSoon: () => { soon++; }, _lg: { failed: true, cache: new Map([['k1', {}]]) } };
    vm.createContext(ctx); vm.runInContext(fn(s, 'lgResumeRedraw'), ctx);
    ctx.lgResumeRedraw();
    assert.equal(ctx._lg.cache.size, 0); assert.equal(ctx._lg.failed, false); assert.equal(canvases[0].dataset.lgKey, ''); assert.equal(soon, 1);
    assert(s.includes("document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(lgResumeRedraw,250);});"));
  });
  const bday = () => {
    const ctx = { S: { me: { name: 'North', birthday: '1999-10-30' }, couple: { cid: 'r1', anniversaries: [] }, contacts: [] }, calls: [], F: {} };
    ctx.getC = id => ctx.S.contacts.find(x => x.id === id);
    ctx.roleOnlineProactiveBlocked = () => false;
    ctx.holidayCareWindow = () => true;
    ctx.holidayCare = (id, name, date, opt) => { ctx.calls.push(['couple', id, opt && opt.profile]); return Promise.resolve(true); };
    ctx.scheduleReply = (id, note, done) => { ctx.calls.push(['role', id, note]); done(true); return true; };
    ctx.calendarDeliver = (key, today, job) => { if (ctx.F[key] === today) return false; ctx.F[key] = today; job(); return true; };
    vm.createContext(ctx);
    vm.runInContext(['birthdayNorm', 'birthdayLabel', 'birthdayIsToday', 'birthdayPrompt', 'birthdayCare', 'birthdayCareTick'].map(n => fn(s, n)).join('\n'), ctx);
    return ctx;
  };
  test(app + ': the role and her birthday are told apart in the prompt', () => {
    const ctx = bday();
    const p = ctx.birthdayPrompt({ id: 'r1', birthday: '1990-03-02' });
    assert.match(p, /你自己的生日：1990年3月2日/); assert.match(p, /North的生日：1999年10月30日/); assert.match(p, /这是North的生日，不是你的/);
    assert.equal(ctx.birthdayPrompt({ id: 'r2' }).includes('你自己的生日'), false, 'no line for an unset role birthday');
    assert.equal(ctx.birthdayNorm('3-2'), '03-02'); assert.equal(ctx.birthdayNorm('2026-13-01'), '');
  });
  test(app + ': on her birthday every role with proactive messages wishes her once', () => {
    const ctx = bday(), now = new Date(2026, 9, 30, 9, 0);
    ctx.S.contacts = [{ id: 'r1', name: '先生', proactive: { enabled: true } }, { id: 'r2', name: '林', proactive: { enabled: true } }, { id: 'r3', name: '无主动', proactive: { enabled: false } }, { id: 'r4', name: '拉黑', blocked: true, proactive: { enabled: true } }];
    ctx.birthdayCareTick('2026-10-30', now, ctx.F); ctx.birthdayCareTick('2026-10-30', now, ctx.F);
    assert.deepEqual(ctx.calls.map(x => x[0] + ':' + x[1]), ['couple:r1', 'role:r2'], 'couple via 节日心意, others plain, each once');
    assert.equal(ctx.calls[0][2], true); assert.match(ctx.calls[1][2], /个人资料里写的生日，不是你的生日/);
    const other = bday(); other.S.contacts = [{ id: 'r2', proactive: { enabled: true } }];
    other.birthdayCareTick('2026-10-29', new Date(2026, 9, 29, 9, 0), other.F); assert.equal(other.calls.length, 0, 'not on other days');
  });
  test(app + ': birthdays are edited, saved, kept on clear-all and read into the prompt', () => {
    assert(s.includes('<input id="c_birthday" type="date"') && s.includes("if($('#c_birthday'))c.birthday=birthdayNorm($('#c_birthday').value);"));
    assert(s.includes("s+=birthdayPrompt(c);if(!opt.selectiveMemory)") && s.includes("birthdayCareTick(today,now,F);"));
    assert(s.includes("'city','birthday'].forEach(k=>{if(m[k]!=null)fresh.me[k]=m[k];})") && s.includes("'imageStudio','birthday'];"));
    assert(w.includes("wxProfileRow('生日'") && w.includes('function wxProfileBirthdaySet('));
  });
}
