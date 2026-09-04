import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const bundled=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js',import.meta.url),'utf8');

function functionSource(input,name){
  const start=input.indexOf('function '+name+'(');
  assert.ok(start>=0,'missing '+name);
  const next=input.indexOf('\nfunction ',start+10);
  return input.slice(start,next<0?input.length:next).trim();
}

function exercise(input,throws=false){
  const sandbox={
    Date,
    button:{nodeType:1,dataset:{cohabAction:'enter',cohabCid:'c1'},disabled:false,isConnected:true},
    entered:'',messages:[],errors:[],
    cohabEnter:id=>{if(throws)throw new Error('paint failed');sandbox.entered=id;},
    cohabToggle:()=>{},cohabControls:()=>{},offQuit:()=>{},
    toast:message=>sandbox.messages.push(message),
    console:{error:(...args)=>sandbox.errors.push(args)}
  };
  vm.runInNewContext(`let _cohabActionGuard={key:'',at:0};${functionSource(input,'cohabActionTap')}\ncohabActionTap(button);`,sandbox);
  return sandbox;
}

test('co-living entry does not require WebKit to expose an implicit event object',()=>{
  for(const [label,input] of [['web',root],['private bundle',bundled]]){
    const fn=functionSource(input,'cohabActionTap');
    assert.doesNotMatch(fn,/\bevent\b/,`${label} handler still depends on an implicit event`);
    assert.match(input,/data-cohab-action="enter" data-cohab-cid="\$\{esc\(cid\)\}" onclick="return cohabActionTap\(this\)"/);
    assert.match(input,/function cohabWechatNavBadge\(c\).*data-cohab-cid="\$\{esc\(c\.id\)\}" onclick="return cohabActionTap\(this\)"/s);
    assert.doesNotMatch(input,/cohabActionTap\(event/);
    const passed=exercise(input);
    assert.equal(passed.entered,'c1');
    assert.equal(passed.button.disabled,false);
    assert.deepEqual(passed.messages,[]);
  }
});

test('co-living entry reports a visible error and re-enables the button if navigation throws',()=>{
  const failed=exercise(root,true);
  assert.equal(failed.entered,'');
  assert.equal(failed.button.disabled,false);
  assert.equal(failed.errors.length,1);
  assert.deepEqual(failed.messages,['共同生活入口异常，已安全复位：paint failed']);
});

test('co-living repairs malformed persisted rows before rendering and rolls navigation back on failure',()=>{
  for(const [label,input] of [['web',root],['private bundle',bundled]]){
    const repair=functionSource(input,'cohabRepairRows');
    const sandbox={uid:(()=>{let n=0;return()=>`fixed-${++n}`;})()};
    vm.runInNewContext(`${repair};this.run=cohabRepairRows;`,sandbox);
    const rows=sandbox.run([null,'旧旁白',{id:'ok',who:'me',text:'  我回来了  ',time:10},[],{text:''}],'message',100);
    assert.equal(rows.length,2,`${label} must drop null, arrays and empty rows`);
    assert.equal(rows[0].who,'旁白');
    assert.equal(rows[0].text,'旧旁白');
    assert.equal(rows[1].text,'我回来了');
    assert.match(functionSource(input,'renderCohab'),/messages=\(o\.msgs\|\|\[\]\)\.filter\(m=>m&&typeof m==='object'\)/);
    assert.match(functionSource(input,'cohabEnter'),/previousStack=stack\.slice\(\)/);
    assert.match(functionSource(input,'cohabEnter'),/stack\.length=0;previousStack\.forEach/);
  }
});

test('co-living entry restores the previous route, role and scene when render throws',()=>{
  for(const [label,input] of [['web',root],['private bundle',bundled]]){
    const sandbox={root:{enabled:true,paused:false,cid:'old'},stack:[{p:'home'},{p:'offline'}],_off:{id:'old',mode:'date'},Date,
      cohabRoot:()=>sandbox.root,cohabDefaultCid:()=>'',getC:id=>id==='c1'?{id}:null,closeModal(){},
      cohabAdvance:()=>({phoneInspectDueAt:1}),go:(p,params)=>{sandbox.stack.push({p,...params});throw new Error('render failed');},
      cohabPersistAfterEnter(){},cohabScheduleArrival(){},toast(){}};
    const before=JSON.stringify(sandbox.stack),oldOff=sandbox._off;
    vm.runInNewContext(`${functionSource(input,'cohabEnter')};this.enter=cohabEnter;`,sandbox);
    assert.throws(()=>sandbox.enter('c1'),/render failed/,label);
    assert.equal(sandbox.root.cid,'old');
    assert.equal(sandbox._off,oldOff);
    assert.equal(JSON.stringify(sandbox.stack),before);
  }
});
