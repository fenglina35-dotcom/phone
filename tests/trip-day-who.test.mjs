import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// TRIP_DAY_WHO_V1 + TRIP_REMIND_DONE_V1 (2026-10-21): 先生 booked her a single ticket (people: only her). On the travel day
// the system line said 「今天是和先生约好的出行日」, and his own reminder was marked done the moment it was queued, so
// when the request failed (no VPN) he never said anything and was never asked again.
const PRIVATE = 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/';
function fn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  assert(i >= 0, name);
  let d = 0, k = src.indexOf('{', i);
  for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
  return src.slice(i, k + 1);
}
for (const base of ['', PRIVATE]) {
  test((base || 'web ') + 'the travel-day line says who is really travelling', () => {
    const s = fs.readFileSync(base + 'app.js', 'utf8'), box = [];
    const ctx = { getC: id => ({ id, name: '克劳德', remark: '先生' }), msgs: () => box, tvDays: () => 0, uid: () => 'x', Date };
    vm.createContext(ctx); vm.runInContext(fn(s, 'tvV2DayNotice'), ctx);
    const trip = people => ({ status: 'upcoming', date: '2026-10-22', from: '苏州', to: '西安', no: 'SP7529', dep: '08:00', railV2: true, cid: 'r1', payer: 'ta', knownRoleIds: ['r1'], people: people.map(id => ({ id })) });
    const say = people => { box.length = 0; ctx.tvV2DayNotice(trip(people)); return box[0].content; };
    const solo = say(['me']);
    assert.match(solo, /^今天是你的出行日（先生给你订的票）：/);
    assert.doesNotMatch(solo, /和先生/, 'a ticket for her alone never says she travels with him');
    assert.match(say(['me', 'role:r1']), /^今天是和先生一起出行的日子：/);
    assert.match(say(['role:r1']), /^今天是先生出行的日子：/);
  });

  for (const file of ['travel-flight-booking.js', 'travel-train-booking.js']) {
    test((base || 'web ') + file + ': the reminder only counts once he has really said it', () => {
      const today = '2026-10-22', calls = [];
      const order = { id: 'o1', accountId: 'main', flightV2: true, railV2: true, status: 'upcoming', date: today, from: '苏州', to: '西安', dep: '08:00', arr: '11:00', no: 'SP1', cls: 'economy', adults: 1, children: 0, infants: 0, pax: 1, people: [{ id: 'me', name: '我' }], payer: 'ta', cid: 'r1', price: 500, knownRoleIds: ['r1'], departAt: new Date(2099, 0, 1).getTime() };
      const S = { me: { active: 'main', name: '我' }, contacts: [{ id: 'r1', name: '先生' }], travel: { trips: [order] }, settings: {} };
      const ctx = { S, globalThis: null, todayStr: () => today, getC: id => S.contacts.find(c => c.id === id), save() {}, actId: () => 'main', isMain: () => true, tvInit: () => S.travel,
        scheduleReply: (id, note, done) => { calls.push({ id, note, done }); return true; }, cur: () => ({ p: 'home' }), document: { querySelector: () => null, getElementById: () => null }, setTimeout: () => 0, clearTimeout() {}, NorthHotelData: { payerLabel: () => '先生付款' }, NorthTravelTrain: { active: () => false }, NorthTravelFlight: { active: () => false } };
      ctx.globalThis = ctx; ctx.window = ctx; vm.createContext(ctx);
      vm.runInContext(fs.readFileSync(base + file, 'utf8'), ctx);
      const api = ctx.NorthFlightBooking && file.includes('flight') ? ctx.NorthFlightBooking : ctx.NorthTrainBooking;
      api.checkDue();
      assert.equal(calls.length, 1, 'asks him once');
      assert.notEqual(order._reminded, true, 'not marked before he has said it');
      api.checkDue();
      assert.equal(calls.length, 1, 'no second request while the first is still open in this session');
      calls[0].done(false);
      assert.notEqual(order._reminded, true, 'a failed reply (no VPN) leaves it open for the next launch');
      calls[0].done(true);
      assert.equal(order._reminded, true, 'his real reminder marks it done');
    });
  }
}
