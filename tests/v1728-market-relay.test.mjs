import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const RELAY='https://license.smallphoneapp.com',GATE='https://lkhlyfpssmrjkkzhuzag.supabase.co';
for (const [kind,path] of [['web','commerce-ui.js'],['private','native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/commerce-ui.js']]) {
  function setup(fetcher,route=RELAY){
    const source=fs.readFileSync(path,'utf8'),start=source.indexOf('  async function northMarketRpc('),end=source.indexOf('  function northMarketImage(',start);
    const identity={id:'SPTEST0001',secret:'fixture-secret'},calls=[];
    const context={S:{},northData:()=>({}),actId:()=>'main',phoneFriendState:()=>identity,GATE_URL:GATE,PF_RELAY_BASE:RELAY,_pfTransportRoute:route,
      pfTransportRoute:async()=>route,pfHeaders:()=>({'Content-Type':'application/json'}),Error,Date,
      fetchT:async(url,opt)=>{calls.push({url,opt});return fetcher(url,opt);}};
    vm.runInNewContext(source.slice(start,end)+';globalThis.call=northMarketRpc;globalThis.media=northMarketMediaUrl;globalThis.upload=northMarketUploadUrl;',context);
    return {context,calls};
  }
  const ok=body=>({ok:true,status:200,json:async()=>body});
  test(`${kind} shop requests use the relay only after it confirms market support`,async()=>{
    const {context,calls}=setup(async url=>url.endsWith('/market-ready')?ok({ok:true,code:'market-relay-v1'}):ok({ok:true,shops:[]}));
    await context.call('list',{});assert.equal(calls.at(-1).url,RELAY+'/rest/v1/rpc/north_market_list');
    assert.equal(await context.upload('abc/x.jpg'),RELAY+'/market-upload/abc/x.jpg');
    const url=GATE+'/storage/v1/object/public/north-market/'+'a'.repeat(32)+'/x.jpg';assert.equal(context.media(url,RELAY),RELAY+'/market-media/'+'a'.repeat(32)+'/x.jpg');
  });
  test(`${kind} an old relay without market support keeps shops on the direct line`,async()=>{
    const {context,calls}=setup(async url=>url.endsWith('/market-ready')?{ok:false,status:404,json:async()=>({ok:false,code:'not-found'})}:ok({ok:true,shops:[]}));
    await context.call('list',{});assert.equal(calls.at(-1).url,GATE+'/rest/v1/rpc/north_market_list');
    assert.equal(await context.upload('abc/x.jpg'),GATE+'/storage/v1/object/north-market/abc/x.jpg');
  });
  test(`${kind} reads switch line once on network failure; writes are never resent`,async()=>{
    let n=0;const {context,calls}=setup(async url=>{if(url.endsWith('/market-ready'))return ok({ok:true,code:'market-relay-v1'});n++;if(url.startsWith(RELAY+'/rest'))throw Error('reset');return ok({ok:true,shops:[]});});
    await context.call('list',{});assert.deepEqual(calls.filter(c=>c.url.includes('/rpc/')).map(c=>c.url.startsWith(RELAY)?'relay':'direct'),['relay','direct']);
    calls.length=0;await assert.rejects(context.call('role_checkout',{p_total:1},true),/连接失败/);assert.equal(calls.filter(c=>c.url.includes('/rpc/')).length,1);
  });
  test(`${kind} images shown through the relay are saved back as original addresses`,async()=>{
    const {context,calls}=setup(async url=>url.endsWith('/market-ready')?ok({ok:true,code:'market-relay-v1'}):ok({ok:true,id:'x'}));
    const shown=RELAY+'/market-media/'+'b'.repeat(32)+'/y.jpg';await context.call('save_shop',{p_shop:{cover:shown,products:[{image:shown}]}},true);
    const body=JSON.parse(calls.at(-1).opt.body),orig=GATE+'/storage/v1/object/public/north-market/'+'b'.repeat(32)+'/y.jpg';
    assert.equal(body.p_shop.cover,orig);assert.equal(body.p_shop.products[0].image,orig);
  });
}
