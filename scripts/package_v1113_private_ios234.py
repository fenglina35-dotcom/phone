"""Build and verify the v1113 / private iOS 1.0.234 unified Mac source package."""

from hashlib import sha256
from pathlib import Path
from zipfile import ZipFile


template = Path(__file__).with_name("package_v1071_private_ios195.py").read_text(encoding="utf-8")
for old, new in [
    ("v1071", "v1113"),
    ("1071", "1113"),
    ("1.0.195", "1.0.234"),
    ("(195)", "(234)"),
    ("ios195", "ios234"),
    ("iOS195", "iOS234"),
    ("private195", "private234"),
    ("CompleteWeChatBundle", "RoleAppLockCohabEntry"),
    ("第一百九十五次安装_v1113_私人App_完整微信Bundle_请先读.md", "第二百三十四次安装_v1113_角色软件锁定与共同生活入口_请先读.md"),
    ("v1113 · 私人App完整微信Bundle修复版", "v1113 · 角色软件锁定与共同生活入口版"),
    ("CURRENT_PROJECT_VERSION = 195;", "CURRENT_PROJECT_VERSION = 234;"),
]:
    template = template.replace(old, new)
template = template.replace("if existing != [ZIP_PATH]:", "if existing and existing != [ZIP_PATH]:")
template = template.replace(
    '        "remoteControlRoleReaction",',
    '        "remoteControlRoleReaction",\n'
    '        "function roleAppWatchRoleLockToggle",\n'
    '        "function cohabPersistAfterEnter",\n'
    '        "每天最多查看软件次数（最高 5 次）",',
)
exec(compile(template, __file__, "exec"))


root = Path(__file__).resolve().parents[1]
source = root / "native/private-small-phone/XcodeProject"
bundle_source = source / "PhoneCompanionTest/PhoneWeb.bundle"
package = root / "delivery-v1113-private234-final" / "SmallPhone_v1113_RoleAppLockCohabEntry_iOS234_MacReady.zip"


def file_map(path: Path) -> dict[str, bytes]:
    return {
        item.relative_to(path).as_posix(): item.read_bytes()
        for item in path.rglob("*")
        if item.is_file() and item.suffix.lower() not in {".zip", ".pyc"} and "__pycache__" not in item.parts
    }


with ZipFile(package) as archive:
    names = archive.namelist()
    if archive.testzip() is not None:
        raise RuntimeError("ZIP integrity test failed")
    if any(name.lower().endswith(".zip") or "/__pycache__/" in name or name.lower().endswith(".pyc") for name in names):
        raise RuntimeError("nested ZIP or cache file found")
    guide = next((name for name in names if name.endswith("第二百三十四次安装_v1113_角色软件锁定与共同生活入口_请先读.md")), "")
    if not guide:
        raise RuntimeError("missing v1113 install readme")
    prefix = guide.split("第二百三十四次安装", 1)[0]
    bundle_prefix = prefix + "PhoneCompanionTest/PhoneWeb.bundle/"
    source_bundle = file_map(bundle_source)
    archived_bundle = {name[len(bundle_prefix):]: archive.read(name) for name in names if name.startswith(bundle_prefix) and not name.endswith("/")}
    if source_bundle != archived_bundle:
        raise RuntimeError("ZIP PhoneWeb.bundle differs from source bundle")
    app = archived_bundle["app.js"].decode("utf-8")
    project = archive.read(prefix + "PhoneCompanionTest.xcodeproj/project.pbxproj").decode("utf-8")
    webview = archive.read(prefix + "PhoneCompanionTest/LocalPhoneWebView.swift").decode("utf-8")
    shield = archive.read(prefix + "PhoneCompanionShield/ShieldConfigurationExtension.swift").decode("utf-8")
    sync = archive.read(prefix + "PhoneCompanionTest/CompanionSyncView.swift").decode("utf-8")
    for token in [
        "const APP_VER='v1113 · 角色软件锁定与共同生活入口版'",
        "function roleAppWatchRoleLockToggle",
        "function cohabPersistAfterEnter",
        "每天最多查看软件次数（最高 5 次）",
    ]:
        if token not in app:
            raise RuntimeError(f"bundled protected feature missing: {token}")
    if "window.__SMALL_PHONE_PRIVATE_BUILD__ = '1.0.234 (234)'" not in webview:
        raise RuntimeError("private build marker mismatch")
    if project.count("CURRENT_PROJECT_VERSION = 234;") != 12 or project.count("MARKETING_VERSION = 1.0.234;") != 12:
        raise RuntimeError("iOS version mismatch")
    if "这是角色主动锁定，不是今日使用限额" not in shield or "这是今天的使用时间达到限额，不是角色主动锁定" not in shield:
        raise RuntimeError("shield lock-source distinction missing")
    if 'command.by == "role-app-watch"' not in sync or "guard effectiveLockedTokens().contains(token)" not in sync:
        raise RuntimeError("real role-lock acknowledgement guard missing")
    for required in ["app.js", "delivery.js", "index.html", "小手机.html", "vendor/qr/jsQR.js", "vendor/qr/qrcode.js", "wechat-me.css", "wechat-me.js"]:
        if required not in archived_bundle:
            raise RuntimeError(f"required bundle file missing: {required}")

digest = sha256(package.read_bytes()).hexdigest()
print(f"VERIFIED_ZIP={package}")
print(f"FILES={len(names)}")
print(f"BUNDLE_FILES={len(source_bundle)}")
print(f"SIZE={package.stat().st_size}")
print(f"SHA256={digest}")
