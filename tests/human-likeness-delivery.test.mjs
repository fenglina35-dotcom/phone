import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

function functionSource(name) {
  const start = source.indexOf(`function ${name}`);
  assert.ok(start >= 0, `missing ${name}`);
  const brace = source.indexOf('{', start);
  let depth = 0, quote = '', escaped = false;
  for (let i = brace; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

const interpret = functionSource('hlInterpret');
assert.match(interpret, /\(\?:低频\)\?主动消息/, 'the planner must recognize the current proactive note name');

assert.doesNotMatch(functionSource('currentActivityPrompt'), /humanLikeOn/, 'current activity has its own switch');
assert.doesNotMatch(functionSource('personaGuardOn'), /humanLikeOn/, 'persona protection has its own switch');

const schedule = functionSource('scheduleReply');
assert.match(schedule, /success=\(await aiReply\(id,note,token,aid,replyIntent\)\)===true/, 'queued replies must report actual delivery completion');
assert.match(functionSource('aiReply'), /return delivered/, 'AI replies must expose whether a visible message was delivered');

const alarm = functionSource('checkAlarms');
assert.ok(alarm.indexOf('incomingCall(') < alarm.indexOf('_alarmFired[a.id]=tag'), 'an alarm is consumed only after its call starts');

const steps = functionSource('checkStepReport');
assert.ok(steps.indexOf('scheduleReply(') < steps.indexOf('_stepRptDate=today'), 'step care is marked only after it is queued');

const escalation = functionSource('checkIgnore');
assert.ok(escalation.indexOf('fireEscalation(') < escalation.indexOf('c._esc.stage=target'), 'ignore escalation advances only after contact starts');
assert.match(functionSource('fireEscalation'), /return !!fired/, 'escalation must report whether it actually fired');

const followups = functionSource('checkFollowups');
assert.ok(followups.indexOf('scheduleReply(') < followups.indexOf('f.asked=true'), 'a follow-up is consumed only after it is queued');

assert.match(functionSource('checkCalendar'), /calendarDeliver\(/, 'calendar events use retryable delivery');
assert.match(functionSource('calendarDeliver'), /if\(ok\).*_calFired/s, 'calendar events are marked only on success');

const food = functionSource('checkFoodDelivery');
assert.match(food, /deliveryNotified===false/, 'food arrival reporting keeps a retry marker');
assert.ok(food.indexOf('scheduleReply(') < food.indexOf('m.deliveryNotified=true'), 'food arrival is marked notified only after queuing');
const giftFood = functionSource('checkGiftDelivery');
assert.match(giftFood, /g\.notified===false/, 'role-paid food reporting remains retryable');
assert.ok(giftFood.indexOf('scheduleReply(') < giftFood.indexOf('g.notified=true'), 'role-paid food is marked notified only after queuing');

const spy = functionSource('checkSpyTime');
assert.ok(spy.indexOf('await doSpyView') < spy.indexOf('_spyFired[c.id]=today'), 'timed inspection is consumed only after it completes');
assert.ok(spy.indexOf('await doSpyView') < spy.indexOf('sp.timedDay=today'), '当天标记同样只在真正查完之后才落盘');

const autoPost = functionSource('scanAutoPost');
assert.doesNotMatch(autoPost, /pc\.m\+\+;pc\.last=.*doAutoMoment/, 'auto moments must not be counted before generation');
assert.match(autoPost, /\.then\(ok=>\{if\(!ok\)return;/, 'automatic posts are counted only after successful publishing');
assert.match(functionSource('doAutoMoment'), /publishRoleSocialAutonomous\(c,'moment'/, 'automatic moments wait for the autonomous media pipeline and report only successful publishing');
assert.match(functionSource('doAutoTweet'), /publishRoleSocialAutonomous\(c,'x'/, 'automatic tweets wait for the autonomous media pipeline and report only successful publishing');

const mail = functionSource('scanMail');
assert.match(mail, /const prevLast=pc\.last;pc\.n\+\+;pc\.last=Date\.now\(\);save\(0\);/, '每日信件要先占坑再写：写成了才留着，没写成把坑退回去');
assert.match(functionSource('genLetter'), /return true/, 'letter generation reports successful delivery');

console.log('human-likeness delivery tests passed');
