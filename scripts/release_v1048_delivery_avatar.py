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


old_title = "v1047 · 微信绿色操作控件修正版"
new_title = "v1048 · 外卖换店与聊天头像同步版"
old_hotfix = "v1047-wechat-green-controls-1"
new_hotfix = "v1048-delivery-avatar-sync-1"

replace("app.js", "if(window.__NORTH_SHELL_BUILD__!=='1047')", "if(window.__NORTH_SHELL_BUILD__!=='1048')", 1)
replace("app.js", f"const APP_VER='{old_title}';", f"const APP_VER='{new_title}';", 1)
replace("app.js", f"sw.js?v=1047&r={old_hotfix}", f"sw.js?v=1048&r={new_hotfix}", 1)

target = ROOT / "小手机.html"
text = target.read_bytes().decode("utf-8")
for old, new in [
    ("window.__NORTH_SHELL_BUILD__='1047'", "window.__NORTH_SHELL_BUILD__='1048'"),
    ("north-sw-reloaded-1047", "north-sw-reloaded-1048"),
    ("sw.js?v=1047", "sw.js?v=1048"),
    ("?v=1047", "?v=1048"),
    (f"r={old_hotfix}", f"r={new_hotfix}"),
]:
    text = text.replace(old, new)
target.write_bytes(text.encode("utf-8"))

replace("index.html", "小手机.html?v=1047", "小手机.html?v=1048", 1)
replace("repair.html", "小手机.html?v=1047", "小手机.html?v=1048", 2)
replace("sw.js", "const BUILD='1047';", "const BUILD='1048';", 1)
replace("sw.js", f"const HOTFIX='{old_hotfix}';", f"const HOTFIX='{new_hotfix}';", 1)
replace("sw.js", "const SHELL_CACHE='north-shell-v1047';", "const SHELL_CACHE='north-shell-v1048';", 1)
replace("native/private-small-phone/Resources/PhoneWebBundleInfo.plist", "<string>1045</string>", "<string>1048</string>", 1)
replace("native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift", "1.0.165 (165)", "1.0.166 (166)", 1)
replace("native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj", "CURRENT_PROJECT_VERSION = 165;", "CURRENT_PROJECT_VERSION = 166;", 12)
replace("native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj", "MARKETING_VERSION = 1.0.165;", "MARKETING_VERSION = 1.0.166;", 12)

for test_path in sorted((ROOT / "tests").glob("*.test.mjs")):
    text = test_path.read_bytes().decode("utf-8")
    original = text
    for old, new in [
        (old_title, new_title), (old_hotfix, new_hotfix),
        ("north-shell-v1047", "north-shell-v1048"),
        ("north-sw-reloaded-1047", "north-sw-reloaded-1048"),
        ("v1047", "v1048"), ("?v=1047", "?v=1048"),
        ("BUILD='1047'", "BUILD='1048'"),
        ("__NORTH_SHELL_BUILD__='1047'", "__NORTH_SHELL_BUILD__='1048'"),
        ("<string>1045", "<string>1048"),
        ("1\\.0\\.165", "1\\.0\\.166"), ("1.0.165", "1.0.166"),
        ("CURRENT_PROJECT_VERSION = 165", "CURRENT_PROJECT_VERSION = 166"),
        ("MARKETING_VERSION = 1.0.165", "MARKETING_VERSION = 1.0.166"),
        ("\\(165\\)", "\\(166\\)"), ("(165)", "(166)"),
    ]:
        text = text.replace(old, new)
    if text != original:
        test_path.write_bytes(text.encode("utf-8"))

node = Path(r"C:\Users\pc\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe")
subprocess.run(
    [str(node), str(ROOT / "native/private-small-phone/scripts/stage-private-phone-web.mjs")],
    cwd=ROOT,
    check=True,
)

bundle = ROOT / "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle"
checks = {
    "app.js": [new_title, "renderWxSteps", "remoteControlRoleReaction", "off-date-nav"],
    "delivery.js": ["PREF_CONFIG", "roleGlobalSearch", "allowGlobalSearch", "最多检查三家匹配门店"],
    "小手机.html": ["align-items:center", "width:42px;height:42px", "window.__NORTH_SHELL_BUILD__='1048'"],
}
for relative, required_tokens in checks.items():
    body = (bundle / relative).read_text(encoding="utf-8")
    for token in required_tokens:
        if token not in body:
            raise RuntimeError(f"private bundle missing v1048 feature {token!r} in {relative}")

print("Updated web v1048 and private iOS 1.0.166 (166); native bridge remains 25")
