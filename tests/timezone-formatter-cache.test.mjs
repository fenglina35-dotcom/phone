import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const copies=[
  path.join(root,'app.js'),
  path.join(root,'native','private-small-phone','XcodeProject','PhoneCompanionTest','PhoneWeb.bundle','app.js'),
];

function timeSource(file){
  const source=fs.readFileSync(file,'utf8');
  const start=source.indexOf('const ROLE_TIME_ZONE_CACHE_MS=');
  const end=source.indexOf('function timeZoneOffsetText(',start);
  assert.ok(start>=0&&end>start,`${file} must contain the cached role-time implementation`);
  return source.slice(start,end);
}

function makeContext(source){
  const RealDateTimeFormat=Intl.DateTimeFormat;
  let constructions=0;
  function CountingDateTimeFormat(...args){
    constructions++;
    return new RealDateTimeFormat(...args);
  }
  CountingDateTimeFormat.supportedLocalesOf=RealDateTimeFormat.supportedLocalesOf.bind(RealDateTimeFormat);
  const context=vm.createContext({
    Date,
    Map,
    String,
    Intl:{DateTimeFormat:CountingDateTimeFormat},
    S:{settings:{timeZone:''}},
  });
  vm.runInContext(source,context);
  return{
    context,
    count:()=>constructions,
    run:expression=>vm.runInContext(expression,context),
  };
}

for(const file of copies){
  const source=timeSource(file);
  assert.match(source,/if\(!tz\|\|tz===localZone\)return localRoleTimeParts\(when,localZone\)/,
    `${file} must keep the default/device timezone on the native Date fast path`);
  assert.match(source,/_roleTimeFormatterCache\.get\(zone\)/,
    `${file} must reuse one formatter per non-local timezone`);

  const harness=makeContext(source);
  const stamp=1700000000000;
  harness.context.stamp=stamp;
  harness.run('roleTimeParts(stamp)');
  assert.equal(harness.count(),1,`${file} local time may resolve the device timezone once`);
  for(let i=0;i<250;i++){harness.context.tick=i;harness.run('roleTimeParts(stamp+tick*1000)');}
  assert.equal(harness.count(),1,`${file} repeated local clock ticks must not rebuild Intl formatters`);

  const localZone=harness.run('deviceTimeZone()');
  harness.context.targetZone=localZone==='America/New_York'?'Asia/Tokyo':'America/New_York';
  const beforeRemote=harness.count();
  const remote=harness.run('roleTimeParts(stamp,targetZone)');
  assert.equal(harness.count()-beforeRemote,2,
    `${file} first non-local lookup should create only one validator and one reusable formatter`);
  for(let i=0;i<250;i++){harness.context.tick=i;harness.run('roleTimeParts(stamp+tick*1000,targetZone)');}
  assert.equal(harness.count()-beforeRemote,2,`${file} repeated non-local clock ticks must reuse caches`);
  assert.equal(remote.zone,harness.context.targetZone);

  const beforeInvalid=harness.count();
  for(let i=0;i<50;i++)assert.equal(harness.run("timeZoneValid('Mars/Olympus')"),false);
  assert.equal(harness.count()-beforeInvalid,1,`${file} invalid timezone results must also be cached`);

  const local=harness.run('roleTimeParts(stamp)');
  const expected=new Date(stamp);
  assert.deepEqual(
    [local.year,local.month,local.day,local.hour,local.minute,local.second,local.weekday],
    [expected.getFullYear(),expected.getMonth()+1,expected.getDate(),expected.getHours(),expected.getMinutes(),expected.getSeconds(),expected.getDay()],
    `${file} native fast path must preserve local calendar semantics`,
  );
}

assert.equal(timeSource(copies[0]),timeSource(copies[1]),'web and private App role-time implementations must stay aligned');
console.log('timezone formatter cache tests passed');
