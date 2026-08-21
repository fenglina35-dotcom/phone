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


old_title = "v1025 · 计步传感器保存风暴修复"
new_title = "v1026 · 手机验证重复绑定修复"
old_hotfix = "v1025-motion-sensor-save-storm-repair-1"
new_hotfix = "v1026-passkey-rebind-repair-1"
old_suffix = "motion-sensor-save-storm-repair-1"
new_suffix = "passkey-rebind-repair-1"

web_app_paths = [
    "app.js",
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js",
]
for path in web_app_paths:
    replace(path, "if(window.__NORTH_SHELL_BUILD__!=='1025')", "if(window.__NORTH_SHELL_BUILD__!=='1026')", 1)
    replace(path, f"const APP_VER='{old_title}';", f"const APP_VER='{new_title}';", 1)
    replace(path, f"sw.js?v=1025&r={old_hotfix}", f"sw.js?v=1026&r={new_hotfix}", 1)

web_shell_paths = [
    "小手机.html",
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html",
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/小手机.html",
]
for path in web_shell_paths:
    replace(path, "window.__NORTH_SHELL_BUILD__='1025'", "window.__NORTH_SHELL_BUILD__='1026'", 1)
    replace(path, "north-sw-reloaded-1025", "north-sw-reloaded-1026", 1)
    replace(path, "sw.js?v=1025", "sw.js?v=1026", 1)
    replace(path, f"glass-theme.css?v=1025&r={old_suffix}", f"glass-theme.css?v=1026&r={new_suffix}", 1)
    replace(path, "?v=1025", "?v=1026", 8)

replace("小手机.html", f"r={old_hotfix}", f"r={new_hotfix}", 1)
replace("index.html", "小手机.html?v=1025", "小手机.html?v=1026", 1)
replace("repair.html", "小手机.html?v=1025", "小手机.html?v=1026", 2)
replace("sw.js", "const BUILD='1025';", "const BUILD='1026';", 1)
replace("sw.js", f"const HOTFIX='{old_hotfix}';", f"const HOTFIX='{new_hotfix}';", 1)
replace("sw.js", "const SHELL_CACHE='north-shell-v1025';", "const SHELL_CACHE='north-shell-v1026';", 1)
replace("native/private-small-phone/Resources/PhoneWebBundleInfo.plist", "<string>1025</string>", "<string>1026</string>", 1)
replace("native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/Info.plist", "<string>1025</string>", "<string>1026</string>", 1)
replace("native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift", "1.0.146 (146)", "1.0.147 (147)", 1)
replace("native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj", "CURRENT_PROJECT_VERSION = 146;", "CURRENT_PROJECT_VERSION = 147;", 12)
replace("native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj", "MARKETING_VERSION = 1.0.146;", "MARKETING_VERSION = 1.0.147;", 12)

for test_path in sorted((ROOT / "tests").glob("*.test.mjs")):
    if test_path.name == "north-app-store-pages.test.mjs":
        continue
    text = test_path.read_bytes().decode("utf-8")
    original = text
    text = text.replace(old_title, new_title)
    text = text.replace(old_hotfix, new_hotfix)
    text = text.replace(old_suffix, new_suffix)
    text = text.replace("north-shell-v1025", "north-shell-v1026")
    text = text.replace("v1025", "v1026")
    text = text.replace("?v=1025", "?v=1026")
    text = text.replace("BUILD='1025'", "BUILD='1026'")
    text = text.replace("__NORTH_SHELL_BUILD__='1025'", "__NORTH_SHELL_BUILD__='1026'")
    text = text.replace("<string>1025", "<string>1026")
    text = text.replace("north-sw-reloaded-1025", "north-sw-reloaded-1026")
    text = text.replace("1\\.0\\.146", "1\\.0\\.147")
    text = text.replace("1.0.146", "1.0.147")
    text = text.replace("CURRENT_PROJECT_VERSION = 146", "CURRENT_PROJECT_VERSION = 147")
    text = text.replace("\\(146\\)", "\\(147\\)")
    if text != original:
        test_path.write_bytes(text.encode("utf-8"))

print("Updated web v1026 and private iOS 1.0.147 (147) release identities")
