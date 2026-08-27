from hashlib import sha256
from pathlib import Path
from zipfile import ZipFile

root = Path(__file__).resolve().parents[1]
package = root / "delivery-v1088-private213-final" / "SmallPhone_v1088_ScreenTimeControlRollback_iOS213_MacReady.zip"
with ZipFile(package) as archive:
    names = archive.namelist()
    if archive.testzip() is not None:
        raise RuntimeError("ZIP integrity test failed")
    if not any(name.endswith("第二百一十三次安装_v1088_抖音锁定与限额回退修复_请先读.md") for name in names):
        raise RuntimeError("missing v1088 install readme")
    app = archive.read(next(name for name in names if name.endswith("PhoneWeb.bundle/app.js"))).decode("utf-8")
    sync = archive.read(next(name for name in names if name.endswith("PhoneCompanionTest/CompanionSyncView.swift"))).decode("utf-8")
    project = archive.read(next(name for name in names if name.endswith("PhoneCompanionTest.xcodeproj/project.pbxproj"))).decode("utf-8")
    webview = archive.read(next(name for name in names if name.endswith("PhoneCompanionTest/LocalPhoneWebView.swift"))).decode("utf-8")
    for token in ["const APP_VER='v1088 · 抖音锁定与限额回退修复版'", "function manualUnlockReplyFallback", "roleServerPushHandoffAlreadyVisible(c,body,rowAt)"]:
        if token not in app:
            raise RuntimeError(f"bundled web fix missing: {token}")
    if "reconcileReachedDailyLimits" in sync or '"limitReached":' in sync:
        raise RuntimeError("v1084 snapshot relock logic was not rolled back")
    for token in ["var reachedTokens = loadLimitLockedTokens()", "reachedTokens.remove(token)", "saveLimitLockedTokens(reachedTokens)"]:
        if token not in sync:
            raise RuntimeError(f"stale limit reset missing: {token}")
    if "window.__SMALL_PHONE_PRIVATE_BUILD__ = '1.0.213 (213)'" not in webview:
        raise RuntimeError("bundled private build marker mismatch")
    if "CURRENT_PROJECT_VERSION = 213;" not in project or "MARKETING_VERSION = 1.0.213;" not in project:
        raise RuntimeError("bundled iOS version mismatch")
digest = sha256(package.read_bytes()).hexdigest()
print(f"ZIP={package}")
print(f"FILES={len(names)}")
print(f"SIZE={package.stat().st_size}")
print(f"SHA256={digest}")
print("v1088 package structure and Screen Time rollback checks passed")
