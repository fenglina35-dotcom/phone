from hashlib import sha256
from pathlib import Path
from zipfile import ZipFile


root = Path(__file__).resolve().parents[1]
package = root / "delivery-v1085-private210-final" / "SmallPhone_v1085_WebContentMemoryWechatManualSummary_iOS210_MacReady.zip"
with ZipFile(package) as archive:
    names = archive.namelist()
    if len(names) != 181:
        raise RuntimeError(f"unexpected ZIP entry count: {len(names)}")
    if archive.testzip() is not None:
        raise RuntimeError("ZIP integrity test failed")
    if not any(name.endswith("第二百一十次安装_v1085_WebContent降载与微信手动总结_请先读.md") for name in names):
        raise RuntimeError("missing v1085 install readme")
    app_name = next(name for name in names if name.endswith("PhoneWeb.bundle/app.js"))
    project_name = next(name for name in names if name.endswith("PhoneCompanionTest.xcodeproj/project.pbxproj"))
    webview_name = next(name for name in names if name.endswith("PhoneCompanionTest/LocalPhoneWebView.swift"))
    app = archive.read(app_name).decode("utf-8")
    project = archive.read(project_name).decode("utf-8")
    webview = archive.read(webview_name).decode("utf-8")
    required_app = [
        "const APP_VER='v1085 · WebContent降载与微信手动总结版'",
        "PRIVATE_IMAGE_CACHE_CHAR_LIMIT=16*1024*1024",
        "missing=eligible.slice(0,4)",
        "function northNativeMaintenancePaused",
        "function manualWechatSummarySource",
        "async function manualWechatSummary",
        "当前没有尚未总结的新微信",
        "现在必须只发一轮真实消息来找ta",
        "禁止把ta写成“她”“他”“用户”",
        "今日限额已达到",
        "通话陪睡间隔，不等于设备测得的真实睡眠",
    ]
    for token in required_app:
        if token not in app:
            raise RuntimeError(f"bundled app fix missing: {token}")
    for token in [
        "smallPhone.webContentTerminationTimes.v2",
        "guard attempt == 1 else",
        "deadline: .now() + 15",
        "window.__SMALL_PHONE_PRIVATE_BUILD__ = '1.0.210 (210)'",
    ]:
        if token not in webview:
            raise RuntimeError(f"bundled WebContent recovery fix missing: {token}")
    if "CURRENT_PROJECT_VERSION = 210;" not in project or "MARKETING_VERSION = 1.0.210;" not in project:
        raise RuntimeError("bundled iOS version mismatch")

digest = sha256(package.read_bytes()).hexdigest()
print(f"ZIP={package}")
print(f"FILES={len(names)}")
print(f"SIZE={package.stat().st_size}")
print(f"SHA256={digest}")
print("v1085 package structure, bundled versions, WebContent and manual WeChat summary fixes passed")
