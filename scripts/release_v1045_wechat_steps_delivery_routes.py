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


old_title = "v1044 · 远控字幕与外卖风控降扰修复版"
new_title = "v1045 · 微信运动与外卖精准直达整合版"
old_hotfix = "v1044-remote-delivery-safety-1"
new_hotfix = "v1045-wechat-steps-delivery-routes-1"

replace("app.js", "if(window.__NORTH_SHELL_BUILD__!=='1044')", "if(window.__NORTH_SHELL_BUILD__!=='1045')", 1)
replace("app.js", f"const APP_VER='{old_title}';", f"const APP_VER='{new_title}';", 1)
replace("app.js", f"sw.js?v=1044&r={old_hotfix}", f"sw.js?v=1045&r={new_hotfix}", 1)

target = ROOT / "小手机.html"
text = target.read_bytes().decode("utf-8")
for old, new in [
    ("window.__NORTH_SHELL_BUILD__='1044'", "window.__NORTH_SHELL_BUILD__='1045'"),
    ("north-sw-reloaded-1044", "north-sw-reloaded-1045"),
    ("sw.js?v=1044", "sw.js?v=1045"),
    ("?v=1044", "?v=1045"),
    (f"r={old_hotfix}", f"r={new_hotfix}"),
]:
    text = text.replace(old, new)
target.write_bytes(text.encode("utf-8"))

replace("index.html", "小手机.html?v=1044", "小手机.html?v=1045", 1)
replace("repair.html", "小手机.html?v=1044", "小手机.html?v=1045", 2)
replace("sw.js", "const BUILD='1044';", "const BUILD='1045';", 1)
replace("sw.js", f"const HOTFIX='{old_hotfix}';", f"const HOTFIX='{new_hotfix}';", 1)
replace("sw.js", "const SHELL_CACHE='north-shell-v1044';", "const SHELL_CACHE='north-shell-v1045';", 1)
replace("native/private-small-phone/Resources/PhoneWebBundleInfo.plist", "<string>1044</string>", "<string>1045</string>", 1)
replace("native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift", "1.0.164 (164)", "1.0.165 (165)", 1)
replace("native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj", "CURRENT_PROJECT_VERSION = 164;", "CURRENT_PROJECT_VERSION = 165;", 12)
replace("native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj", "MARKETING_VERSION = 1.0.164;", "MARKETING_VERSION = 1.0.165;", 12)

for test_path in sorted((ROOT / "tests").glob("*.test.mjs")):
    text = test_path.read_bytes().decode("utf-8")
    original = text
    for old, new in [
        (old_title, new_title), (old_hotfix, new_hotfix),
        ("north-shell-v1044", "north-shell-v1045"),
        ("north-sw-reloaded-1044", "north-sw-reloaded-1045"),
        ("v1044", "v1045"), ("?v=1044", "?v=1045"),
        ("BUILD='1044'", "BUILD='1045'"),
        ("__NORTH_SHELL_BUILD__='1044'", "__NORTH_SHELL_BUILD__='1045'"),
        ("<string>1044", "<string>1045"),
        ("1\\.0\\.164", "1\\.0\\.165"), ("1.0.164", "1.0.165"),
        ("CURRENT_PROJECT_VERSION = 164", "CURRENT_PROJECT_VERSION = 165"),
        ("MARKETING_VERSION = 1.0.164", "MARKETING_VERSION = 1.0.165"),
        ("\\(164\\)", "\\(165\\)"), ("(164)", "(165)"),
    ]:
        text = text.replace(old, new)
    if text != original:
        test_path.write_bytes(text.encode("utf-8"))

subprocess.run(
    ["node", str(ROOT / "native/private-small-phone/scripts/stage-private-phone-web.mjs")],
    cwd=ROOT,
    check=True,
)

bundle = ROOT / "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle"
checks = {
    "app.js": ["renderWxSteps", "callApplyBackdrop", "callReplayCanvasImage", "off-date-nav"],
    "delivery.js": ["PREF_CONFIG", "saved_routes", "shop_closed", "全部打烊或休息中"],
    "wechat-me.js": ["FAMILY PRIVILEGE", "wxfamily-spend"],
}
for relative, required_tokens in checks.items():
    body = (bundle / relative).read_text(encoding="utf-8")
    for token in required_tokens:
        if token not in body:
            raise RuntimeError(f"private bundle missing v1045 feature {token!r} in {relative}")

print("Updated web v1045 and private iOS 1.0.165 (165); native bridge remains 25")
