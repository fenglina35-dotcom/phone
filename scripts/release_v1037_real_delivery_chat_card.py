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


old_title = "v1036 · 真实奶茶与微信发现页合并版"
new_title = "v1037 · 微信真实外卖订单卡片"
old_hotfix = "v1036-milktea-wechat-discover-1"
new_hotfix = "v1037-wechat-real-delivery-card-1"

replace("app.js", "if(window.__NORTH_SHELL_BUILD__!=='1036')", "if(window.__NORTH_SHELL_BUILD__!=='1037')", 1)
replace("app.js", f"const APP_VER='{old_title}';", f"const APP_VER='{new_title}';", 1)
replace("app.js", f"sw.js?v=1036&r={old_hotfix}", f"sw.js?v=1037&r={new_hotfix}", 1)

replace("小手机.html", "window.__NORTH_SHELL_BUILD__='1036'", "window.__NORTH_SHELL_BUILD__='1037'", 1)
replace("小手机.html", "north-sw-reloaded-1036", "north-sw-reloaded-1037", 1)
replace("小手机.html", f"sw.js?v=1036&r={old_hotfix}", f"sw.js?v=1037&r={new_hotfix}", 1)
replace("小手机.html", "?v=1036", "?v=1037", 10)

replace("index.html", "小手机.html?v=1036", "小手机.html?v=1037", 1)
replace("repair.html", "小手机.html?v=1036", "小手机.html?v=1037", 2)
replace("sw.js", "const BUILD='1036';", "const BUILD='1037';", 1)
replace("sw.js", f"const HOTFIX='{old_hotfix}';", f"const HOTFIX='{new_hotfix}';", 1)
replace("sw.js", "const SHELL_CACHE='north-shell-v1036';", "const SHELL_CACHE='north-shell-v1037';", 1)
replace(
    "native/private-small-phone/Resources/PhoneWebBundleInfo.plist",
    "<string>1036</string>",
    "<string>1037</string>",
    1,
)

replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift",
    "1.0.156 (156)",
    "1.0.157 (157)",
    1,
)
replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj",
    "CURRENT_PROJECT_VERSION = 156;",
    "CURRENT_PROJECT_VERSION = 157;",
    12,
)
replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj",
    "MARKETING_VERSION = 1.0.156;",
    "MARKETING_VERSION = 1.0.157;",
    12,
)

for test_path in sorted((ROOT / "tests").glob("*.test.mjs")):
    text = test_path.read_bytes().decode("utf-8")
    original = text
    text = text.replace(old_title, new_title)
    text = text.replace(old_hotfix, new_hotfix)
    text = text.replace("north-shell-v1036", "north-shell-v1037")
    text = text.replace("v1036", "v1037")
    text = text.replace("1036", "1037")
    text = text.replace("1\\.0\\.156", "1\\.0\\.157")
    text = text.replace("1.0.156", "1.0.157")
    text = text.replace("CURRENT_PROJECT_VERSION = 156", "CURRENT_PROJECT_VERSION = 157")
    text = text.replace("MARKETING_VERSION = 1.0.156", "MARKETING_VERSION = 1.0.157")
    text = text.replace("\\(156\\)", "\\(157\\)")
    text = text.replace("(156)", "(157)")
    if text != original:
        test_path.write_bytes(text.encode("utf-8"))

print("Updated web to v1037, private iOS to 1.0.157 (157), native bridge remains 25")
