from hashlib import sha256
from pathlib import Path
from zipfile import ZipFile

root = Path(__file__).resolve().parents[1]
package = root / "delivery-v1089-private214-final" / "SmallPhone_v1089_GroupLeaveCareProgress_iOS214_MacReady.zip"
with ZipFile(package) as archive:
    names = archive.namelist()
    if archive.testzip() is not None:
        raise RuntimeError("ZIP integrity test failed")
    if not any(name.endswith("第二百一十四次安装_v1089_群聊退出与关心进度修复_请先读.md") for name in names):
        raise RuntimeError("missing v1089 install readme")
    app = archive.read(next(name for name in names if name.endswith("PhoneWeb.bundle/app.js"))).decode("utf-8")
    project = archive.read(next(name for name in names if name.endswith("PhoneCompanionTest.xcodeproj/project.pbxproj"))).decode("utf-8")
    webview = archive.read(next(name for name in names if name.endswith("PhoneCompanionTest/LocalPhoneWebView.swift"))).decode("utf-8")
    for token in [
        "const APP_VER='v1089 · 群聊退出与关心进度修复版'",
        "function recentMealProgressPrompt",
        "recentMealProgressPrompt(c)",
        "phone_friend_group_leave",
        "function manualUnlockReplyFallback",
        "roleServerPushHandoffAlreadyVisible(c,body,rowAt)",
    ]:
        if token not in app:
            raise RuntimeError(f"bundled web fix missing: {token}")
    if "window.__SMALL_PHONE_PRIVATE_BUILD__ = '1.0.214 (214)'" not in webview:
        raise RuntimeError("bundled private build marker mismatch")
    if project.count("CURRENT_PROJECT_VERSION = 214;") != 12 or project.count("MARKETING_VERSION = 1.0.214;") != 12:
        raise RuntimeError("bundled iOS version mismatch")
digest = sha256(package.read_bytes()).hexdigest()
print(f"ZIP={package}")
print(f"FILES={len(names)}")
print(f"SIZE={package.stat().st_size}")
print(f"SHA256={digest}")
print("v1089 package structure and protected-route checks passed")
