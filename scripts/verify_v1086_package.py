from hashlib import sha256
from pathlib import Path
from zipfile import ZipFile


root = Path(__file__).resolve().parents[1]
package = root / "delivery-v1086-private211-final" / "SmallPhone_v1086_PerformanceRollbackImageQuote_iOS211_MacReady.zip"
with ZipFile(package) as archive:
    names = archive.namelist()
    if len(names) != 181:
        raise RuntimeError(f"unexpected ZIP entry count: {len(names)}")
    if archive.testzip() is not None:
        raise RuntimeError("ZIP integrity test failed")
    if not any(name.endswith("第二百一十一次安装_v1086_降载回退与图片引用修复_请先读.md") for name in names):
        raise RuntimeError("missing v1086 install readme")
    app_name = next(name for name in names if name.endswith("PhoneWeb.bundle/app.js"))
    project_name = next(name for name in names if name.endswith("PhoneCompanionTest.xcodeproj/project.pbxproj"))
    webview_name = next(name for name in names if name.endswith("PhoneCompanionTest/LocalPhoneWebView.swift"))
    app = archive.read(app_name).decode("utf-8")
    project = archive.read(project_name).decode("utf-8")
    webview = archive.read(webview_name).decode("utf-8")
    required_app = [
        "const APP_VER='v1086 · 私人App降载回退与图片引用修复版'",
        "PRIVATE_IMAGE_CACHE_CHAR_LIMIT=48*1024*1024",
        "missing=eligible.slice(0,12)",
        "function privateNativeShellOn",
        "function manualWechatSummarySource",
        "async function manualWechatSummary",
        "function quoteClear(ev)",
        'onclick="quoteClear(event)"',
        "现在必须只发一轮真实消息来找ta",
        "禁止把ta写成“她”“他”“用户”",
    ]
    for token in required_app:
        if token not in app:
            raise RuntimeError(f"bundled app fix missing: {token}")
    forbidden_app = [
        "pressured=!force&&northNativeMaintenancePaused(),batchSize=pressured?2:4",
        "if(!force&&northNativeMaintenancePaused())_visibleImageHydrateTimer=setTimeout(run,650)",
    ]
    for token in forbidden_app:
        if token in app:
            raise RuntimeError(f"reverted pressure logic still bundled: {token}")
    for token in [
        "private var webContentTerminationTimes: [TimeInterval] = []",
        "guard attempt == 1 else",
        "deadline: .now() + 5",
        "window.__SMALL_PHONE_PRIVATE_BUILD__ = '1.0.211 (211)'",
    ]:
        if token not in webview:
            raise RuntimeError(f"bundled WebContent rollback missing: {token}")
    if "smallPhone.webContentTerminationTimes.v2" in webview:
        raise RuntimeError("persistent WebContent termination counter was not rolled back")
    if "CURRENT_PROJECT_VERSION = 211;" not in project or "MARKETING_VERSION = 1.0.211;" not in project:
        raise RuntimeError("bundled iOS version mismatch")

digest = sha256(package.read_bytes()).hexdigest()
print(f"ZIP={package}")
print(f"FILES={len(names)}")
print(f"SIZE={package.stat().st_size}")
print(f"SHA256={digest}")
print("v1086 package structure, selective rollback, images and quote cancel checks passed")
