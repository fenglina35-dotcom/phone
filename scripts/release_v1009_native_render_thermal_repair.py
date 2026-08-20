from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read_utf8_exact(target):
    return target.read_bytes().decode("utf-8")


def write_utf8_exact(target, text):
    target.write_bytes(text.encode("utf-8"))


def replace(path, old, new, expected=None):
    target = ROOT / path
    text = read_utf8_exact(target)
    count = text.count(old)
    if expected is not None and count != expected:
        raise RuntimeError(
            f"{path}: expected {expected} occurrences of {old!r}, found {count}"
        )
    if count:
        write_utf8_exact(target, text.replace(old, new))
    return count


replace(
    "app.js",
    "if(window.__NORTH_SHELL_BUILD__!=='1008')",
    "if(window.__NORTH_SHELL_BUILD__!=='1009')",
    1,
)
replace(
    "app.js",
    "const APP_VER='v1008 · 共同相册、朋友圈回复与私人App稳定性修复';",
    "const APP_VER='v1009 · 私人App点击渲染与发热修复';",
    1,
)
replace(
    "app.js",
    "sw.js?v=1008&r=v1008-shared-album-moments-stability-1",
    "sw.js?v=1009&r=v1009-native-render-thermal-repair-1",
    1,
)

replace(
    "小手机.html",
    "window.__NORTH_SHELL_BUILD__='1008'",
    "window.__NORTH_SHELL_BUILD__='1009'",
    1,
)
replace("小手机.html", "north-sw-reloaded-1008", "north-sw-reloaded-1009", 1)
replace(
    "小手机.html",
    "sw.js?v=1008&r=v1008-shared-album-moments-stability-1",
    "sw.js?v=1009&r=v1009-native-render-thermal-repair-1",
    1,
)
replace(
    "小手机.html",
    "glass-theme.css?v=1008&r=shared-album-moments-stability-1",
    "glass-theme.css?v=1009&r=native-render-thermal-repair-1",
    1,
)
replace("小手机.html", "?v=1008", "?v=1009", 8)
replace("index.html", "小手机.html?v=1008", "小手机.html?v=1009", 1)
replace("repair.html", "小手机.html?v=1008", "小手机.html?v=1009", 2)

replace("sw.js", "const BUILD='1008';", "const BUILD='1009';", 1)
replace(
    "sw.js",
    "const HOTFIX='v1008-shared-album-moments-stability-1';",
    "const HOTFIX='v1009-native-render-thermal-repair-1';",
    1,
)
replace(
    "sw.js",
    "const SHELL_CACHE='north-shell-v1008';",
    "const SHELL_CACHE='north-shell-v1009';",
    1,
)

replace(
    "native/private-small-phone/Resources/PhoneWebBundleInfo.plist",
    "<string>1008</string>",
    "<string>1009</string>",
    1,
)
replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift",
    "1.0.129 (129)",
    "1.0.130 (130)",
    1,
)
replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj",
    "CURRENT_PROJECT_VERSION = 129;",
    "CURRENT_PROJECT_VERSION = 130;",
    12,
)
replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj",
    "MARKETING_VERSION = 1.0.129;",
    "MARKETING_VERSION = 1.0.130;",
    12,
)

for test_path in sorted((ROOT / "tests").glob("*.test.mjs")):
    text = read_utf8_exact(test_path)
    original = text
    text = text.replace(
        "v1008 · 共同相册、朋友圈回复与私人App稳定性修复",
        "v1009 · 私人App点击渲染与发热修复",
    )
    text = text.replace(
        "v1008-shared-album-moments-stability-1",
        "v1009-native-render-thermal-repair-1",
    )
    text = text.replace(
        "shared-album-moments-stability-1",
        "native-render-thermal-repair-1",
    )
    text = text.replace("north-shell-v1008", "north-shell-v1009")
    text = text.replace("v1008", "v1009")
    text = text.replace("?v=1008", "?v=1009")
    text = text.replace("BUILD='1008'", "BUILD='1009'")
    text = text.replace("__NORTH_SHELL_BUILD__='1008'", "__NORTH_SHELL_BUILD__='1009'")
    text = text.replace("<string>1008", "<string>1009")
    text = text.replace("north-sw-reloaded-1008", "north-sw-reloaded-1009")
    text = text.replace("1\\.0\\.129", "1\\.0\\.130")
    text = text.replace("1.0.129", "1.0.130")
    text = text.replace(
        "CURRENT_PROJECT_VERSION = 129",
        "CURRENT_PROJECT_VERSION = 130",
    )
    text = text.replace("\\(129\\)", "\\(130\\)")
    if text != original:
        write_utf8_exact(test_path, text)

print("Updated web v1009 and private iOS 1.0.130 (130) release identities")
