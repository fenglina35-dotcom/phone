from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def replace(path, old, new, expected=None):
    target = ROOT / path
    text = target.read_bytes().decode("utf-8")
    count = text.count(old)
    if expected is not None and count != expected:
        raise RuntimeError(
            f"{path}: expected {expected} occurrences of {old!r}, found {count}"
        )
    if count:
        target.write_bytes(text.replace(old, new).encode("utf-8"))


old_title = "v1028 · X个人主页布局修正"
new_title = "v1029 · 真实外卖与角色钱包"
old_hotfix = "v1028-x-profile-layout-1"
new_hotfix = "v1029-real-delivery-wallet-1"
old_suffix = "x-profile-layout-1"
new_suffix = "real-delivery-wallet-1"

web_app_paths = [
    "app.js",
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js",
]
for path in web_app_paths:
    replace(path, "if(window.__NORTH_SHELL_BUILD__!=='1028')", "if(window.__NORTH_SHELL_BUILD__!=='1029')", 1)
    replace(path, f"const APP_VER='{old_title}';", f"const APP_VER='{new_title}';", 1)
    replace(path, f"sw.js?v=1028&r={old_hotfix}", f"sw.js?v=1029&r={new_hotfix}", 1)

web_shell_paths = [
    "小手机.html",
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html",
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/小手机.html",
]
for path in web_shell_paths:
    replace(path, "window.__NORTH_SHELL_BUILD__='1028'", "window.__NORTH_SHELL_BUILD__='1029'", 1)
    replace(path, "north-sw-reloaded-1028", "north-sw-reloaded-1029", 1)
    replace(path, "sw.js?v=1028", "sw.js?v=1029", 1)
    replace(path, f"glass-theme.css?v=1028&r={old_suffix}", f"glass-theme.css?v=1029&r={new_suffix}", 1)
    replace(path, "?v=1028", "?v=1029", 9)

replace("小手机.html", f"r={old_hotfix}", f"r={new_hotfix}", 1)
replace("index.html", "小手机.html?v=1028", "小手机.html?v=1029", 1)
replace("repair.html", "小手机.html?v=1028", "小手机.html?v=1029", 2)
replace("sw.js", "const BUILD='1028';", "const BUILD='1029';", 1)
replace("sw.js", f"const HOTFIX='{old_hotfix}';", f"const HOTFIX='{new_hotfix}';", 1)
replace("sw.js", "const SHELL_CACHE='north-shell-v1028';", "const SHELL_CACHE='north-shell-v1029';", 1)
replace("native/private-small-phone/Resources/PhoneWebBundleInfo.plist", "<string>1028</string>", "<string>1029</string>", 1)
replace("native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/Info.plist", "<string>1028</string>", "<string>1029</string>", 1)
replace("native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift", "1.0.149 (149)", "1.0.150 (150)", 1)
replace("native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj", "CURRENT_PROJECT_VERSION = 149;", "CURRENT_PROJECT_VERSION = 150;", 12)
replace("native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj", "MARKETING_VERSION = 1.0.149;", "MARKETING_VERSION = 1.0.150;", 12)

for test_path in sorted((ROOT / "tests").glob("*.test.mjs")):
    if test_path.name == "north-app-store-pages.test.mjs":
        continue
    text = test_path.read_bytes().decode("utf-8")
    original = text
    text = text.replace(old_title, new_title)
    text = text.replace(old_hotfix, new_hotfix)
    text = text.replace(old_suffix, new_suffix)
    text = text.replace("north-shell-v1028", "north-shell-v1029")
    text = text.replace("v1028", "v1029")
    text = text.replace("?v=1028", "?v=1029")
    text = text.replace("BUILD='1028'", "BUILD='1029'")
    text = text.replace("__NORTH_SHELL_BUILD__='1028'", "__NORTH_SHELL_BUILD__='1029'")
    text = text.replace("<string>1028", "<string>1029")
    text = text.replace("north-sw-reloaded-1028", "north-sw-reloaded-1029")
    text = text.replace("1\\.0\\.149", "1\\.0\\.150")
    text = text.replace("1.0.149", "1.0.150")
    text = text.replace("CURRENT_PROJECT_VERSION = 149", "CURRENT_PROJECT_VERSION = 150")
    text = text.replace("\\(149\\)", "\\(150\\)")
    if text != original:
        test_path.write_bytes(text.encode("utf-8"))

print("Updated web v1029 and private iOS 1.0.150 (150) release identities")
