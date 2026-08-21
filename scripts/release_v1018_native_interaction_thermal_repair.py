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


old_title = "v1017 · 小事簿后台入聊与气泡配色修复"
new_title = "v1018 · 私人 App 点击响应与发热修复"
old_hotfix = "v1017-notebook-inbox-bubble-repair-1"
new_hotfix = "v1018-native-interaction-thermal-repair-1"
old_suffix = "notebook-inbox-bubble-repair-1"
new_suffix = "native-interaction-thermal-repair-1"

web_app_paths = [
    "app.js",
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js",
]
for path in web_app_paths:
    replace(path, "if(window.__NORTH_SHELL_BUILD__!=='1017')", "if(window.__NORTH_SHELL_BUILD__!=='1018')", 1)
    replace(path, f"const APP_VER='{old_title}';", f"const APP_VER='{new_title}';", 1)
    replace(path, f"sw.js?v=1017&r={old_hotfix}", f"sw.js?v=1018&r={new_hotfix}", 1)

web_shell_paths = [
    "小手机.html",
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html",
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/小手机.html",
]
for path in web_shell_paths:
    replace(path, "window.__NORTH_SHELL_BUILD__='1017'", "window.__NORTH_SHELL_BUILD__='1018'", 1)
    replace(path, "north-sw-reloaded-1017", "north-sw-reloaded-1018", 1)
    replace(path, "sw.js?v=1017", "sw.js?v=1018", 1)
    replace(path, f"glass-theme.css?v=1017&r={old_suffix}", f"glass-theme.css?v=1018&r={new_suffix}", 1)
    replace(path, "?v=1017", "?v=1018", 8)

replace("小手机.html", f"r={old_hotfix}", f"r={new_hotfix}", 1)

replace("index.html", "小手机.html?v=1017", "小手机.html?v=1018", 1)
replace("repair.html", "小手机.html?v=1017", "小手机.html?v=1018", 2)
replace("sw.js", "const BUILD='1017';", "const BUILD='1018';", 1)
replace("sw.js", f"const HOTFIX='{old_hotfix}';", f"const HOTFIX='{new_hotfix}';", 1)
replace("sw.js", "const SHELL_CACHE='north-shell-v1017';", "const SHELL_CACHE='north-shell-v1018';", 1)
replace("native/private-small-phone/Resources/PhoneWebBundleInfo.plist", "<string>1017</string>", "<string>1018</string>", 1)
replace("native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/Info.plist", "<string>1017</string>", "<string>1018</string>", 1)
replace("native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift", "1.0.138 (138)", "1.0.139 (139)", 1)
replace("native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj", "CURRENT_PROJECT_VERSION = 138;", "CURRENT_PROJECT_VERSION = 139;", 12)
replace("native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj", "MARKETING_VERSION = 1.0.138;", "MARKETING_VERSION = 1.0.139;", 12)

for test_path in sorted((ROOT / "tests").glob("*.test.mjs")):
    text = test_path.read_bytes().decode("utf-8")
    original = text
    text = text.replace(old_title, new_title)
    text = text.replace(old_hotfix, new_hotfix)
    text = text.replace(old_suffix, new_suffix)
    text = text.replace("north-shell-v1017", "north-shell-v1018")
    text = text.replace("v1017", "v1018")
    text = text.replace("?v=1017", "?v=1018")
    text = text.replace("BUILD='1017'", "BUILD='1018'")
    text = text.replace("__NORTH_SHELL_BUILD__='1017'", "__NORTH_SHELL_BUILD__='1018'")
    text = text.replace("<string>1017", "<string>1018")
    text = text.replace("north-sw-reloaded-1017", "north-sw-reloaded-1018")
    text = text.replace("1\\.0\\.138", "1\\.0\\.139")
    text = text.replace("1.0.138", "1.0.139")
    text = text.replace("CURRENT_PROJECT_VERSION = 138", "CURRENT_PROJECT_VERSION = 139")
    text = text.replace("\\(138\\)", "\\(139\\)")
    if text != original:
        test_path.write_bytes(text.encode("utf-8"))

print("Updated web v1018 and private iOS 1.0.139 (139) release identities")
