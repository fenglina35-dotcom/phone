# North App Review 部署清单

这份清单只服务公开 North。私人“小手机”工程、私人账号和独立伴生云都不在本次范围内。

## 一、部署审核控制台

1. 将 `supabase/migrations/202608210001_north_review_portal.sql` 执行到公开 North 1.0 构建实际连接的 Supabase 项目。
2. 发布 `north-role-controller.html`、`north-role-controller.js`、更新后的支持页、隐私页与 Service Worker。
3. 用已注册过旧 Service Worker 的浏览器打开以下三个地址，确认没有跳到小手机主页：

   - `https://fenglina35-dotcom.github.io/phone/north-support.html?role-controller=1`
   - `https://fenglina35-dotcom.github.io/phone/north-role-controller.html`（干净浏览器的直接地址）
   - `https://fenglina35-dotcom.github.io/phone/north-support.html`
   - `https://fenglina35-dotcom.github.io/phone/north-privacy.html`

## 二、创建永久审核账号和预配置角色

先在 Supabase Dashboard → Authentication → Users 中创建一个只供 Apple App Review 使用的 Email/Password 用户。关闭该账号的自动过期，不开启公开注册。密码只保存到密码管理器和 App Store Connect Review Notes，不写入 SQL、网页或 Git。

创建用户后，在 SQL Editor 执行下面的模板。只替换邮箱占位符；脚本会生成符合 North 格式的随机目标，并预配置测试角色。

```sql
do $$
declare
  v_email text := 'REPLACE_WITH_REVIEW_EMAIL';
  v_user uuid;
  v_target text;
begin
  select id into v_user from auth.users where email = v_email;
  if v_user is null then
    raise exception 'review auth user not found';
  end if;

  select target into v_target
  from public.phone_companion_review_accounts
  where user_id = v_user;

  if v_target is null then
    v_target := 'yb_' || encode(extensions.gen_random_bytes(20), 'hex');
    insert into public.phone_companion_links(target, owner_secret_hash)
    values (
      v_target,
      public.phone_companion_hash(encode(extensions.gen_random_bytes(32), 'hex'))
    );
  end if;

  insert into public.phone_companion_review_accounts(
    user_id, target, role_name, enabled, updated_at
  ) values (
    v_user, v_target, 'North Review Role', true, now()
  )
  on conflict (user_id) do update
    set role_name = excluded.role_name,
        enabled = true,
        updated_at = now();
end;
$$;
```

这个账号是永久登录入口；每次配对码仍只有 10 分钟有效。新审核设备重新生成配对码后会替换旧设备连接，不存在固定万能码。

## 三、真实设备验收

1. 在一台干净测试 iPhone 安装新的公开 North 构建，打开“本机管理”，允许屏幕使用时间并选择至少一个可安全测试的 App。
2. 在另一浏览器登录角色控制台，生成配对码；回到 North →“角色远程管理”填入控制端 ID 与配对码，连接后点一次“立即上传真实数据”。
3. 保持 North 打开，在控制台依次测试刷新、锁定、解锁和 15 分钟每日限额；每一项都必须看到设备回执和新快照，不能只看“已排队”。

## 安全检查

- 仓库中不得出现审核邮箱、审核密码、owner secret、device secret、service-role key 或固定配对码。
- 控制台只返回屏幕使用时间和所选 App 控制状态，不向审核网页返回位置或健康快照。
- 审核 RPC 只授权给 `authenticated`，且只能访问与当前 `auth.uid()` 绑定的预配置目标。
- 不添加审核设备识别、隐藏手势、地区开关、TestFlight 判断或仅审核时出现的功能。
- 公开 North 与私人“小手机”不能同时控制同一台本人设备。
