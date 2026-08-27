from hashlib import sha256
from pathlib import Path
from zipfile import ZipFile

root = Path(__file__).resolve().parents[1]
source = root / "native/private-small-phone/XcodeProject"
bundle_source = source / "PhoneCompanionTest/PhoneWeb.bundle"
package = root / "delivery-v1095-private220-final" / "SmallPhone_v1095_WechatLogoutReliableReturn_iOS220_MacReady.zip"


def file_map(path: Path) -> dict[str, bytes]:
    return {item.relative_to(path).as_posix(): item.read_bytes() for item in path.rglob("*") if item.is_file() and item.suffix.lower() not in {".zip", ".pyc"} and "__pycache__" not in item.parts}


with ZipFile(package) as archive:
    names = archive.namelist()
    if archive.testzip() is not None:
        raise RuntimeError("ZIP integrity test failed")
    if len([name for name in names if name.endswith("PhoneWeb.bundle/index.html")]) != 1:
        raise RuntimeError("expected exactly one PhoneWeb.bundle/index.html")
    if any(name.lower().endswith(".zip") or "/__pycache__/" in name or name.lower().endswith(".pyc") for name in names):
        raise RuntimeError("nested ZIP or cache file found")
    guide = next((name for name in names if name.endswith("第二百二十次安装_v1095_微信退出回话可靠交付_请先读.md")), "")
    if not guide:
        raise RuntimeError("missing v1095 install readme")
    prefix = guide.split("第二百二十次安装", 1)[0] + "PhoneCompanionTest/PhoneWeb.bundle/"
    source_bundle = file_map(bundle_source)
    archived_bundle = {name[len(prefix):]: archive.read(name) for name in names if name.startswith(prefix) and not name.endswith("/")}
    if source_bundle != archived_bundle:
        raise RuntimeError("ZIP PhoneWeb.bundle differs from source bundle")
    app = archived_bundle["app.js"].decode("utf-8")
    project = archive.read(next(name for name in names if name.endswith("PhoneCompanionTest.xcodeproj/project.pbxproj"))).decode("utf-8")
    webview = archive.read(next(name for name in names if name.endswith("PhoneCompanionTest/LocalPhoneWebView.swift"))).decode("utf-8")
    for token in [
        "const APP_VER='v1095 · 微信退出回话可靠交付版'",
        "function wxLoginCompletionVisibleContent",
        "const _wxLoginCompletion=wxLoginCompletionFeature(note)",
        "if(!_wxLoginCompletion){const _nativeInspectionQueued=maybeSpyIntent",
        "function remoteControlFinish",
    ]:
        if token not in app:
            raise RuntimeError(f"bundled app fix missing: {token}")
    if "window.__SMALL_PHONE_PRIVATE_BUILD__ = '1.0.220 (220)'" not in webview:
        raise RuntimeError("bundled private build marker mismatch")
    if project.count("CURRENT_PROJECT_VERSION = 220;") != 12 or project.count("MARKETING_VERSION = 1.0.220;") != 12:
        raise RuntimeError("bundled iOS version mismatch")
    for required in ["app.js", "delivery.js", "index.html", "小手机.html", "vendor/qr/jsQR.js", "vendor/qr/qrcode.js", "wechat-me.css", "wechat-me.js"]:
        if required not in archived_bundle:
            raise RuntimeError(f"required bundle file missing: {required}")

digest = sha256(package.read_bytes()).hexdigest()
print(f"ZIP={package}")
print(f"FILES={len(names)}")
print(f"BUNDLE_FILES={len(source_bundle)}")
print(f"SIZE={package.stat().st_size}")
print(f"SHA256={digest}")
print("v1095 package structure, byte identity, version and WeChat logout delivery checks passed")
