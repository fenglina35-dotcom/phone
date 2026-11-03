-- MARKET_PIN_RESET_V1（2026-11-03 用户要求）：真人店铺云端支付密码忘了没法找回。
-- 新增「忘记密码」：不用旧密码，直接设一个新的五位密码。身份仍按本机 phone_id + 密钥核对，
-- 只能改自己的钱包；改完清零失败次数和等待时间。原 north_market_pin（要旧密码）不变。
-- 这个钱包里的钱只来自小手机里的发放，不是真实支付账户。
create or replace function public.north_market_pin_reset(p_phone_id text,p_secret text,p_new text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text;
begin actor:=public.north_market_identity(p_phone_id,p_secret);
 if not coalesce(p_new ~ '^[0-9]{5}$',false) then raise exception 'market-invalid-pin';end if;
 perform pg_advisory_xact_lock(hashtextextended('north-market-wallet:'||actor,0));
 insert into public.north_market_wallets(owner_id) values(actor) on conflict(owner_id) do nothing;
 update public.north_market_wallets set pin_hash=extensions.crypt(p_new,extensions.gen_salt('bf')),pin_failures=0,pin_blocked_until=null where owner_id=actor;
 return jsonb_build_object('ok',true);end $$;
revoke all on function public.north_market_pin_reset(text,text,text) from public;
grant execute on function public.north_market_pin_reset(text,text,text) to anon,authenticated;
