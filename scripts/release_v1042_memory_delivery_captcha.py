from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[1]


def replace(path, old, new, expected=None):
    target = ROOT / path
    text = target.read_bytes().decode("utf-8")
    count = text.count(old)
    if count == 0 and expected is not None and text.count(new) == expected:
        return
    if expected is not None and count != expected:
        raise RuntimeError(f"{path}: expected {expected} occurrences of {old!r}, found {count}")
    target.write_bytes(text.replace(old, new).encode("utf-8"))


old_title = "v1041 · 微信引用、视频兼容与游戏返回修复版"
new_title = "v1042 · 跨场景记忆与外卖验证续跑修复版"
old_hotfix = "v1041-quote-video-game-1"
new_hotfix = "v1042-memory-delivery-captcha-1"

for path in ["app.js", "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js"]:
    replace(path, "if(window.__NORTH_SHELL_BUILD__!=='1041')", "if(window.__NORTH_SHELL_BUILD__!=='1042')", 1)
    replace(path, f"const APP_VER='{old_title}';", f"const APP_VER='{new_title}';", 1)
    replace(path, f"sw.js?v=1041&r={old_hotfix}", f"sw.js?v=1042&r={new_hotfix}", 1)

for path in [
    "小手机.html",
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html",
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/小手机.html",
]:
    target = ROOT / path
    text = target.read_bytes().decode("utf-8")
    text = text.replace("window.__NORTH_SHELL_BUILD__='1041'", "window.__NORTH_SHELL_BUILD__='1042'")
    text = text.replace("north-sw-reloaded-1041", "north-sw-reloaded-1042")
    text = text.replace("sw.js?v=1041", "sw.js?v=1042")
    text = text.replace("?v=1041", "?v=1042")
    text = text.replace(f"r={old_hotfix}", f"r={new_hotfix}")
    target.write_bytes(text.encode("utf-8"))

replace("index.html", "小手机.html?v=1041", "小手机.html?v=1042", 1)
replace("repair.html", "小手机.html?v=1041", "小手机.html?v=1042", 2)
replace("sw.js", "const BUILD='1041';", "const BUILD='1042';", 1)
replace("sw.js", f"const HOTFIX='{old_hotfix}';", f"const HOTFIX='{new_hotfix}';", 1)
replace("sw.js", "const SHELL_CACHE='north-shell-v1041';", "const SHELL_CACHE='north-shell-v1042';", 1)
replace("native/private-small-phone/Resources/PhoneWebBundleInfo.plist", "<string>1041</string>", "<string>1042</string>", 1)
replace("native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/Info.plist", "<string>1041</string>", "<string>1042</string>", 1)
replace("native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift", "1.0.160 (160)", "1.0.161 (161)", 1)
replace("native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj", "CURRENT_PROJECT_VERSION = 160;", "CURRENT_PROJECT_VERSION = 161;", 12)
replace("native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj", "MARKETING_VERSION = 1.0.160;", "MARKETING_VERSION = 1.0.161;", 12)

for test_path in sorted((ROOT / "tests").glob("*.test.mjs")):
    text = test_path.read_bytes().decode("utf-8")
    original = text
    text = text.replace(old_title, new_title)
    text = text.replace(old_hotfix, new_hotfix)
    text = text.replace("north-shell-v1041", "north-shell-v1042")
    text = text.replace("north-sw-reloaded-1041", "north-sw-reloaded-1042")
    text = text.replace("v1041", "v1042")
    text = text.replace("?v=1041", "?v=1042")
    text = text.replace("BUILD='1041'", "BUILD='1042'")
    text = text.replace("__NORTH_SHELL_BUILD__='1041'", "__NORTH_SHELL_BUILD__='1042'")
    text = text.replace("<string>1041", "<string>1042")
    text = text.replace("1\\.0\\.160", "1\\.0\\.161")
    text = text.replace("1.0.160", "1.0.161")
    text = text.replace("CURRENT_PROJECT_VERSION = 160", "CURRENT_PROJECT_VERSION = 161")
    text = text.replace("MARKETING_VERSION = 1.0.160", "MARKETING_VERSION = 1.0.161")
    text = text.replace("\\(160\\)", "\\(161\\)")
    text = text.replace("(160)", "(161)")
    if text != original:
        test_path.write_bytes(text.encode("utf-8"))

subprocess.run(
    ["node", str(ROOT / "native" / "private-small-phone" / "scripts" / "stage-private-phone-web.mjs")],
    cwd=ROOT,
    check=True,
)

print("Updated web v1042 and private iOS 1.0.161 (161); native bridge remains 25")
