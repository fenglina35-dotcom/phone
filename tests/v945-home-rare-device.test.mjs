import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../glass-theme.css',import.meta.url),'utf8');

function functionSource(name){
  const start=app.indexOf(`function ${name}(`);assert.ok(start>=0,`missing ${name}`);
  const brace=app.indexOf('{',start);let depth=0,quote='',escaped=false;
  for(let i=brace;i<app.length;i++){
    const ch=app[i];
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return app.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

test('only wide phones escape the legacy 348px reference cap',()=>{
  assert.match(css,/@media\(min-width:401px\) and \(max-width:649px\)\{[\s\S]*?glass-place-dashboard,[\s\S]*?home \.dock\{max-width:none!important\}/);
  assert.match(css,/@media\(min-width:401px\) and \(max-width:649px\) and \(min-height:820px\)\{/);
  assert.match(css,/glass-place-app-a,[\s\S]*?glass-place-app-b\{top:186px!important\}/);
  assert.doesNotMatch(css,/@media\(min-width:390px\)[\s\S]*?glass-place-dashboard/,'390/393px baseline must not be globally reflowed');
});

test('touchmove cancels a pending tap without taking over native scrolling',()=>{
  const ctx=vm.createContext({clearTimeout(){ctx.cleared++;},cleared:0,prevented:0});
  vm.runInContext(`const APP_TAP_MOVE=26;let _aPend={x:100,y:100},_aDrag=null,_aTimer=1,_aNoClick=0;${functionSource('appPendingMove')};${functionSource('appTouchMove')};globalThis.run=appTouchMove;globalThis.state=()=>({pending:_aPend,noClick:_aNoClick});`,ctx);
  ctx.run({touches:[{clientX:50,clientY:102}],cancelable:true,preventDefault(){ctx.prevented++;}});
  assert.equal(ctx.state().pending,null);
  assert.ok(ctx.state().noClick>0);
  assert.equal(ctx.cleared,1);
  assert.equal(ctx.prevented,0);
  assert.match(functionSource('initAppDrag'),/window\.addEventListener\('blur',appCancel\)/);
  assert.match(functionSource('initAppDrag'),/window\.addEventListener\('pagehide',appCancel\)/);
  assert.match(functionSource('initAppDrag'),/visibilitychange/);
});

test('own WeChat text and image messages can be deleted without changing recall semantics',async()=>{
  const rows=[
    {id:'mine-text',role:'user',type:'text',content:'hello'},
    {id:'mine-image',role:'user',type:'image',src:'data:image/png;base64,AA'},
    {id:'role-text',role:'assistant',type:'text',content:'reply'}
  ];
  const calls={saved:0,persisted:0,gc:0,closed:0,rendered:0,toasts:[]};
  const vision=new Map([['mine-image',Promise.resolve(true)]]);
  const ctx=vm.createContext({
    msgs(){return rows;},_visionTasks:vision,
    saveNow(){calls.saved++;},persistWechatMessagesNow(){calls.persisted++;return Promise.resolve();},
    imgGC(){calls.gc++;},closeModal(){calls.closed++;},render(){calls.rendered++;},toast(v){calls.toasts.push(v);}
  });
  vm.runInContext(`${functionSource('deleteOwnMsg')};globalThis.remove=deleteOwnMsg;`,ctx);
  ctx.remove('c','mine-text');
  assert.deepEqual(rows.map(x=>x.id),['mine-image','role-text']);
  ctx.remove('c','mine-image');
  assert.deepEqual(rows.map(x=>x.id),['role-text']);
  ctx.remove('c','role-text');
  assert.deepEqual(rows.map(x=>x.id),['role-text'],'role messages keep their separate deletion path');
  await Promise.resolve();
  assert.deepEqual(calls,{saved:2,persisted:2,gc:1,closed:2,rendered:2,toasts:['消息已删除','图片已删除']});
  assert.equal(vision.has('mine-image'),false);
  assert.match(app,/删除这张图片/);
  assert.match(app,/删除这条消息/);
  // MSG_MENU_LONGPRESS_V1 (2026-11-05): a tap on an image opens it; the menu (delete/recall) is long-press only.
  assert.match(app,/class="imgmsg" onclick="event\.stopPropagation\(\);wxImgTap\('\$\{c\.id\}','\$\{m\.id\}'\)"/);
  assert.match(app,/function recallMsg\(cid,mid\)/);
});
