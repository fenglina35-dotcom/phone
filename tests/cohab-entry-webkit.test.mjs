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
  assert.deepEqual(failed.messages,['共同生活入口异常，请返回线下约会后重试']);
});
