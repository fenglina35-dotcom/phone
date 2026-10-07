import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Executed against PostgreSQL inside a transaction ending with ROLLBACK.
export const transactionSQL=String.raw`
do $test$
declare seller text:='SP'||upper(substr(md5(gen_random_uuid()::text),1,8));
 host text:='SP'||upper(substr(md5(gen_random_uuid()::text),1,8));guest text:='SP'||upper(substr(md5(gen_random_uuid()::text),1,8));
 s uuid:=gen_random_uuid();h uuid:=gen_random_uuid();g uuid:=gen_random_uuid();shop uuid;split uuid;oid uuid;request uuid:=gen_random_uuid();result jsonb;product jsonb;catalog jsonb;lines jsonb;address jsonb;failed boolean;balance bigint;scheduled timestamptz:=now()+interval '1 day';
begin
 insert into public.phone_friend_profiles(phone_id,secret_hash,display_name,allow_search) values(seller,public.phone_friend_hash('social-test-secret'),'事务店主',false),(host,public.phone_friend_hash('social-test-secret'),'事务发起人',false),(guest,public.phone_friend_hash('social-test-secret'),'事务好友',false);
 insert into public.phone_licenses(id,status,phone_friend_id) values(s,'active',seller),(h,'active',host),(g,'active',guest);
 product:=jsonb_build_object('id','tea','name','事务奶茶','groupId','drinks','price',2000,'unit','杯','description','','image','','signature',true,'available',true,'specGroups','[]'::jsonb);
 catalog:=jsonb_build_object('name','事务拼单茶铺','category','奶茶','intro','','cover','','minimum',2000,'delivery',191,'published',true,'groups',jsonb_build_array(jsonb_build_object('id','drinks','name','饮品')),'products',jsonb_build_array(product));
 shop:=(public.north_market_save_shop(seller,'social-test-secret',0,catalog)->>'id')::uuid;
 perform public.north_market_claim(seller,'social-test-secret');perform public.north_market_stock_change(seller,'social-test-secret',shop,'tea',50,'wallet',gen_random_uuid(),'00000',40000,false);
 perform public.north_market_claim(host,'social-test-secret');perform public.north_market_claim(guest,'social-test-secret');
 lines:=jsonb_build_array(jsonb_build_object('productId','tea','quantity',1,'selections','{}'::jsonb));address:=jsonb_build_object('name','验收','address','虚拟位置','phone','');
 failed:=false;begin perform public.north_market_split_create(host,'social-test-secret',request,guest,shop,1,lines,address,false,'',2191);exception when others then failed:=true;end;
 if not failed then raise exception 'FAIL non-friend invitation';end if;
 insert into public.phone_friend_requests(from_id,to_id,status) values(host,guest,'accepted');
 split:=(public.north_market_split_create(host,'social-test-secret',request,guest,shop,1,lines,address,false,'',2191)->>'id')::uuid;
 if (public.north_market_split_create(host,'social-test-secret',request,guest,shop,1,lines,address,false,'',2191)->>'id')::uuid<>split then raise exception 'FAIL duplicate invitation';end if;
 result:=public.north_market_split_get(host,'social-test-secret',null,request);
 if jsonb_array_length(result->'splits')<>1 or result->'splits'->0->>'client_id'<>request::text then raise exception 'FAIL client recovery lookup';end if;
 failed:=false;begin perform public.north_market_order_create(host,'social-test-secret',request,shop,1,lines,address,false,'','',null,'00000',2191,null);exception when others then failed:=true;end;
 if not failed then raise exception 'FAIL ordinary checkout bypasses split nonce';end if;
 failed:=false;begin perform public.north_market_split_pay(seller,'social-test-secret',split,'00000');exception when others then failed:=true;end;if not failed then raise exception 'FAIL outsider pays';end if;
 result:=public.north_market_split_pay(host,'social-test-secret',split,'11111');if result->>'ok'<>'false' then raise exception 'FAIL bad PIN';end if;
 perform public.north_market_split_pay(guest,'social-test-secret',split,'00000');perform public.north_market_split_pay(guest,'social-test-secret',split,'00000');
 if (public.north_market_wallet(guest,'social-test-secret')->>'balance')::bigint<>48904 then raise exception 'FAIL guest half or replay';end if;
 if exists(select 1 from public.north_market_orders where client_id=request) then raise exception 'FAIL order before both paid';end if;
 result:=public.north_market_split_pay(host,'social-test-secret',split,'00000');oid:=(result->>'orderId')::uuid;perform public.north_market_split_pay(host,'social-test-secret',split,'00000');
 if oid is null or (public.north_market_wallet(host,'social-test-secret')->>'balance')::bigint<>48905 then raise exception 'FAIL host half or replay';end if;
 if (public.north_market_order(guest,'social-test-secret',oid)->>'isBuyer')::boolean then raise exception 'FAIL guest owns order';end if;
 perform public.north_market_order_status(host,'social-test-secret',oid,'cancelled');perform public.north_market_order_status(host,'social-test-secret',oid,'cancelled');
 if (public.north_market_wallet(host,'social-test-secret')->>'balance')::bigint<>50000 or (public.north_market_wallet(guest,'social-test-secret')->>'balance')::bigint<>50000 then raise exception 'FAIL paid split refunds to each source';end if;
 split:=(public.north_market_split_create(host,'social-test-secret',gen_random_uuid(),guest,shop,1,lines,address,false,'',2191)->>'id')::uuid;
 perform public.north_market_split_pay(host,'social-test-secret',split,'00000');update public.north_market_splits set expires_at=now()-interval '1 second' where id=split;
 perform public.north_market_split_get(guest,'social-test-secret',split);perform public.north_market_split_get(host,'social-test-secret',split);
 if (public.north_market_wallet(host,'social-test-secret')->>'balance')::bigint<>50000 then raise exception 'FAIL expired refund';end if;
 address:=address||jsonb_build_object('scheduledAt',scheduled);
 result:=public.north_market_order_create(host,'social-test-secret',gen_random_uuid(),shop,1,lines,address,false,'','',null,'00000',2191,null);oid:=(result->'order'->>'id')::uuid;
 if (result->'order'->>'scheduled_at')::timestamptz<>scheduled then raise exception 'FAIL reservation snapshot';end if;
 perform public.north_market_order_status(seller,'social-test-secret',oid,'accepted');failed:=false;begin perform public.north_market_order_status(seller,'social-test-secret',oid,'ready');exception when others then failed:=true;end;if not failed then raise exception 'FAIL reservation sent early';end if;
 update public.north_market_orders set scheduled_at=now()-interval '1 second' where id=oid;
 perform public.north_market_order_status(seller,'social-test-secret',oid,'ready');perform public.north_market_order_status(seller,'social-test-secret',oid,'delivered');perform public.north_market_order_status(host,'social-test-secret',oid,'completed');
 perform public.north_market_review_save(host,'social-test-secret',oid,0,jsonb_build_object('rating',4,'text','评价','images','[]'::jsonb,'anonymous',true));
 failed:=false;begin perform public.north_market_reply(guest,'social-test-secret',oid,'冒充店主');exception when others then failed:=true;end;if not failed then raise exception 'FAIL wrong seller reply';end if;
 perform public.north_market_reply(seller,'social-test-secret',oid,'谢谢评价');perform public.north_market_reply(seller,'social-test-secret',oid,'谢谢评价');
 failed:=false;begin perform public.north_market_reply(seller,'social-test-secret',oid,'再次回复');exception when others then failed:=true;end;if not failed then raise exception 'FAIL second reply';end if;
 perform public.north_market_review_save(host,'social-test-secret',oid,1,jsonb_build_object('rating',5,'text','修改评价','images','[]'::jsonb,'anonymous',true));
 if public.north_market_reviews(shop,null)->'reviews'->0->>'seller_reply'<>'谢谢评价' then raise exception 'FAIL reply missing from public feed';end if;
 if (public.north_market_review_inbox(host,'social-test-secret',false,null)->>'unread')::integer<>1 then raise exception 'FAIL unread reply';end if;
 perform public.north_market_reply_read(guest,'social-test-secret',jsonb_build_array(oid));if (public.north_market_review_inbox(host,'social-test-secret',false,null)->>'unread')::integer<>1 then raise exception 'FAIL outsider clears unread';end if;
 perform public.north_market_reply_read(host,'social-test-secret',jsonb_build_array(oid));if (public.north_market_review_inbox(host,'social-test-secret',false,null)->>'unread')::integer<>0 then raise exception 'FAIL read acknowledgement';end if;
 raise notice 'PASS split shares/PIN/identity/replay/pending/refund/expiry, reservation, one seller reply and read acknowledgement';
end $test$;
`;

