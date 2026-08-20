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


replace("app.js", "if(window.__NORTH_SHELL_BUILD__!=='1011')", "if(window.__NORTH_SHELL_BUILD__!=='1012')", 1)
replace("app.js", "const APP_VER='v1011 · 模型线路、朋友圈与后台消息修复';", "const APP_VER='v1012 · 语音、朋友圈、相册与伴生稳定修复';", 1)
replace("app.js", "sw.js?v=1011&r=v1011-model-route-alignment-1", "sw.js?v=1012&r=v1012-voice-moments-album-companion-stability-1", 1)
replace("小手机.html", "window.__NORTH_SHELL_BUILD__='1011'", "window.__NORTH_SHELL_BUILD__='1012'", 1)
replace("小手机.html", "north-sw-reloaded-1011", "north-sw-reloaded-1012", 1)
replace("小手机.html", "sw.js?v=1011&r=v1011-model-route-alignment-1", "sw.js?v=1012&r=v1012-voice-moments-album-companion-stability-1", 1)
replace("小手机.html", "glass-theme.css?v=1011&r=model-route-alignment-1", "glass-theme.css?v=1012&r=voice-moments-album-companion-stability-1", 1)
replace("小手机.html", "?v=1011", "?v=1012", 8)
replace("index.html", "小手机.html?v=1011", "小手机.html?v=1012", 1)
replace("repair.html", "小手机.html?v=1011", "小手机.html?v=1012", 2)
replace("sw.js", "const BUILD='1011';", "const BUILD='1012';", 1)
replace("sw.js", "const HOTFIX='v1011-model-route-alignment-1';", "const HOTFIX='v1012-voice-moments-album-companion-stability-1';", 1)
replace("sw.js", "const SHELL_CACHE='north-shell-v1011';", "const SHELL_CACHE='north-shell-v1012';", 1)
replace("native/private-small-phone/Resources/PhoneWebBundleInfo.plist", "<string>1011</string>", "<string>1012</string>", 1)
replace("native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift", "1.0.132 (132)", "1.0.133 (133)", 1)
replace("native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj", "CURRENT_PROJECT_VERSION = 132;", "CURRENT_PROJECT_VERSION = 133;", 12)
replace("native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj", "MARKETING_VERSION = 1.0.132;", "MARKETING_VERSION = 1.0.133;", 12)

for test_path in sorted((ROOT / "tests").glob("*.test.mjs")):
    text = test_path.read_bytes().decode("utf-8")
    original = text
    text = text.replace("v1011 · 模型线路、朋友圈与后台消息修复", "v1012 · 语音、朋友圈、相册与伴生稳定修复")
    text = text.replace("v1011-model-route-alignment-1", "v1012-voice-moments-album-companion-stability-1")
    text = text.replace("model-route-alignment-1", "voice-moments-album-companion-stability-1")
    text = text.replace("north-shell-v1011", "north-shell-v1012")
    text = text.replace("v1011", "v1012")
    text = text.replace("?v=1011", "?v=1012")
    text = text.replace("BUILD='1011'", "BUILD='1012'")
    text = text.replace("__NORTH_SHELL_BUILD__='1011'", "__NORTH_SHELL_BUILD__='1012'")
    text = text.replace("<string>1011", "<string>1012")
    text = text.replace("north-sw-reloaded-1011", "north-sw-reloaded-1012")
    text = text.replace("1\\.0\\.132", "1\\.0\\.133")
    text = text.replace("1.0.132", "1.0.133")
    text = text.replace("CURRENT_PROJECT_VERSION = 132", "CURRENT_PROJECT_VERSION = 133")
    text = text.replace("\\(132\\)", "\\(133\\)")
    if text != original:
        test_path.write_bytes(text.encode("utf-8"))

print("Updated web v1012 and private iOS 1.0.133 (133) release identities")
