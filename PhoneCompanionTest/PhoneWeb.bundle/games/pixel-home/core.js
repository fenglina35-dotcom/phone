'use strict';
// Only the standalone preview consumes this clock. Persistence never moves it.
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RoseDollCore = api;
})(globalThis, function() {
  const clamp = n => Math.max(0, Math.min(100, n));
  const MAX_OFFLINE_MINUTES = 480;
  function settle(s, at) {
    if (!Number.isFinite(at)) return false;
    if (!Number.isFinite(s.lastAt)) s.lastAt = at;
    const before = `${s.sleeping}:${s.lightsOff}:${s.room}`;
    let remaining = Math.min(MAX_OFFLINE_MINUTES, Math.max(0, (at - s.lastAt) / 60000));
    // Preserve the high watermark across a backwards system clock change.
    s.lastAt = Math.max(s.lastAt, at);
    if (s.health <= 20 && !s.sleeping) {
      s.sleeping = true; s.lightsOff = true; s.room = 0;
    }
    while (remaining > 1e-9) {
      const resting = s.sleeping && s.lightsOff;
      const tired = s.food <= 15 + 1e-9 || s.energy <= 10 + 1e-9;
      let dt = remaining;
      if (!resting && !tired) {
        dt = Math.min(dt, (s.food - 15) / .10, (s.energy - 10) / .055);
      }
      if (!resting && tired && !s.sleeping && s.health > 20) {
        dt = Math.min(dt, (s.health - 20) / .05);
      }
      s.food = clamp(s.food - dt * .10);
      s.clean = clamp(s.clean - dt * .025);
      s.mood = clamp(s.mood - dt * .018);
      s.energy = clamp(s.energy + dt * (resting ? 4 : -.055));
      s.health = clamp(s.health + dt * (resting ? .06 : tired ? -.05 : 0));
      remaining -= dt;
      if (!s.sleeping && s.health <= 20 + 1e-9) {
        s.sleeping = true; s.lightsOff = true; s.room = 0;
      }
    }
    return before !== `${s.sleeping}:${s.lightsOff}:${s.room}`;
  }
  return Object.freeze({settle, MAX_OFFLINE_MINUTES});
});
