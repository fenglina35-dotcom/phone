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


old_title = "v1053 · 外卖偏好与真实图片修正版"
new_title = "v1054 · 外卖授权与流程稳定修正版"
old_hotfix = "v1053-delivery-preferences-image-1"
new_hotfix = "v1054-delivery-task-stability-1"

replace("app.js", "if(window.__NORTH_SHELL_BUILD__!=='1053')", "if(window.__NORTH_SHELL_BUILD__!=='1054')", 1)
replace("app.js", f"const APP_VER='{old_title}';", f"const APP_VER='{new_title}';", 1)
replace("app.js", f"sw.js?v=1053&r={old_hotfix}", f"sw.js?v=1054&r={new_hotfix}", 1)

target = ROOT / "小手机.html"
text = target.read_bytes().decode("utf-8")
for old, new in [
    ("window.__NORTH_SHELL_BUILD__='1053'", "window.__NORTH_SHELL_BUILD__='1054'"),
    ("north-sw-reloaded-1053", "north-sw-reloaded-1054"),
    ("sw.js?v=1053", "sw.js?v=1054"),
    ("?v=1053", "?v=1054"),
    (f"r={old_hotfix}", f"r={new_hotfix}"),
]:
    text = text.replace(old, new)
target.write_bytes(text.encode("utf-8"))

replace("index.html", "小手机.html?v=1053", "小手机.html?v=1054", 1)
replace("repair.html", "小手机.html?v=1053", "小手机.html?v=1054", 2)
replace("sw.js", "const BUILD='1053';", "const BUILD='1054';", 1)
replace("sw.js", f"const HOTFIX='{old_hotfix}';", f"const HOTFIX='{new_hotfix}';", 1)
replace("sw.js", "const SHELL_CACHE='north-shell-v1053';", "const SHELL_CACHE='north-shell-v1054';", 1)
replace("native/private-small-phone/Resources/PhoneWebBundleInfo.plist", "<string>1053</string>", "<string>1054</string>", 1)
replace("native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift", "1.0.176 (176)", "1.0.177 (177)", 1)
replace("native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj", "CURRENT_PROJECT_VERSION = 176;", "CURRENT_PROJECT_VERSION = 177;", 12)
replace("native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj", "MARKETING_VERSION = 1.0.176;", "MARKETING_VERSION = 1.0.177;", 12)

for test_path in sorted((ROOT / "tests").glob("*.test.mjs")):
    body = test_path.read_bytes().decode("utf-8")
    original = body
    for old, new in [
        (old_title, new_title),
        (old_hotfix, new_hotfix),
        ("north-shell-v1053", "north-shell-v1054"),
        ("north-sw-reloaded-1053", "north-sw-reloaded-1054"),
        ("v1053", "v1054"),
        ("?v=1053", "?v=1054"),
        ("BUILD='1053'", "BUILD='1054'"),
        ("__NORTH_SHELL_BUILD__='1053'", "__NORTH_SHELL_BUILD__='1054'"),
        ("<string>1053", "<string>1054"),
        ("1\\.0\\.176", "1\\.0\\.177"),
        ("1.0.176", "1.0.177"),
        ("CURRENT_PROJECT_VERSION = 176", "CURRENT_PROJECT_VERSION = 177"),
        ("MARKETING_VERSION = 1.0.176", "MARKETING_VERSION = 1.0.177"),
        ("\\(176\\)", "\\(177\\)"),
        ("(176)", "(177)"),
    ]:
        body = body.replace(old, new)
    if body != original:
        test_path.write_bytes(body.encode("utf-8"))

node = Path(r"C:\Users\pc\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe")
subprocess.run(
    [str(node), str(ROOT / "native/private-small-phone/scripts/stage-private-phone-web.mjs")],
    cwd=ROOT,
    check=True,
)

bundle = ROOT / "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle"
checks = {
    "app.js": [new_title, "PRIVATE_MIRROR_MODE='private-primary'", "remoteControlRoleReaction"],
    "delivery.js": ["roleRequestIntent", "roleRequest", "realSearch", "createOrder", "requestRoleClarification", "roleTasks"],
    "小手机.html": ["window.__NORTH_SHELL_BUILD__='1054'", "delivery.js?v=1054"],
}
for relative, required_tokens in checks.items():
    body = (bundle / relative).read_text(encoding="utf-8")
    for token in required_tokens:
        if token not in body:
            raise RuntimeError(f"private bundle missing v1054 feature {token!r} in {relative}")

print("Updated web v1054 and private iOS 1.0.177 (177); native bridge remains 25")
