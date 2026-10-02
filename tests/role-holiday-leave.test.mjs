import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const files={
  web:fs.readFileSync(new URL('../app.js',import.meta.url),'utf8'),
  private:fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js',import.meta.url),'utf8'),
};
function fnSource(source,name){
  const start=source.indexOf(`function ${name}(`);assert.ok(start>=0,`missing ${name}`);
  const brace=source.indexOf('{',start);let depth=0,quote='',escape=false;
  for(let i=brace;i<source.length;i++){const ch=source[i];
    if(quote){if(escape)escape=false;else if(ch==='\\')escape=true;else if(ch===quote)quote='';continue;}
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return source.slice(start,i+1);}
  throw new Error(`unterminated ${name}`);
}
const NAMES=['toMin','weekdayCN','roleWorkday','scheduleDateKey','scheduleDateParse','scheduleLeaveDays','scheduleLeaves','roleLeaveOn','roleHolidayTables','roleHolidaysOn','roleHolidayAt','roleHolidayOn','roleMakeupWorkday','roleDayOff','roleUpcomingHolidays','activityHash','activityPick','whereNow','activitySpec','roleScheduleBrief','scheduleLeaveLabel','roleSchedulePrompt'];
function box(source){
  const sb={Date,Math,String,Object,Array,S:{settings:{timeAware:true},me:{name:'忆北'},cohabitation:null},roleClockDate:t=>new Date(t||sb.NOW||Date.now()),NOW:0,roleTimeParts:t=>({weekday:new Date(t).getDay()})};
  vm.runInNewContext(NAMES.map(n=>fnSource(source,n)).join('\n')+';globalThis.api={'+NAMES.join(',')+'};',sb);
  return sb;
}
const role=(extra)=>({id:'r1',name:'先生',sched:Object.assign({on:true,work:'公司',home:'家',amS:'09:00',amE:'12:00',pmS:'13:30',pmE:'18:00',leaves:[]},extra||{})});

for(const [label,source] of Object.entries(files)){
  test(`${label}: national day and valentine-style days are days off, makeup Saturdays are workdays`,()=>{
    const {api}=box(source),c=role();
    assert.equal(api.roleDayOff(c,new Date(2026,9,2,10)).kind,'holiday');           // 国庆 周五
    assert.match(api.roleDayOff(c,new Date(2026,9,5,10)).label,/国庆节/);
    assert.equal(api.roleDayOff(c,new Date(2026,9,8,10)),null);                       // 假期结束 周四
    assert.equal(api.roleDayOff(c,new Date(2026,9,10,10)),null);                      // 调休 周六上班
    assert.equal(api.roleDayOff(c,new Date(2026,8,20,10)),null);                      // 调休 周日上班
    assert.equal(api.roleDayOff(c,new Date(2026,9,11,10)).kind,'weekend');
    assert.equal(api.roleDayOff(c,new Date(2026,7,19,10)).holiday.name,'七夕');       // 周三
    assert.equal(api.roleDayOff(c,new Date(2026,4,20,10)).holiday.name,'520');
    assert.equal(api.roleDayOff(c,new Date(2026,1,14,10)).holiday.name,'情人节');     // 补班日也放情人节
    assert.equal(api.roleDayOff(c,new Date(2026,11,25,10)).holiday.name,'圣诞节');
    assert.match(api.whereNow(c,new Date(2026,9,2,10,30)),/国庆节假期/);
    assert.equal(api.activitySpec(c,new Date(2026,9,2,10,30)).key,'holiday-free-am');
    assert.equal(api.activitySpec(c,new Date(2026,9,10,10,30)).key,'work-am');
  });
  test(`${label}: holidays can be switched off per role`,()=>{
    const {api}=box(source),c=role({holidays:false});
    assert.equal(api.roleDayOff(c,new Date(2026,9,2,10)),null);
    assert.equal(api.roleDayOff(c,new Date(2026,9,10,10)).kind,'weekend');
    assert.equal(api.activitySpec(c,new Date(2026,9,2,10,30)).key,'work-am');
  });
  test(`${label}: leave I give the role wins and the prompt says I gave it`,()=>{
    const sb=box(source),{api}=sb,c=role({leaves:[{start:'2026-10-12',end:'2026-10-13',reason:'陪我',source:'me'}]});
    assert.equal(api.roleDayOff(c,new Date(2026,9,12,10)).kind,'leave');
    sb.NOW=+new Date(2026,9,12,10);
    const p=api.roleSchedulePrompt(c);
    assert.match(p,/忆北亲自给你请的/);assert.match(p,/陪我/);
    sb.NOW=+new Date(2026,9,2,10);
    assert.match(api.roleSchedulePrompt(c),/国庆节法定假期（2026-10-01 至 2026-10-07），放假不上班/);
    sb.NOW=+new Date(2026,9,10,10);
    assert.match(api.roleSchedulePrompt(c),/调休的补班日/);
    sb.NOW=+new Date(2026,7,10,10);
    assert.match(api.roleSchedulePrompt(c),/近期节假日（到时放假）：七夕 2026-08-19/);
  });
  test(`${label}: schedule modal has a holiday switch and a manual leave form`,()=>{
    const set=fnSource(source,'schedSet'),add=fnSource(source,'schedAddLeave'),saved=fnSource(source,'saveSched');
    assert.match(set,/id="sc_hol"/);assert.match(set,/给ta请假/);assert.match(set,/id="sc_lvS"/);assert.match(set,/我请的/);
    assert.match(add,/source:'me'/);assert.match(add,/on:true/);assert.match(add,/cohabAdvance\(id\)/);
    assert.match(saved,/holidays:\$\('#sc_hol'\)/);
    assert.match(fnSource(source,'roleServerScheduleConfig'),/roleUpcomingHolidays/);
  });
}
