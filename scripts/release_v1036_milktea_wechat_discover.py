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


old_title = "v1035 · 真实奶茶偏好与快速点单"
discover_title = "v1035 · 微信发现页与附近好友"
new_title = "v1036 · 真实奶茶与微信发现页合并版"
old_hotfix = "v1035-real-milktea-ordering-1"
discover_hotfix = "v1035-wechat-discover-1"
new_hotfix = "v1036-milktea-wechat-discover-1"

replace("app.js", "if(window.__NORTH_SHELL_BUILD__!=='1035')", "if(window.__NORTH_SHELL_BUILD__!=='1036')", 1)

replace("小手机.html", "window.__NORTH_SHELL_BUILD__='1035'", "window.__NORTH_SHELL_BUILD__='1036'", 1)
replace("小手机.html", "north-sw-reloaded-1035", "north-sw-reloaded-1036", 1)
replace("小手机.html", f"sw.js?v=1035&r={old_hotfix}", f"sw.js?v=1036&r={new_hotfix}", 1)
replace("小手机.html", "?v=1035", "?v=1036", 10)

replace("index.html", "小手机.html?v=1035", "小手机.html?v=1036", 1)
replace("repair.html", "小手机.html?v=1035", "小手机.html?v=1036", 2)
replace("sw.js", "const BUILD='1035';", "const BUILD='1036';", 1)
replace("sw.js", f"const HOTFIX='{old_hotfix}';", f"const HOTFIX='{new_hotfix}';", 1)
replace("sw.js", "const SHELL_CACHE='north-shell-v1035';", "const SHELL_CACHE='north-shell-v1036';", 1)
replace(
    "native/private-small-phone/Resources/PhoneWebBundleInfo.plist",
    "<string>1035</string>",
    "<string>1036</string>",
    1,
)

replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift",
    "1.0.155 (155)",
    "1.0.156 (156)",
    1,
)
replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj",
    "CURRENT_PROJECT_VERSION = 155;",
    "CURRENT_PROJECT_VERSION = 156;",
    12,
)
replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj",
    "MARKETING_VERSION = 1.0.155;",
    "MARKETING_VERSION = 1.0.156;",
    12,
)

for test_path in sorted((ROOT / "tests").glob("*.test.mjs")):
    text = test_path.read_bytes().decode("utf-8")
    original = text
    text = text.replace(old_title, new_title)
    text = text.replace(discover_title, new_title)
    text = text.replace(old_hotfix, new_hotfix)
    text = text.replace(discover_hotfix, new_hotfix)
    text = text.replace("north-shell-v1035", "north-shell-v1036")
    text = text.replace("v1035", "v1036")
    text = text.replace("1035", "1036")
    text = text.replace("1\\.0\\.155", "1\\.0\\.156")
    text = text.replace("1.0.155", "1.0.156")
    text = text.replace("CURRENT_PROJECT_VERSION = 155", "CURRENT_PROJECT_VERSION = 156")
    text = text.replace("MARKETING_VERSION = 1.0.155", "MARKETING_VERSION = 1.0.156")
    text = text.replace("\\(155\\)", "\\(156\\)")
    text = text.replace("(155)", "(156)")
    if text != original:
        test_path.write_bytes(text.encode("utf-8"))

print("Updated web to v1036, private iOS to 1.0.156 (156), native bridge remains 25")
