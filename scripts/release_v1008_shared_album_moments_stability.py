from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def write_lf(target, text):
    with target.open("w", encoding="utf-8", newline="\n") as stream:
        stream.write(text)


def replace(path, old, new, expected=None):
    target = ROOT / path
    text = target.read_text(encoding="utf-8")
    count = text.count(old)
    if expected is not None and count != expected:
        raise RuntimeError(f"{path}: expected {expected} occurrences of {old!r}, found {count}")
    if count:
        write_lf(target, text.replace(old, new))
    return count


replace("app.js", "if(window.__NORTH_SHELL_BUILD__!=='1007')", "if(window.__NORTH_SHELL_BUILD__!=='1008')", 1)
replace(
    "app.js",
    "const APP_VER='v1007 · 后台收件、朋友圈上下文与内心格式修复';",
    "const APP_VER='v1008 · 共同相册、朋友圈回复与私人App稳定性修复';",
    1,
)
replace(
    "app.js",
    "sw.js?v=1007&r=v1007-background-inbox-moments-inner-1",
    "sw.js?v=1008&r=v1008-shared-album-moments-stability-1",
    1,
)

for path in ["小手机.html", "index.html", "repair.html"]:
    replace(path, "1007", "1008")
replace("小手机.html", "background-inbox-moments-inner-1", "shared-album-moments-stability-1", 2)

replace("sw.js", "const BUILD='1007';", "const BUILD='1008';", 1)
replace(
    "sw.js",
    "const HOTFIX='v1007-background-inbox-moments-inner-1';",
    "const HOTFIX='v1008-shared-album-moments-stability-1';",
    1,
)
replace("sw.js", "const SHELL_CACHE='north-shell-v1007';", "const SHELL_CACHE='north-shell-v1008';", 1)

replace(
    "native/private-small-phone/Resources/PhoneWebBundleInfo.plist",
    "<string>1007</string>",
    "<string>1008</string>",
    1,
)
replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift",
    "1.0.128 (128)",
    "1.0.129 (129)",
    1,
)
replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj",
    "CURRENT_PROJECT_VERSION = 128;",
    "CURRENT_PROJECT_VERSION = 129;",
    12,
)
replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj",
    "MARKETING_VERSION = 1.0.128;",
    "MARKETING_VERSION = 1.0.129;",
    12,
)

for test_path in sorted((ROOT / "tests").glob("*.test.mjs")):
    text = test_path.read_text(encoding="utf-8")
    original = text
    text = text.replace(
        "v1007 · 后台收件、朋友圈上下文与内心格式修复",
        "v1008 · 共同相册、朋友圈回复与私人App稳定性修复",
    )
    text = text.replace("v1007-background-inbox-moments-inner-1", "v1008-shared-album-moments-stability-1")
    text = text.replace("background-inbox-moments-inner-1", "shared-album-moments-stability-1")
    text = text.replace("north-shell-v1007", "north-shell-v1008")
    text = text.replace("v1007", "v1008")
    text = text.replace("1007", "1008")
    text = text.replace("1\\.0\\.128", "1\\.0\\.129")
    text = text.replace("1.0.128", "1.0.129")
    text = text.replace("CURRENT_PROJECT_VERSION = 128", "CURRENT_PROJECT_VERSION = 129")
    text = text.replace("\\(128\\)", "\\(129\\)")
    if text != original:
        write_lf(test_path, text)

print("Updated web v1008 and private iOS 1.0.129 (129) release identities")
