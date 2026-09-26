import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const paths=['app.js','native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js'];
function fn(src,name){const lines=src.split('\n'),i=lines.findIndex(x=>x.startsWith('function '+name+'('));assert.ok(i>=0,name);let j=i+1;while(j<lines.length&&!/^(?:async function |function |let |const |\/\*)/.test(lines[j]))j++;return lines.slice(i,j).join('\n');}
for(const path of paths){const src=fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
test(path+': live bubble color updates translucent paint without rerender',()=>{
 const theme={me:'#000000',them:'#000000'},props={},c={id:'a'};
 const box=vm.createContext({OFF_THEME_DEF:{me:'#000000',them:'#000000'},getC:()=>c,offTheme:()=>theme,offColorOk:v=>v,save(){},document:{querySelector:()=>({style:{setProperty:(k,v)=>props[k]=v}})}});
 vm.runInContext(fn(src,'offRgba')+'\n'+fn(src,'offThemeSet'),box);
 vm.runInContext("offThemeSet('a','me','#ff0000');offThemeSet('a','them','#00ff00')",box);
 assert.equal(props['--offc-me-soft'],'rgba(255,0,0,0.62)');assert.equal(props['--offc-them-soft'],'rgba(0,255,0,0.52)');
});
test(path+': role call preference stays isolated including zero',()=>{
 const box=vm.createContext({S:{settings:{callProb:88}}});vm.runInContext(fn(src,'effCallProb'),box);
 assert.equal(vm.runInContext('effCallProb({callProb:0})',box),0);
 assert.equal(vm.runInContext('effCallProb({callProb:72})',box),72);
 assert.equal(vm.runInContext('effCallProb({})',box),35);
});
test(path+': couple tasks require explicit opt in and stay within bound couple',()=>{
 const c={id:'a'},other={id:'b'},S={couple:{cid:'a'},contacts:[c,other]};
 const box=vm.createContext({S,getC:id=>S.contacts.find(x=>x.id===id),save(){},render(){}});
 for(const n of ['taskRelationAllowed','coupleTasksEnabled','coupleTasksToggle','taskC'])vm.runInContext(fn(src,n),box);
 assert.equal(box.taskC(),null);box.coupleTasksToggle();assert.equal(box.taskC(),c);assert.equal(box.coupleTasksEnabled(other),false);
 box.coupleTasksToggle();assert.equal(box.taskC(),null);
});
test(path+': received real friend transfer has one independent receipt without mutating history',()=>{
 const original={id:'m1',from:'ME',to:'FRIEND',time:100,receivedAt:200,received:true,text:'transfer'},S={messages:{FRIEND:[original]}};
 const box=vm.createContext({phoneFriendState:()=>S,pfVisibleMsgList:(store,id)=>store[id],pfMsgPayload:m=>m?{type:'transfer',amount:10}:null});
 for(const n of ['pfTransferReceiptMessage','phoneFriendChatMessages'])vm.runInContext(fn(src,n),box);
 const a=box.phoneFriendChatMessages('friend');assert.equal(a.length,2);assert.equal(a[1].from,'FRIEND');assert.equal(a[1]._transferReceipt,true);assert.equal(a[1].time,200);
 assert.equal(box.phoneFriendChatMessages('friend').length,2);assert.equal(S.messages.FRIEND.length,1);
 original.received=false;assert.equal(box.phoneFriendChatMessages('friend').length,1);
});
test(path+': four reply budgets default to 4096 and preserve explicit values',()=>{
 const box=vm.createContext({});vm.runInContext(fn(src,'chatMainCopy'),box);
 const v=vm.runInContext('chatMainCopy({})',box);for(const k of ['maxTokens','offlineMaxTokens','letterMaxTokens','callMaxTokens'])assert.equal(v[k],4096,k);
 const old=vm.runInContext('chatMainCopy({maxTokens:800,offlineMaxTokens:900,letterMaxTokens:1200,callMaxTokens:0,temp:0})',box);
 assert.equal(old.maxTokens,800);assert.equal(old.callMaxTokens,0);assert.equal(old.temp,0);
});
}
