"""Build and verify the v1115 / private iOS 1.0.236 unified Mac source package."""

from hashlib import sha256
from pathlib import Path
from zipfile import ZipFile


template = Path(__file__).with_name("package_v1071_private_ios195.py").read_text(encoding="utf-8")
for old, new in [
    ("v1071", "v1115"),
    ("1071", "1115"),
    ("1.0.195", "1.0.236"),
    ("(195)", "(236)"),
    ("ios195", "ios236"),
    ("iOS195", "iOS236"),
    ("private195", "private236"),
    ("CompleteWeChatBundle", "RoleVoiceRoute"),
    ("第一百九十五次安装_v1115_私人App_完整微信Bundle_请先读.md", "第二百三十六次安装_v1115_角色独立语音路线_请先读.md"),
    ("v1115 · 私人App完整微信Bundle修复版", "v1115 · 角色独立语音路线版"),
    ("CURRENT_PROJECT_VERSION = 195;", "CURRENT_PROJECT_VERSION = 236;"),
]:
    template = template.replace(old, new)
template = template.replace("if existing != [ZIP_PATH]:", "if existing and existing != [ZIP_PATH]:")
template = template.replace(
    'DELIVERY = ROOT / "delivery-v1115-private236-final"',
    'DELIVERY = ROOT / "delivery-v1115-private236-full-final"',
)
template = template.replace(
    'PACKAGE_NAME = "SmallPhone_v1115_RoleVoiceRoute_iOS236_MacReady"',
    'PACKAGE_NAME = "SmallPhone_v1115_RoleVoiceRoute_iOS236_Full_MacReady"',
)
template = template.replace(
    '        "remoteControlRoleReaction",',
    '        "remoteControlRoleReaction",\n'
    '        "function roleVisibleUserMomentsPrompt",\n'
    '        "function roleChatRouteIndex",\n'
    '        "routeIndex:roleChatRouteIndex(c)",',
)
exec(compile(template, __file__, "exec"))


root = Path(__file__).resolve().parents[1]
source = root / "native/private-small-phone/XcodeProject"
bundle_source = source / "PhoneCompanionTest/PhoneWeb.bundle"
package = root / "delivery-v1115-private236-full-final" / "SmallPhone_v1115_RoleVoiceRoute_iOS236_Full_MacReady.zip"


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
    guide = next((name for name in names if name.endswith("第二百三十六次安装_v1115_角色独立语音路线_请先读.md")), "")
    if not guide:
        raise RuntimeError("missing v1115 install readme")
    prefix = guide.split("第二百三十六次安装", 1)[0]
    bundle_prefix = prefix + "PhoneCompanionTest/PhoneWeb.bundle/"
    source_bundle = file_map(bundle_source)
    archived_bundle = {name[len(bundle_prefix):]: archive.read(name) for name in names if name.startswith(bundle_prefix) and not name.endswith("/")}
    if source_bundle != archived_bundle:
        raise RuntimeError("ZIP PhoneWeb.bundle differs from source bundle")
    app = archived_bundle["app.js"].decode("utf-8")
    project = archive.read(prefix + "PhoneCompanionTest.xcodeproj/project.pbxproj").decode("utf-8")
    webview = archive.read(prefix + "PhoneCompanionTest/LocalPhoneWebView.swift").decode("utf-8")
    companion_sync = archive.read(prefix + "PhoneCompanionTest/CompanionSyncView.swift").decode("utf-8")
    for token in [
        "const APP_VER='v1115 · 角色独立语音路线版'",
        "function roleVisibleUserMomentsPrompt",
        "function roleChatRouteIndex",
        "routeIndex:roleChatRouteIndex(c)",
        "function ttsRoleRouteIndex",
        "function ttsRoleVoiceId",
        "语音音色与路线",
        "ttsRouteVoices",
        "page.p==='wxmoment'",
    ]:
        if token not in app:
            raise RuntimeError(f"bundled protected feature missing: {token}")
    if "window.__SMALL_PHONE_PRIVATE_BUILD__ = '1.0.236 (236)'" not in webview:
        raise RuntimeError("private build marker mismatch")
    if "actor: actor,\n            by: nil" not in companion_sync:
        raise RuntimeError("RemoteCommand initializer compile fix missing")
    if project.count("CURRENT_PROJECT_VERSION = 236;") != 12 or project.count("MARKETING_VERSION = 1.0.236;") != 12:
        raise RuntimeError("iOS version mismatch")
    for required in ["app.js", "delivery.js", "index.html", "小手机.html", "vendor/qr/jsQR.js", "vendor/qr/qrcode.js", "wechat-me.css", "wechat-me.js"]:
        if required not in archived_bundle:
            raise RuntimeError(f"required bundle file missing: {required}")

digest = sha256(package.read_bytes()).hexdigest()
print(f"VERIFIED_ZIP={package}")
print(f"FILES={len(names)}")
print(f"BUNDLE_FILES={len(source_bundle)}")
print(f"SIZE={package.stat().st_size}")
print(f"SHA256={digest}")
