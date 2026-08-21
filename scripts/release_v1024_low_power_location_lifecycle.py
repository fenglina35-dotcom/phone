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


old_title = "v1023 · 伴生快照写入放大与发热修复"
new_title = "v1024 · 低功耗定位生命周期与发热修复"
old_hotfix = "v1023-companion-snapshot-write-repair-1"
new_hotfix = "v1024-low-power-location-lifecycle-1"
old_suffix = "companion-snapshot-write-repair-1"
new_suffix = "low-power-location-lifecycle-1"

web_app_paths = [
    "app.js",
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js",
]
for path in web_app_paths:
    replace(path, "if(window.__NORTH_SHELL_BUILD__!=='1023')", "if(window.__NORTH_SHELL_BUILD__!=='1024')", 1)
    replace(path, f"const APP_VER='{old_title}';", f"const APP_VER='{new_title}';", 1)
    replace(path, f"sw.js?v=1023&r={old_hotfix}", f"sw.js?v=1024&r={new_hotfix}", 1)

web_shell_paths = [
    "小手机.html",
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html",
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/小手机.html",
]
for path in web_shell_paths:
    replace(path, "window.__NORTH_SHELL_BUILD__='1023'", "window.__NORTH_SHELL_BUILD__='1024'", 1)
    replace(path, "north-sw-reloaded-1023", "north-sw-reloaded-1024", 1)
    replace(path, "sw.js?v=1023", "sw.js?v=1024", 1)
    replace(path, f"glass-theme.css?v=1023&r={old_suffix}", f"glass-theme.css?v=1024&r={new_suffix}", 1)
    replace(path, "?v=1023", "?v=1024", 8)

replace("小手机.html", f"r={old_hotfix}", f"r={new_hotfix}", 1)
replace("index.html", "小手机.html?v=1023", "小手机.html?v=1024", 1)
replace("repair.html", "小手机.html?v=1023", "小手机.html?v=1024", 2)
replace("sw.js", "const BUILD='1023';", "const BUILD='1024';", 1)
replace("sw.js", f"const HOTFIX='{old_hotfix}';", f"const HOTFIX='{new_hotfix}';", 1)
replace("sw.js", "const SHELL_CACHE='north-shell-v1023';", "const SHELL_CACHE='north-shell-v1024';", 1)
replace("native/private-small-phone/Resources/PhoneWebBundleInfo.plist", "<string>1023</string>", "<string>1024</string>", 1)
replace("native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/Info.plist", "<string>1023</string>", "<string>1024</string>", 1)
replace("native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift", "1.0.144 (144)", "1.0.145 (145)", 1)
replace("native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj", "CURRENT_PROJECT_VERSION = 144;", "CURRENT_PROJECT_VERSION = 145;", 12)
replace("native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj", "MARKETING_VERSION = 1.0.144;", "MARKETING_VERSION = 1.0.145;", 12)

for test_path in sorted((ROOT / "tests").glob("*.test.mjs")):
    if test_path.name == "north-app-store-pages.test.mjs":
        continue
    text = test_path.read_bytes().decode("utf-8")
    original = text
    text = text.replace(old_title, new_title)
    text = text.replace(old_hotfix, new_hotfix)
    text = text.replace(old_suffix, new_suffix)
    text = text.replace("north-shell-v1023", "north-shell-v1024")
    text = text.replace("v1023", "v1024")
    text = text.replace("?v=1023", "?v=1024")
    text = text.replace("BUILD='1023'", "BUILD='1024'")
    text = text.replace("__NORTH_SHELL_BUILD__='1023'", "__NORTH_SHELL_BUILD__='1024'")
    text = text.replace("<string>1023", "<string>1024")
    text = text.replace("north-sw-reloaded-1023", "north-sw-reloaded-1024")
    text = text.replace("1\\.0\\.144", "1\\.0\\.145")
    text = text.replace("1.0.144", "1.0.145")
    text = text.replace("CURRENT_PROJECT_VERSION = 144", "CURRENT_PROJECT_VERSION = 145")
    text = text.replace("\\(144\\)", "\\(145\\)")
    if text != original:
        test_path.write_bytes(text.encode("utf-8"))

print("Updated web v1024 and private iOS 1.0.145 (145) release identities")
