from hashlib import sha256
from pathlib import Path
from zipfile import ZipFile


root = Path(__file__).resolve().parents[1]
package = root / "delivery-v1087-private212-final" / "SmallPhone_v1087_BackgroundUnlockDelivery_iOS212_MacReady.zip"
with ZipFile(package) as archive:
    names = archive.namelist()
    if archive.testzip() is not None:
        raise RuntimeError("ZIP integrity test failed")
    if not any(name.endswith("第二百一十二次安装_v1087_后台解锁去重与必达修复_请先读.md") for name in names):
        raise RuntimeError("missing v1087 install readme")
    app_name = next(name for name in names if name.endswith("PhoneWeb.bundle/app.js"))
    project_name = next(name for name in names if name.endswith("PhoneCompanionTest.xcodeproj/project.pbxproj"))
    webview_name = next(name for name in names if name.endswith("PhoneCompanionTest/LocalPhoneWebView.swift"))
    app = archive.read(app_name).decode("utf-8")
    project = archive.read(project_name).decode("utf-8")
    webview = archive.read(webview_name).decode("utf-8")
    for token in [
        "const APP_VER='v1087 · 后台解锁去重与必达修复版'",
        "function manualUnlockReplyFallback",
        "function manualUnlockReplyGuard",
        "roleServerPushHandoffAlreadyVisible(c,body,rowAt)",
        "if(_ordinaryRepeat&&!_manualUnlockNote)",
    ]:
        if token not in app:
            raise RuntimeError(f"bundled unlock delivery fix missing: {token}")
    if "window.__SMALL_PHONE_PRIVATE_BUILD__ = '1.0.212 (212)'" not in webview:
        raise RuntimeError("bundled private build marker mismatch")
    if "CURRENT_PROJECT_VERSION = 212;" not in project or "MARKETING_VERSION = 1.0.212;" not in project:
        raise RuntimeError("bundled iOS version mismatch")

digest = sha256(package.read_bytes()).hexdigest()
print(f"ZIP={package}")
print(f"FILES={len(names)}")
print(f"SIZE={package.stat().st_size}")
print(f"SHA256={digest}")
print("v1087 package structure and background unlock delivery checks passed")
