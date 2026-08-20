from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def replace(path, old, new, expected=None):
    target = ROOT / path
    text = target.read_bytes().decode("utf-8")
    count = text.count(old)
    if expected is not None and count != expected:
        raise RuntimeError(f"{path}: expected {expected} occurrences of {old!r}, found {count}")
    if count:
        target.write_bytes(text.replace(old, new).encode("utf-8"))


replace("app.js", "if(window.__NORTH_SHELL_BUILD__!=='1009')", "if(window.__NORTH_SHELL_BUILD__!=='1010')", 1)
replace("app.js", "const APP_VER='v1009 · 私人App点击渲染与发热修复';", "const APP_VER='v1010 · 朋友圈回复与后台消息闭环修复';", 1)
replace("app.js", "sw.js?v=1009&r=v1009-native-render-thermal-repair-1", "sw.js?v=1010&r=v1010-moments-background-closure-repair-1", 1)
replace("小手机.html", "window.__NORTH_SHELL_BUILD__='1009'", "window.__NORTH_SHELL_BUILD__='1010'", 1)
replace("小手机.html", "north-sw-reloaded-1009", "north-sw-reloaded-1010", 1)
replace("小手机.html", "sw.js?v=1009&r=v1009-native-render-thermal-repair-1", "sw.js?v=1010&r=v1010-moments-background-closure-repair-1", 1)
replace("小手机.html", "glass-theme.css?v=1009&r=native-render-thermal-repair-1", "glass-theme.css?v=1010&r=moments-background-closure-repair-1", 1)
replace("小手机.html", "?v=1009", "?v=1010", 8)
replace("index.html", "小手机.html?v=1009", "小手机.html?v=1010", 1)
replace("repair.html", "小手机.html?v=1009", "小手机.html?v=1010", 2)
replace("sw.js", "const BUILD='1009';", "const BUILD='1010';", 1)
replace("sw.js", "const HOTFIX='v1009-native-render-thermal-repair-1';", "const HOTFIX='v1010-moments-background-closure-repair-1';", 1)
replace("sw.js", "const SHELL_CACHE='north-shell-v1009';", "const SHELL_CACHE='north-shell-v1010';", 1)
replace("native/private-small-phone/Resources/PhoneWebBundleInfo.plist", "<string>1009</string>", "<string>1010</string>", 1)
replace("native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift", "1.0.130 (130)", "1.0.131 (131)", 1)
replace("native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj", "CURRENT_PROJECT_VERSION = 130;", "CURRENT_PROJECT_VERSION = 131;", 12)
replace("native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj", "MARKETING_VERSION = 1.0.130;", "MARKETING_VERSION = 1.0.131;", 12)

for test_path in sorted((ROOT / "tests").glob("*.test.mjs")):
    text = test_path.read_bytes().decode("utf-8")
    original = text
    text = text.replace("v1009 · 私人App点击渲染与发热修复", "v1010 · 朋友圈回复与后台消息闭环修复")
    text = text.replace("v1009-native-render-thermal-repair-1", "v1010-moments-background-closure-repair-1")
    text = text.replace("native-render-thermal-repair-1", "moments-background-closure-repair-1")
    text = text.replace("north-shell-v1009", "north-shell-v1010")
    text = text.replace("v1009", "v1010")
    text = text.replace("?v=1009", "?v=1010")
    text = text.replace("BUILD='1009'", "BUILD='1010'")
    text = text.replace("__NORTH_SHELL_BUILD__='1009'", "__NORTH_SHELL_BUILD__='1010'")
    text = text.replace("<string>1009", "<string>1010")
    text = text.replace("north-sw-reloaded-1009", "north-sw-reloaded-1010")
    text = text.replace("1\\.0\\.130", "1\\.0\\.131")
    text = text.replace("1.0.130", "1.0.131")
    text = text.replace("CURRENT_PROJECT_VERSION = 130", "CURRENT_PROJECT_VERSION = 131")
    text = text.replace("\\(130\\)", "\\(131\\)")
    if text != original:
        test_path.write_bytes(text.encode("utf-8"))

print("Updated web v1010 and private iOS 1.0.131 (131) release identities")