for(const priv of [false,true]){
 const src=fs.readFileSync(new URL(priv?'../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/commerce-ui.js':'../commerce-ui.js',import.meta.url),'utf8');
 test((priv?'private':'web')+' reserved simulated order cannot arrive before the selected time',()=>{
  const fn=src.match(/  function northStatus\(o\)\{[^\n]+/)[0],ctx={Date};vm.createContext(ctx);vm.runInContext(fn+';this.status=northStatus;',ctx);
  assert.equal(ctx.status({createdAt:Date.now()-120000,scheduledAt:Date.now()+3600000,status:'paid'}),'paid');
  assert.equal(ctx.status({createdAt:Date.now()-120000,scheduledAt:Date.now()-1000,status:'paid'}),'delivered');
  assert.equal(ctx.status({createdAt:Date.now()-120000,scheduledAt:Date.now()+3600000,status:'cancelled'}),'cancelled');
 });
 test((priv?'private':'web')+' stale local coupon PIN cannot debit a local wallet or mint new vouchers',async()=>{
  let closed=0;const ctx={northCouponPurchase:{authorized:true},northPinEntry:{},closeModal:()=>closed++,toast(){},S:{me:{balance:200},food:{north:{vouchers:[]}}}};vm.createContext(ctx);vm.runInContext(src.match(/  async function northFinalizeCouponPurchase\(\)\{[^\n]+/)[0]+';this.finalize=northFinalizeCouponPurchase;',ctx);
  assert.equal(await ctx.finalize(),false);assert.equal(ctx.S.me.balance,200);assert.equal(ctx.S.food.north.vouchers.length,0);assert.equal(ctx.northCouponPurchase,null);assert.equal(closed,1);
 });
}
