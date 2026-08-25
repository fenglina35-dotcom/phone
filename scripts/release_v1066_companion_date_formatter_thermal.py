from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def replace(path, old, new, expected=None):
    target = ROOT / path
    text = target.read_bytes().decode("utf-8")
    count = text.count(old)
    if expected is not None and count == 0 and text.count(new) == expected:
        return
    if expected is not None and count != expected:
        raise RuntimeError(
            f"{path}: expected {expected} occurrences of {old!r}, found {count}"
        )
    if count:
        target.write_bytes(text.replace(old, new).encode("utf-8"))


old_title = "v1065 · 外卖澄清修订连续性修复版"
new_title = "v1066 · 伴生轮询日期格式化卡顿发热修复版"
old_hotfix = "v1065-delivery-clarification-revision-1"
new_hotfix = "v1066-companion-date-formatter-thermal-repair-1"
old_suffix = "delivery-clarification-revision-1"
new_suffix = "companion-date-formatter-thermal-repair-1"

web_app_paths = [
    "app.js",
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js",
]
for path in web_app_paths:
    replace(path, "if(window.__NORTH_SHELL_BUILD__!=='1065')", "if(window.__NORTH_SHELL_BUILD__!=='1066')", 1)
    replace(path, f"const APP_VER='{old_title}';", f"const APP_VER='{new_title}';", 1)
    replace(path, f"sw.js?v=1065&r={old_hotfix}", f"sw.js?v=1066&r={new_hotfix}", 1)

web_shell_paths = [
    "小手机.html",
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html",
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/小手机.html",
]
for path in web_shell_paths:
    replace(path, "window.__NORTH_SHELL_BUILD__='1065'", "window.__NORTH_SHELL_BUILD__='1066'", 1)
    replace(path, "north-sw-reloaded-1065", "north-sw-reloaded-1066", 1)
    replace(path, "sw.js?v=1065", "sw.js?v=1066", 1)
    replace(path, "glass-theme.css?v=1065&r=wechat-home-1", "glass-theme.css?v=1066&r=wechat-home-1", 1)
    replace(path, "?v=1065", "?v=1066")

replace("小手机.html", f"r={old_hotfix}", f"r={new_hotfix}", 1)
replace("index.html", "小手机.html?v=1065", "小手机.html?v=1066", 1)
replace("repair.html", "小手机.html?v=1065", "小手机.html?v=1066", 2)
replace("sw.js", "const BUILD='1065';", "const BUILD='1066';", 1)
replace("sw.js", f"const HOTFIX='{old_hotfix}';", f"const HOTFIX='{new_hotfix}';", 1)
replace("sw.js", "const SHELL_CACHE='north-shell-v1065';", "const SHELL_CACHE='north-shell-v1066';", 1)
replace("native/private-small-phone/Resources/PhoneWebBundleInfo.plist", "<string>1065</string>", "<string>1066</string>", 1)
replace("native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/Info.plist", "<string>1065</string>", "<string>1066</string>", 1)
replace("native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift", "1.0.188 (188)", "1.0.189 (189)", 1)
replace("native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj", "CURRENT_PROJECT_VERSION = 188;", "CURRENT_PROJECT_VERSION = 189;", 12)
replace("native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj", "MARKETING_VERSION = 1.0.188;", "MARKETING_VERSION = 1.0.189;", 12)

for test_path in sorted((ROOT / "tests").glob("*.test.mjs")):
    if test_path.name == "north-app-store-pages.test.mjs":
        continue
    text = test_path.read_bytes().decode("utf-8")
    original = text
    text = text.replace(old_title, new_title)
    text = text.replace(old_hotfix, new_hotfix)
    text = text.replace(old_suffix, new_suffix)
    text = text.replace("north-shell-v1065", "north-shell-v1066")
    text = text.replace("v1065", "v1066")
    text = text.replace("?v=1065", "?v=1066")
    text = text.replace("BUILD='1065'", "BUILD='1066'")
    text = text.replace("__NORTH_SHELL_BUILD__='1065'", "__NORTH_SHELL_BUILD__='1066'")
    text = text.replace("<string>1065", "<string>1066")
    text = text.replace("north-sw-reloaded-1065", "north-sw-reloaded-1066")
    text = text.replace("1\\.0\\.188", "1\\.0\\.189")
    text = text.replace("1.0.188", "1.0.189")
    text = text.replace("CURRENT_PROJECT_VERSION = 188", "CURRENT_PROJECT_VERSION = 189")
    text = text.replace("\\(188\\)", "\\(189\\)")
    if text != original:
        test_path.write_bytes(text.encode("utf-8"))

print("Updated web v1066 and private iOS 1.0.189 (189) release identities")
