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
    target.write_bytes(text.replace(old, new).encode("utf-8"))


old_title = "v1034 · 微信通讯录固定导航修复"
new_title = "v1035 · 真实奶茶偏好与快速点单"
old_hotfix = "v1034-wechat-contacts-fixed-1"
new_hotfix = "v1035-real-milktea-ordering-1"

replace("app.js", "if(window.__NORTH_SHELL_BUILD__!=='1034')", "if(window.__NORTH_SHELL_BUILD__!=='1035')", 1)
replace("app.js", f"const APP_VER='{old_title}';", f"const APP_VER='{new_title}';", 1)
replace("app.js", f"sw.js?v=1034&r={old_hotfix}", f"sw.js?v=1035&r={new_hotfix}", 1)

replace("小手机.html", "window.__NORTH_SHELL_BUILD__='1034'", "window.__NORTH_SHELL_BUILD__='1035'", 1)
replace("小手机.html", "north-sw-reloaded-1034", "north-sw-reloaded-1035", 1)
replace("小手机.html", f"sw.js?v=1034&r={old_hotfix}", f"sw.js?v=1035&r={new_hotfix}", 1)
replace("小手机.html", "?v=1034", "?v=1035", 10)

replace("index.html", "小手机.html?v=1034", "小手机.html?v=1035", 1)
replace("repair.html", "小手机.html?v=1034", "小手机.html?v=1035", 2)
replace("sw.js", "const BUILD='1034';", "const BUILD='1035';", 1)
replace("sw.js", f"const HOTFIX='{old_hotfix}';", f"const HOTFIX='{new_hotfix}';", 1)
replace("sw.js", "const SHELL_CACHE='north-shell-v1034';", "const SHELL_CACHE='north-shell-v1035';", 1)
replace(
    "native/private-small-phone/Resources/PhoneWebBundleInfo.plist",
    "<string>1034</string>",
    "<string>1035</string>",
    1,
)

replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift",
    "1.0.154 (154)",
    "1.0.155 (155)",
    1,
)
replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj",
    "CURRENT_PROJECT_VERSION = 154;",
    "CURRENT_PROJECT_VERSION = 155;",
    12,
)
replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj",
    "MARKETING_VERSION = 1.0.154;",
    "MARKETING_VERSION = 1.0.155;",
    12,
)

for test_path in sorted((ROOT / "tests").glob("*.test.mjs")):
    text = test_path.read_bytes().decode("utf-8")
    original = text
    text = text.replace(old_title, new_title)
    text = text.replace(old_hotfix, new_hotfix)
    text = text.replace("north-shell-v1034", "north-shell-v1035")
    text = text.replace("v1034", "v1035")
    text = text.replace("1034", "1035")
    text = text.replace("1\\.0\\.154", "1\\.0\\.155")
    text = text.replace("1.0.154", "1.0.155")
    text = text.replace("CURRENT_PROJECT_VERSION = 154", "CURRENT_PROJECT_VERSION = 155")
    text = text.replace("MARKETING_VERSION = 1.0.154", "MARKETING_VERSION = 1.0.155")
    text = text.replace("\\(154\\)", "\\(155\\)")
    text = text.replace("(154)", "(155)")
    if text != original:
        test_path.write_bytes(text.encode("utf-8"))

print("Updated web to v1035, private iOS to 1.0.155 (155), native bridge remains 25")
