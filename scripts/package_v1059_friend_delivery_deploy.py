from hashlib import sha256
from pathlib import Path
import shutil
import subprocess
import tempfile
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
DELIVERY = ROOT / "delivery-v1059-friend-real-delivery-deploy"
PACKAGE_NAME = "SmallPhone_v1059_Friend_RealDelivery_Deploy_Sanitized"
ZIP_PATH = DELIVERY / f"{PACKAGE_NAME}.zip"
SERVICE_ROOT = ROOT / "services/phone-delivery-browser"

MIGRATIONS = [
    "202608050001_phone_companion_secure_sync.sql",
    "202608060003_phone_role_scheduled_push.sql",
    "202608120002_background_role_tasks.sql",
    "202608210003_phone_delivery_connector.sql",
    "202608210004_phone_delivery_task_idempotency.sql",
]

SERVICE_FILES = [
    ".env.example",
    ".gitignore",
    "Dockerfile",
    "README.md",
    "THIRD_PARTY_NOTICES.md",
    "deno.lock",
    "docker-compose.yml",
    "entrypoint.sh",
    "package-lock.json",
    "package.json",
    "start-visible-edge-session.ps1",
    "src/adapter.mjs",
    "src/security.mjs",
    "src/server.mjs",
    "src/taobao-flash-browser.mjs",
    "test/adapter.test.mjs",
    "test/product-image-capture.test.mjs",
]


def git_output(*args: str) -> str:
    return subprocess.run(
        ["git", *args], cwd=ROOT, check=True, capture_output=True, text=True,
        encoding="utf-8",
    ).stdout.strip()


