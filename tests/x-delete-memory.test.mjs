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

test('deleting a tweet removes both structured and legacy X activity memories',()=>{
  for(const [label,input] of [['web',root],['private bundle',bundled]]){
    const sandbox={Date,S:{x:{_mylog:[
      {text:'在X发推：「秘密晚餐」',tweetId:'t1',kind:'tweet-post'},
      '在X发推：「秘密晚餐」',
      '在X搜索了「晚餐」'
    ]}}};
    vm.runInNewContext(`${functionSource(input,'xlogText')};${functionSource(input,'xForgetTweet')};this.forget=xForgetTweet;`,sandbox);
    sandbox.forget({id:'t1',text:'秘密晚餐'});
    assert.deepEqual(Array.from(sandbox.S.x._mylog,x=>typeof x==='string'?x:x.text),['在X搜索了「晚餐」'],label);
    assert.equal(sandbox.S.x.deletedTweetIds[0].id,'t1');
    assert.match(input,/xlog\('在X发推：[\s\S]{0,100}tweetId:tweet\.id/);
    assert.match(input,/async function xDeleteTweet\(id\)[\s\S]{0,220}xForgetTweet\(t\)/);
    assert.match(input,/a\.op==='delete_x'[\s\S]{0,260}xForgetTweet\(t\)/);
  }
});
