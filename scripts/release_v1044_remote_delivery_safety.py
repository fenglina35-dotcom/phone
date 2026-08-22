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


old_title = "v1043 · 微信小号搜索与外卖低验证直达修复版"
new_title = "v1044 · 远控字幕与外卖风控降扰修复版"
old_hotfix = "v1043-wechat-delivery-route-1"
new_hotfix = "v1044-remote-delivery-safety-1"

replace("app.js", "if(window.__NORTH_SHELL_BUILD__!=='1043')", "if(window.__NORTH_SHELL_BUILD__!=='1044')", 1)
replace("app.js", f"const APP_VER='{old_title}';", f"const APP_VER='{new_title}';", 1)
replace("app.js", f"sw.js?v=1043&r={old_hotfix}", f"sw.js?v=1044&r={new_hotfix}", 1)

for path in ["小手机.html"]:
    target = ROOT / path
    text = target.read_bytes().decode("utf-8")
    text = text.replace("window.__NORTH_SHELL_BUILD__='1043'", "window.__NORTH_SHELL_BUILD__='1044'")
    text = text.replace("north-sw-reloaded-1043", "north-sw-reloaded-1044")
    text = text.replace("sw.js?v=1043", "sw.js?v=1044")
    text = text.replace("?v=1043", "?v=1044")
    text = text.replace(f"r={old_hotfix}", f"r={new_hotfix}")
    target.write_bytes(text.encode("utf-8"))

replace("index.html", "小手机.html?v=1043", "小手机.html?v=1044", 1)
replace("repair.html", "小手机.html?v=1043", "小手机.html?v=1044", 2)
replace("sw.js", "const BUILD='1043';", "const BUILD='1044';", 1)
replace("sw.js", f"const HOTFIX='{old_hotfix}';", f"const HOTFIX='{new_hotfix}';", 1)
replace("sw.js", "const SHELL_CACHE='north-shell-v1043';", "const SHELL_CACHE='north-shell-v1044';", 1)
replace("native/private-small-phone/Resources/PhoneWebBundleInfo.plist", "<string>1043</string>", "<string>1044</string>", 1)
replace("native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift", "1.0.162 (162)", "1.0.164 (164)", 1)
replace("native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj", "CURRENT_PROJECT_VERSION = 162;", "CURRENT_PROJECT_VERSION = 164;", 12)
replace("native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj", "MARKETING_VERSION = 1.0.162;", "MARKETING_VERSION = 1.0.164;", 12)

for test_path in sorted((ROOT / "tests").glob("*.test.mjs")):
    text = test_path.read_bytes().decode("utf-8")
    original = text
    text = text.replace(old_title, new_title)
    text = text.replace(old_hotfix, new_hotfix)
    text = text.replace("north-shell-v1043", "north-shell-v1044")
    text = text.replace("north-sw-reloaded-1043", "north-sw-reloaded-1044")
    text = text.replace("v1043", "v1044")
    text = text.replace("?v=1043", "?v=1044")
    text = text.replace("BUILD='1043'", "BUILD='1044'")
    text = text.replace("__NORTH_SHELL_BUILD__='1043'", "__NORTH_SHELL_BUILD__='1044'")
    text = text.replace("<string>1043", "<string>1044")
    text = text.replace("1\\.0\\.162", "1\\.0\\.164")
    text = text.replace("1.0.162", "1.0.164")
    text = text.replace("CURRENT_PROJECT_VERSION = 162", "CURRENT_PROJECT_VERSION = 164")
    text = text.replace("MARKETING_VERSION = 1.0.162", "MARKETING_VERSION = 1.0.164")
    text = text.replace("\\(162\\)", "\\(164\\)")
    text = text.replace("(162)", "(164)")
    if text != original:
        test_path.write_bytes(text.encode("utf-8"))

subprocess.run(
    ["node", str(ROOT / "native" / "private-small-phone" / "scripts" / "stage-private-phone-web.mjs")],
    cwd=ROOT,
    check=True,
)

bundle_app = (ROOT / "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js").read_text(encoding="utf-8")
for required in ["remoteControlEnsureRoleCaption", "remoteControlRoleEvidence", "roleSpokenCount", "nfRoleSearchMatches"]:
    if required not in bundle_app:
        raise RuntimeError(f"private bundle missing v1044 repair: {required}")

bundle_delivery = (ROOT / "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/delivery.js").read_text(encoding="utf-8")
for required in ["roleSystemNotice", "lastRoleNotice", "真实订单不存在"]:
    if required not in bundle_delivery:
        raise RuntimeError(f"private bundle missing v1044 delivery repair: {required}")

print("Updated web v1044 and private iOS 1.0.164 (164); native bridge remains 25")