def copy(source: Path, destination: Path) -> None:
    if not source.is_file():
        raise RuntimeError(f"missing required deployment source: {source}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)


def write_text(path: Path, value: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(value.strip() + "\n", encoding="utf-8-sig")


README = r"""
小手机 v1059｜朋友专用真实外卖部署包

这是什么：
这是只用于部署“真实外卖自动操作”的干净源码包，不是整个小手机项目，也不是可以直接安装到 iPhone 的 IPA。

包内只有四部分：
1. 电脑端可见 Edge 外卖服务；
2. Supabase phone-delivery 连接函数；
3. 外卖所需的最小数据库依赖迁移；
4. v1059 前端 delivery.js 和一个只修改云端地址／公开 Key 的配置脚本。

这个包不会包含：
- 原作者或任何用户的 .env；
- Edge profile、Cookie、淘宝／饿了么登录状态；
- 地址、订单、验证码、支付资料和日志；
- Supabase Secret Key／Service Role Key；
- 整套小手机网页和私人 iOS 工程。

朋友仍然需要自己准备：
- 一台持续开机的 Windows 电脑／迷你主机，或带可视桌面的服务器；
- 自己的淘宝闪购／饿了么账号和默认收货地址；
- 自己的 Supabase 项目；
- 自己的 HTTPS 反向隧道或域名；
- 自己的一份小手机 v1059 网页副本。

手机本身不能单独完成真实网页自动化。验证码和最终付款必须由本人完成。

阅读顺序：
1. 00_先看这个.txt
2. 01_给安装人员_完整部署步骤.md
3. 02_安全清单_绝对不要上传.txt
"""

QUICKSTART = r"""
先说最重要的：这个压缩包不能双击后自动完成部署。

真实外卖需要四样东西同时存在：
1. 一台持续开机的电脑；
2. 一个已经登录本人淘宝闪购／饿了么的专用 Edge；
3. 正在运行的外卖浏览器服务；
4. 朋友自己的 Supabase 和网页副本。

如果只是使用小手机聊天、角色、朋友圈等普通功能，不需要部署这个包。

如果朋友没有电脑：
- 可以用常开的 Windows 旧电脑或迷你主机代替；
- 也可以用带桌面和远程可视界面的服务器；
- 只有手机时，当前只能手动下单，不能运行这套真实自动化。

不要多人共用同一个外卖服务。每个人都应使用自己的账号、浏览器 profile、Supabase、连接密钥和收货地址，否则可能串地址、串订单或暴露 Cookie。

不会部署时，把整个压缩包交给可信的安装人员，并让对方先阅读 01 和 02。绝对不要另外发送你的淘宝密码、验证码、Cookie、支付密码或 Supabase Secret Key。
"""

INSTALL = r"""
# 小手机 v1059 朋友真实外卖｜给安装人员的完整部署步骤

## 0. 先确认边界

- 这是当前 v1059 的单用户私人部署结构，不是多租户公共外卖平台。
- 每位朋友必须有独立 Supabase、独立浏览器 profile 和独立上游密钥。
- `automaticPayments` 固定为 `false`；验证码和支付宝付款必须本人处理。
- 不能把 8787、9222 或远程桌面端口直接暴露到公网。
- 朋友若继续使用别人已经发布的网页，而不拥有自己的网页副本，就无法把前端改指向自己的 Supabase。

## 1. 电脑端外卖服务

要求：Windows 10/11、Node.js 20 或更新的 LTS、Microsoft Edge。

进入 `service` 目录：

```powershell
Copy-Item .env.example .env
npm ci
npm test
```

打开 `.env`，至少填写：

```text
PHONE_DELIVERY_UPSTREAM_SECRET=自己生成的至少32字节随机密钥
PHONE_DELIVERY_BROWSER_HOST=127.0.0.1
PHONE_DELIVERY_BROWSER_PORT=8787
PHONE_DELIVERY_PROFILE=./profile
PHONE_DELIVERY_HEADLESS=false
PHONE_DELIVERY_CDP_URL=http://127.0.0.1:9222
PHONE_DELIVERY_MAX_ORDER_AMOUNT=100
PHONE_DELIVERY_MAX_OFFERS=4
```

`PHONE_DELIVERY_UPSTREAM_SECRET` 只允许保存在本机 `.env` 和 Supabase Secrets，不能发到聊天、网盘或 GitHub。

运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\start-visible-edge-session.ps1
npm start
```

在新打开的专用 Edge 中，由本人登录淘宝闪购／饿了么并检查默认地址。不要复制现有用户的 `profile`。

## 2. 提供 HTTPS 上游地址

Supabase 云端必须能够通过 HTTPS 访问本机的 `http://127.0.0.1:8787/delivery`。推荐由安装人员使用 Cloudflare Tunnel 或等价的出站式 HTTPS 隧道。

只把 `/delivery` 转发到 8787。绝对不要公开：

- Edge 调试端口 9222；
- noVNC／远程桌面端口；
- profile 目录；
- `.env`；
- 服务日志。

得到的地址应类似：

```text
https://delivery.example.com/delivery
```

## 3. Supabase

新建朋友自己的 Supabase 项目。将本包 `supabase` 目录放入一个 Supabase CLI 项目，然后：

```powershell
supabase login
supabase link --project-ref 朋友自己的项目Ref
supabase db push
```

本包只放入了当前外卖连接器需要的五个迁移文件，必须按文件名顺序执行。

在 Dashboard 的 Edge Function Secrets 或 CLI 中设置：

```powershell
supabase secrets set PHONE_DELIVERY_UPSTREAM_URL=https://delivery.example.com/delivery
supabase secrets set PHONE_DELIVERY_UPSTREAM_SECRET=与电脑端.env完全相同的随机密钥
supabase secrets set PHONE_DELIVERY_ALLOWED_ORIGINS=https://朋友自己的网页域名
```

部署函数：

```powershell
supabase functions deploy phone-delivery --no-verify-jwt --use-api
```

这里关闭平台 JWT 校验是因为浏览器使用 publishable key，而函数内部仍会执行独立的 target／ownerSecret 验证，上游请求还有 HMAC 签名。不要因此删除函数内部验证，也不要把 Secret Key 放进网页。

## 4. 连接朋友自己的网页

从 Supabase Dashboard 取得：

- Project URL，例如 `https://项目Ref.supabase.co`；
- Publishable Key。Publishable Key 可以出现在网页中；Secret Key／Service Role Key 绝对不可以。

朋友必须使用自己部署的小手机 v1059 网页副本。在本包根目录运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\frontend\configure-companion.ps1 `
  -WebRoot "D:\朋友的小手机网页目录" `
  -SupabaseUrl "https://朋友项目Ref.supabase.co" `
  -PublishableKey "朋友自己的PublishableKey"
```

脚本只会修改该网页副本中 `app.js` 的 `COMPANION_URL`／`COMPANION_KEY`，并把本包的 v1059 `delivery.js` 同步到网页和存在的私人 Bundle。它不会上传或部署网页。

配置后由朋友把自己的网页副本部署到自己的静态站点，再在小手机中生成自己的 target／ownerSecret。不能继续借用原作者线上网页来连接朋友自己的 Supabase。

## 5. 验收顺序

1. `npm test` 必须全绿；
2. 专用 Edge 可见并已登录本人账号；
3. 外卖服务启动，控制台显示监听 127.0.0.1:8787；
4. HTTPS 隧道只转发 `/delivery`；
5. Supabase 函数和五个迁移部署成功；
6. 小手机外卖设置点击“重新检测”成功；
7. 本人确认地址，只显示模糊地址标签；
8. 用一个简单商品走到待付款页；
9. 验证码出现时自动化暂停；
10. 核对商品、数量、规格、优惠券、地址和实付后，本人付款。

任何一步失败都不要连续重搜，也不要把 502 简单当成“网页坏了”。先看电脑服务是否运行、HTTPS 隧道是否在线、Supabase Secrets 是否一致，以及 Edge 是否仍登录。
"""

SECURITY = r"""
安全清单｜绝对不要上传或发给别人

禁止发送：
- service/.env
- service/profile 整个目录
- node_modules
- 任何 *.log
- 淘宝／饿了么 Cookie、二维码、验证码、密码
- 支付宝支付密码、付款链接和收银台截图
- 完整收货地址和历史订单
- Supabase Secret Key／Service Role Key
- PHONE_DELIVERY_UPSTREAM_SECRET
- 小手机 ownerSecret

可以写进网页的只有朋友自己的 Supabase Project URL 和 Publishable Key。Publishable Key 不是 Secret Key。

本包出厂时不包含上述私人内容。部署后产生的 `.env`、profile 和日志必须只留在朋友自己的受控电脑上。

如果安装人员要求你提供 Cookie、验证码、支付密码或 Service Role Key，请停止。正常部署不需要把这些资料发给安装人员保存。
"""

FRONTEND_GUIDE = r"""
前端连接说明

本目录不包含整套小手机网页，只包含当前 v1059 的 delivery.js 和配置脚本。

原因：朋友需要的是自己的云端连接，不需要拿到原作者完整私人 iOS 工程或无关网页源码。

configure-companion.ps1 的输入：
- WebRoot：朋友自己的小手机 v1059 网页副本目录；
- SupabaseUrl：朋友自己的 Supabase Project URL；
- PublishableKey：朋友自己的 Publishable Key。

脚本不会接受 Secret Key，也不会部署网页。完成后仍需由安装人员发布朋友自己的网页副本。
"""

FRONTEND_SCRIPT = r"""
param(
  [Parameter(Mandatory = $true)][string]$WebRoot,
  [Parameter(Mandatory = $true)][string]$SupabaseUrl,
  [Parameter(Mandatory = $true)][string]$PublishableKey
)

$ErrorActionPreference = 'Stop'
$resolvedRoot = (Resolve-Path -LiteralPath $WebRoot).Path
$SupabaseUrl = $SupabaseUrl.Trim().TrimEnd('/')
$PublishableKey = $PublishableKey.Trim()

if ($SupabaseUrl -notmatch '^https://[a-z0-9-]+\.supabase\.co$') {
  throw 'SupabaseUrl 必须是朋友自己的 https://项目Ref.supabase.co，不要填原作者项目。'
}
if ($PublishableKey -notmatch '^(sb_publishable_[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9._-]{40,})$') {
  throw 'PublishableKey 格式不正确。不要使用 sb_secret、service_role 或其他服务器私钥。'
}
if ($PublishableKey -match '^(sb_secret_|service_role)') {
  throw '禁止把 Secret Key／Service Role Key 写进网页。'
}

$targets = @(
  (Join-Path $resolvedRoot 'app.js'),
  (Join-Path $resolvedRoot 'native\private-small-phone\XcodeProject\PhoneCompanionTest\PhoneWeb.bundle\app.js')
) | Where-Object { Test-Path -LiteralPath $_ }

if (-not $targets -or -not (Test-Path -LiteralPath (Join-Path $resolvedRoot 'app.js'))) {
  throw 'WebRoot 中没有找到小手机根 app.js。'
}

$utf8 = New-Object System.Text.UTF8Encoding($false)
foreach ($target in $targets) {
  $content = [IO.File]::ReadAllText($target)
  if ($content -notmatch "const APP_VER='v1059 ") {
    throw "只支持 v1059 网页副本：$target"
  }
  if ($content -notmatch "const COMPANION_URL='[^']*';" -or $content -notmatch "const COMPANION_KEY='[^']*';") {
    throw "没有找到 COMPANION_URL／COMPANION_KEY：$target"
  }
  $content = [regex]::Replace($content, "const COMPANION_URL='[^']*';", "const COMPANION_URL='$SupabaseUrl';", 1)
  $content = [regex]::Replace($content, "const COMPANION_KEY='[^']*';", "const COMPANION_KEY='$PublishableKey';", 1)
  [IO.File]::WriteAllText($target, $content, $utf8)
}

$deliverySource = Join-Path $PSScriptRoot 'delivery.js'
$deliveryTargets = @(
  (Join-Path $resolvedRoot 'delivery.js'),
  (Join-Path $resolvedRoot 'native\private-small-phone\XcodeProject\PhoneCompanionTest\PhoneWeb.bundle\delivery.js')
)
foreach ($target in $deliveryTargets) {
  if (Test-Path -LiteralPath (Split-Path -Parent $target)) {
    Copy-Item -LiteralPath $deliverySource -Destination $target -Force
  }
}

Write-Host '已配置朋友自己的 Supabase Project URL 和 Publishable Key。'
Write-Host '没有写入任何 Secret Key；下一步由安装人员发布朋友自己的网页副本。'
"""


if DELIVERY.exists():
    resolved = DELIVERY.resolve()
    if resolved.parent != ROOT.resolve() or resolved.name != "delivery-v1059-friend-real-delivery-deploy":
        raise RuntimeError(f"unsafe delivery path: {resolved}")
    existing = list(DELIVERY.iterdir())
    if existing != [ZIP_PATH]:
        raise RuntimeError(f"delivery path contains unexpected files: {existing}")

head = git_output("rev-parse", "HEAD")

with tempfile.TemporaryDirectory(prefix="smallphone-friend-delivery-v1059-", dir=ROOT) as temp:
    staging = Path(temp) / PACKAGE_NAME
    staging.mkdir(parents=True)

    for relative in SERVICE_FILES:
        copy(SERVICE_ROOT / relative, staging / "service" / relative)

    copy(
        ROOT / "supabase/functions/phone-delivery/index.ts",
        staging / "supabase/functions/phone-delivery/index.ts",
    )
    for migration in MIGRATIONS:
        copy(
            ROOT / "supabase/migrations" / migration,
            staging / "supabase/migrations" / migration,
        )
    copy(ROOT / "delivery.js", staging / "frontend/delivery.js")

    write_text(staging / "README.txt", README)
    write_text(staging / "00_先看这个.txt", QUICKSTART)
    write_text(staging / "01_给安装人员_完整部署步骤.md", INSTALL)
    write_text(staging / "02_安全清单_绝对不要上传.txt", SECURITY)
    write_text(staging / "frontend/连接说明.txt", FRONTEND_GUIDE)
    write_text(staging / "frontend/configure-companion.ps1", FRONTEND_SCRIPT)
    write_text(
        staging / "supabase/config.toml",
        "[functions.phone-delivery]\nverify_jwt = false",
    )
    write_text(
        staging / "VERSION.txt",
        f"网页基线：v1059\n部署包日期：2026-08-25\n源码基线提交：{head}\n原生桥：不包含；本包仅部署真实外卖",
    )

    forbidden_parts = {".env", "profile", "node_modules", "__pycache__", ".git"}
    for path in staging.rglob("*"):
        if not path.is_file():
            continue
        relative = path.relative_to(staging)
        if any(part.lower() in forbidden_parts for part in relative.parts):
            raise RuntimeError(f"forbidden private path in package: {relative}")
        if path.suffix.lower() in {".log", ".zip", ".pyc"}:
            raise RuntimeError(f"forbidden generated file in package: {relative}")

    env_example = (staging / "service/.env.example").read_text(encoding="utf-8")
    if "replace-with-at-least-32-random-characters" not in env_example:
        raise RuntimeError("service env example is not sanitized")
    if "selectionRequired: true" not in (staging / "service/test/adapter.test.mjs").read_text(encoding="utf-8"):
        raise RuntimeError("service regression test is not current")

    private_markers = [
        "qvuahlqimcfgeoetosnl",
        "sb_publishable_Q2j6uyn2_cFA3RdHHnG7sw_b7vqXaz0",
        r"C:\Users\pc",
    ]
    text_suffixes = {".txt", ".md", ".js", ".mjs", ".ts", ".sql", ".json", ".ps1", ".toml", ".yml", ".yaml", ".sh", ".example", ""}
    for path in staging.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in text_suffixes:
            continue
        content = path.read_text(encoding="utf-8-sig", errors="ignore")
        for marker in private_markers:
            if marker in content:
                raise RuntimeError(f"private marker leaked into {path.relative_to(staging)}")

    manifest_rows = []
    for path in sorted(staging.rglob("*")):
        if path.is_file():
            manifest_rows.append(f"{sha256(path.read_bytes()).hexdigest()}  {path.relative_to(staging).as_posix()}")
    write_text(staging / "SHA256SUMS.txt", "\n".join(manifest_rows))

    file_count = sum(1 for path in staging.rglob("*") if path.is_file())
    DELIVERY.mkdir(exist_ok=True)
    with ZipFile(ZIP_PATH, "w", ZIP_DEFLATED, compresslevel=9) as archive:
        for path in sorted(staging.rglob("*")):
            if path.is_file():
                archive.write(path, Path(PACKAGE_NAME) / path.relative_to(staging))

if list(DELIVERY.iterdir()) != [ZIP_PATH]:
    raise RuntimeError("delivery directory must contain exactly one ZIP")

with ZipFile(ZIP_PATH) as archive:
    if archive.testzip() is not None:
        raise RuntimeError("ZIP integrity check failed")
    names = archive.namelist()
    if sum(name.endswith("/frontend/delivery.js") for name in names) != 1:
        raise RuntimeError("ZIP must contain exactly one frontend delivery.js")
    if any(name.endswith("/.env") or "/profile/" in name or "/node_modules/" in name or name.endswith(".log") for name in names):
        raise RuntimeError("ZIP contains a forbidden private artifact")

print(f"ZIP={ZIP_PATH}")
print(f"FILES={file_count}")
print(f"SHA256={sha256(ZIP_PATH.read_bytes()).hexdigest()}")
print(f"SOURCE_COMMIT={head}")
