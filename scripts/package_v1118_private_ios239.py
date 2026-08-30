"""Build and verify the v1118 / private iOS 1.0.239 unified Mac source package."""

from hashlib import sha256
from pathlib import Path
from zipfile import ZipFile


template = Path(__file__).with_name("package_v1117_private_ios238.py").read_text(encoding="utf-8")
for old, new in [
    ("v1117", "v1118"),
    ("1117", "1118"),
    ("1.0.238", "1.0.239"),
    ("(238)", "(239)"),
    ("ios238", "ios239"),
    ("iOS238", "iOS239"),
    ("private238", "private239"),
    ("OutputStorageStability", "InteractionRoleLock"),
    ("第二百三十八次安装_v1117_输出与存储稳定_请先读.md", "第二百三十九次安装_v1118_交互与角色锁定稳定_请先读.md"),
    ("第二百三十八次安装", "第二百三十九次安装"),
    ("v1118 · 输出与存储稳定版", "v1118 · 交互与角色锁定稳定版"),
    ("CURRENT_PROJECT_VERSION = 238;", "CURRENT_PROJECT_VERSION = 239;"),
]:
    template = template.replace(old, new)
template = template.replace(
    "第二百三十九次安装_v1118_输出与存储稳定_请先读.md",
    "第二百三十九次安装_v1118_交互与角色锁定稳定_请先读.md",
)
exec(compile(template, __file__, "exec"))


root = Path(__file__).resolve().parents[1]
package = root / "delivery-v1118-private239-full-final" / "SmallPhone_v1118_InteractionRoleLock_iOS239_Full_MacReady.zip"
with ZipFile(package) as archive:
    names = archive.namelist()
    guide = next(name for name in names if name.endswith("第二百三十九次安装_v1118_交互与角色锁定稳定_请先读.md"))
    prefix = guide.split("第二百三十九次安装", 1)[0]
    app = archive.read(prefix + "PhoneCompanionTest/PhoneWeb.bundle/app.js").decode("utf-8")
    wedding = archive.read(prefix + "PhoneCompanionTest/PhoneWeb.bundle/wedding-game.js").decode("utf-8")
    shield = archive.read(prefix + "PhoneCompanionShield/ShieldConfigurationExtension.swift").decode("utf-8")
    sync = archive.read(prefix + "PhoneCompanionTest/CompanionSyncView.swift").decode("utf-8")
    delivery = archive.read(prefix + "PhoneCompanionTest/PhoneWeb.bundle/delivery.js").decode("utf-8")
    for token in [
        "const APP_VER='v1118 · 交互与角色锁定稳定版'",
        "function ensureRequestedPhotoCaptionMoment",
        "function regenerateRoleMoment",
        "function regenerateRoleTweet",
        "appTouchGuardAttach",
    ]:
        if token not in app:
            raise RuntimeError(f"v1118 protected web feature missing: {token}")
    if "function weddingMarriageDateSave" not in wedding or "marriageDateManual" not in wedding:
        raise RuntimeError("user-authoritative marriage date is missing from package")
    if '"\\(appName)已被\\(actor)锁定"' not in shield or "subtitle: nil" not in shield:
        raise RuntimeError("actual-role lock title is missing from packaged shield")
    if "绑定角色" in shield or "某某" in shield or "绑定角色" in sync or "某某" in sync:
        raise RuntimeError("placeholder role name leaked into packaged lock flow")
    if "sharedDefaults?.synchronize()" not in sync:
        raise RuntimeError("shield actor persistence flush is missing from package")
    for token in ["lastAttemptAt", "stale", "云端数据库暂时不可用，请稍后重试"]:
        if token not in delivery:
            raise RuntimeError(f"delivery outage guard missing: {token}")

print(f"FINAL_VERIFIED_ZIP={package}")
print(f"FINAL_SIZE={package.stat().st_size}")
print(f"FINAL_SHA256={sha256(package.read_bytes()).hexdigest()}")
