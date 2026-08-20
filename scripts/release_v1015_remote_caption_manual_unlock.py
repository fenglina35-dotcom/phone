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


old_title = "v1014 · 伴生解锁闭环与远控自然字幕修复"
new_title = "v1015 · 远控真实字幕与伴生事件回执修复"
old_hotfix = "v1014-companion-unlock-remote-natural-caption-1"
new_hotfix = "v1015-remote-caption-manual-unlock-1"
old_suffix = "companion-unlock-remote-natural-caption-1"
new_suffix = "remote-caption-manual-unlock-1"

replace("app.js", "if(window.__NORTH_SHELL_BUILD__!=='1014')", "if(window.__NORTH_SHELL_BUILD__!=='1015')", 1)
replace("app.js", f"const APP_VER='{old_title}';", f"const APP_VER='{new_title}';", 1)
replace("app.js", f"sw.js?v=1014&r={old_hotfix}", f"sw.js?v=1015&r={new_hotfix}", 1)
replace("小手机.html", "window.__NORTH_SHELL_BUILD__='1014'", "window.__NORTH_SHELL_BUILD__='1015'", 1)
replace("小手机.html", "north-sw-reloaded-1014", "north-sw-reloaded-1015", 1)
replace("小手机.html", f"sw.js?v=1014&r={old_hotfix}", f"sw.js?v=1015&r={new_hotfix}", 1)
replace("小手机.html", f"glass-theme.css?v=1014&r={old_suffix}", f"glass-theme.css?v=1015&r={new_suffix}", 1)
replace("小手机.html", "?v=1014", "?v=1015", 8)
replace("index.html", "小手机.html?v=1014", "小手机.html?v=1015", 1)
replace("repair.html", "小手机.html?v=1014", "小手机.html?v=1015", 2)
replace("sw.js", "const BUILD='1014';", "const BUILD='1015';", 1)
replace("sw.js", f"const HOTFIX='{old_hotfix}';", f"const HOTFIX='{new_hotfix}';", 1)
replace("sw.js", "const SHELL_CACHE='north-shell-v1014';", "const SHELL_CACHE='north-shell-v1015';", 1)
replace("native/private-small-phone/Resources/PhoneWebBundleInfo.plist", "<string>1014</string>", "<string>1015</string>", 1)
replace("native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift", "1.0.135 (135)", "1.0.136 (136)", 1)
replace("native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj", "CURRENT_PROJECT_VERSION = 135;", "CURRENT_PROJECT_VERSION = 136;", 12)
replace("native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj", "MARKETING_VERSION = 1.0.135;", "MARKETING_VERSION = 1.0.136;", 12)

for test_path in sorted((ROOT / "tests").glob("*.test.mjs")):
    text = test_path.read_bytes().decode("utf-8")
    original = text
    text = text.replace(old_title, new_title)
    text = text.replace(old_hotfix, new_hotfix)
    text = text.replace(old_suffix, new_suffix)
    text = text.replace("north-shell-v1014", "north-shell-v1015")
    text = text.replace("v1014", "v1015")
    text = text.replace("?v=1014", "?v=1015")
    text = text.replace("BUILD='1014'", "BUILD='1015'")
    text = text.replace("__NORTH_SHELL_BUILD__='1014'", "__NORTH_SHELL_BUILD__='1015'")
    text = text.replace("<string>1014", "<string>1015")
    text = text.replace("north-sw-reloaded-1014", "north-sw-reloaded-1015")
    text = text.replace("1\\.0\\.135", "1\\.0\\.136")
    text = text.replace("1.0.135", "1.0.136")
    text = text.replace("CURRENT_PROJECT_VERSION = 135", "CURRENT_PROJECT_VERSION = 136")
    text = text.replace("\\(135\\)", "\\(136\\)")
    if text != original:
        test_path.write_bytes(text.encode("utf-8"))

print("Updated web v1015 and private iOS 1.0.136 (136) release identities")
