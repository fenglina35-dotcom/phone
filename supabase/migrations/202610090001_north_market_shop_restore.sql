begin;

-- Owner-authenticated recycle bin. Catalog, stock, lots and ledgers remain in place.
create or replace function public.north_market_shop_deleted_list(
 p_phone_id text,p_secret text,p_after timestamptz default null,p_after_id uuid default null
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor text;result jsonb;
begin
 actor:=public.north_market_identity(p_phone_id,p_secret);
 if (p_after is null)<>(p_after_id is null) then raise exception 'market-invalid-shop-cursor';end if;
 with rows as (select s.* from public.north_market_shops s where s.owner_id=actor and s.deleted_at is not null
  and (p_after is null or (s.deleted_at,s.id)<(p_after,p_after_id)) order by s.deleted_at desc,s.id desc limit 51),
 shown as (select * from rows order by deleted_at desc,id desc limit 50)
 select jsonb_build_object('ok',true,'shops',coalesce((select jsonb_agg(to_jsonb(x)-'owner_id' order by x.deleted_at desc,x.id desc) from shown x),'[]'::jsonb),
 'more',(select count(*)>50 from rows),'cursor',(select jsonb_build_object('at',deleted_at,'id',id) from shown order by deleted_at desc,id desc offset 49 limit 1)) into result;
 return result;
end $$;

create or replace function public.north_market_shop_restore(p_phone_id text,p_secret text,p_id uuid,p_expected integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text;shop public.north_market_shops;count integer;
begin
 actor:=public.north_market_identity(p_phone_id,p_secret);
 perform pg_advisory_xact_lock(hashtextextended('north-market-owner:'||actor,0));
 select * into shop from public.north_market_shops where owner_id=actor and id=p_id for update;
 if shop.id is null then raise exception 'market-shop-unavailable';end if;
 -- An uncertain response can be retried without creating another shop or charging.
 if shop.deleted_at is null then return jsonb_build_object('ok',true,'restored',true,'duplicate',true,'id',shop.id,'revision',shop.revision,'shop',to_jsonb(shop)-'owner_id');end if;
 if p_expected is null or shop.revision<>p_expected then raise exception 'market-revision-changed';end if;
 select count(*) into count from public.north_market_shops where owner_id=actor and deleted_at is null;
 if count>=3 then raise exception 'market-shop-limit';end if;
 update public.north_market_shops set deleted_at=null,published=false,revision=revision+1,updated_at=now() where id=shop.id returning * into shop;
 return jsonb_build_object('ok',true,'restored',true,'id',shop.id,'revision',shop.revision,'shop',to_jsonb(shop)-'owner_id');
end $$;
revoke all on function public.north_market_shop_deleted_list(text,text,timestamptz,uuid) from public;
revoke all on function public.north_market_shop_restore(text,text,uuid,integer) from public;
grant execute on function public.north_market_shop_deleted_list(text,text,timestamptz,uuid) to anon,authenticated;
grant execute on function public.north_market_shop_restore(text,text,uuid,integer) to anon,authenticated;
notify pgrst,'reload schema';
commit;
