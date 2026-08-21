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


old_title = "v1031 · 微信首页视觉升级"
new_title = "v1032 · 微信聊天视觉升级"
old_hotfix = "v1031-wechat-home-1"
new_hotfix = "v1032-wechat-chat-1"

replace("app.js", "if(window.__NORTH_SHELL_BUILD__!=='1031')", "if(window.__NORTH_SHELL_BUILD__!=='1032')", 1)
replace("app.js", f"const APP_VER='{old_title}';", f"const APP_VER='{new_title}';", 1)
replace("app.js", f"sw.js?v=1031&r={old_hotfix}", f"sw.js?v=1032&r={new_hotfix}", 1)

replace("小手机.html", "window.__NORTH_SHELL_BUILD__='1031'", "window.__NORTH_SHELL_BUILD__='1032'", 1)
replace("小手机.html", "north-sw-reloaded-1031", "north-sw-reloaded-1032", 1)
replace("小手机.html", f"sw.js?v=1031&r={old_hotfix}", f"sw.js?v=1032&r={new_hotfix}", 1)
replace("小手机.html", "?v=1031", "?v=1032", 10)

replace("index.html", "小手机.html?v=1031", "小手机.html?v=1032", 1)
replace("repair.html", "小手机.html?v=1031", "小手机.html?v=1032", 2)
replace("sw.js", "const BUILD='1031';", "const BUILD='1032';", 1)
replace("sw.js", f"const HOTFIX='{old_hotfix}';", f"const HOTFIX='{new_hotfix}';", 1)
replace("sw.js", "const SHELL_CACHE='north-shell-v1031';", "const SHELL_CACHE='north-shell-v1032';", 1)
replace("native/private-small-phone/Resources/PhoneWebBundleInfo.plist", "<string>1031</string>", "<string>1032</string>", 1)

replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift",
    "1.0.152 (152)",
    "1.0.153 (153)",
    1,
)
replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj",
    "CURRENT_PROJECT_VERSION = 152;",
    "CURRENT_PROJECT_VERSION = 153;",
    12,
)
replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj",
    "MARKETING_VERSION = 1.0.152;",
    "MARKETING_VERSION = 1.0.153;",
    12,
)

for test_path in sorted((ROOT / "tests").glob("*.test.mjs")):
    text = test_path.read_bytes().decode("utf-8")
    original = text
    text = text.replace(old_title, new_title)
    text = text.replace(old_hotfix, new_hotfix)
    text = text.replace("north-shell-v1031", "north-shell-v1032")
    text = text.replace("v1031", "v1032")
    text = text.replace("1031", "1032")
    text = text.replace("1.0.152", "1.0.153")
    text = text.replace("1\\.0\\.152", "1\\.0\\.153")
    text = text.replace("\\(152\\)", "\\(153\\)")
    text = text.replace("CURRENT_PROJECT_VERSION = 152", "CURRENT_PROJECT_VERSION = 153")
    if text != original:
        test_path.write_bytes(text.encode("utf-8"))

print("Updated shared web to v1032 and private iOS to 1.0.153 (153); native bridge remains 25")
