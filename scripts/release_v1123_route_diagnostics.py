"""Advance the synchronized web/private release to v1123 / iOS 1.0.249."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def replace(path: str, old: str, new: str, expected: int | None = None) -> None:
    target = ROOT / path
    text = target.read_text(encoding="utf-8")
    count = text.count(old)
    if count == 0 and new in text:
        return
    if expected is not None and count != expected:
        raise RuntimeError(f"{path}: expected {expected} matches for {old!r}, found {count}")
    if count == 0:
        raise RuntimeError(f"{path}: missing release marker {old!r}")
    target.write_text(text.replace(old, new), encoding="utf-8", newline="")


replace("app.js", "window.__NORTH_SHELL_BUILD__!=='1122'", "window.__NORTH_SHELL_BUILD__!=='1123'", 1)
replace("app.js", "v1122 · 主屏唱片与网页云备份稳定版", "v1123 · 模型路线真实诊断版", 1)
replace(
    "app.js",
    "sw.js?v=1122&r=v1122-home-vinyl-web-backup-hotfix-1",
    "sw.js?v=1123&r=v1123-route-diagnostics-hotfix-1",
    1,
)
replace("app.js", "mp4box.all.js?v=1122&r=file-safe-1", "mp4box.all.js?v=1123&r=file-safe-1", 1)

for path in ["小手机.html", "index.html", "repair.html"]:
    replace(path, "1122", "1123")
replace("小手机.html", "sticker-avatar-login-hotfix-3", "route-diagnostics-hotfix-1", 1)
replace("小手机.html", "sticker-avatar-login-3", "route-diagnostics-1", 2)

replace("sw.js", "1122", "1123")
replace("sw.js", "sticker-avatar-login-hotfix-3", "route-diagnostics-hotfix-1", 1)
replace("sw.js", "sticker-avatar-login-3", "route-diagnostics-1", 3)
replace("web-hotfix.js", "1122", "1123")
replace("web-hotfix.js", "sticker-avatar-login-hotfix-3", "route-diagnostics-hotfix-1", 1)
replace("web-hotfix.js", "sticker-avatar-login-3", "route-diagnostics-1", 1)

private_shells = [
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html",
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/小手机.html",
]
for path in private_shells:
    replace(path, "1122", "1123")
    replace(path, "private-runtime-diagnostics.js?v=248", "private-runtime-diagnostics.js?v=249", 1)

replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/repair.html",
    "index.html?repair=1&v=1122",
    "index.html?repair=1&v=1123",
    1,
)
for path in [
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/Info.plist",
    "native/private-small-phone/Resources/PhoneWebBundleInfo.plist",
]:
    replace(path, "<string>1122</string>", "<string>1123</string>", 1)

replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift",
    'private static let build = "1.0.248 (248)"',
    'private static let build = "1.0.249 (249)"',
    1,
)
replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift",
    "1.0.248 (248)",
    "1.0.249 (249)",
    3,
)
replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift",
    "smallPhone.webContentTerminationTimes.v4.build248",
    "smallPhone.webContentTerminationTimes.v4.build249",
    1,
)
replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj",
    "CURRENT_PROJECT_VERSION = 248;",
    "CURRENT_PROJECT_VERSION = 249;",
    12,
)
replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj",
    "MARKETING_VERSION = 1.0.248;",
    "MARKETING_VERSION = 1.0.249;",
    12,
)

private_app = ROOT / "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js"
private_text = private_app.read_text(encoding="utf-8")
for required in [
    "v1123 · 模型路线真实诊断版",
    "function apiRawErrorDetail",
    "function roleChatDiagnosticOpen",
    "function emergencyRestorePreview",
    "function recoveryRollbackState",
]:
    if required not in private_text:
        raise RuntimeError(f"private app is missing required independent marker: {required}")

for target in sorted((ROOT / "tests").glob("*.mjs")):
    text = target.read_text(encoding="utf-8")
    updated = (
        text.replace("v1122 · 主屏唱片与网页云备份稳定版", "v1123 · 模型路线真实诊断版")
        .replace("v1122-sticker-avatar-login-hotfix-3", "v1123-route-diagnostics-hotfix-1")
        .replace("v1122-sticker-avatar-login-3", "v1123-route-diagnostics-1")
        .replace("north-shell-v1122-sticker-avatar-login-3", "north-shell-v1123-route-diagnostics-1")
        .replace("north-shell-v1122", "north-shell-v1123")
        .replace("?v=1122", "?v=1123")
        .replace("reloaded-1122", "reloaded-1123")
        .replace("__NORTH_SHELL_BUILD__='1122'", "__NORTH_SHELL_BUILD__='1123'")
        .replace("BUILD='1122'", "BUILD='1123'")
        .replace("<string>1122", "<string>1123")
        .replace("v1122", "v1123")
        .replace("sticker-avatar-login-hotfix-3", "route-diagnostics-hotfix-1")
        .replace("sticker-avatar-login-3", "route-diagnostics-1")
        .replace("smallPhone.webContentTerminationTimes.v4.build248", "smallPhone.webContentTerminationTimes.v4.build249")
        .replace(r"smallPhone\.webContentTerminationTimes\.v4\.build248", r"smallPhone\.webContentTerminationTimes\.v4\.build249")
        .replace("1.0.248", "1.0.249")
        .replace(r"1\.0\.248", r"1\.0\.249")
        .replace("VERSION = 248;", "VERSION = 249;")
        .replace("VERSION = 248", "VERSION = 249")
        .replace("(248)", "(249)")
        .replace(r"\(248\)", r"\(249\)")
    )
    if updated != text:
        target.write_text(updated, encoding="utf-8", newline="")

package_source = (ROOT / "scripts/package_v1122_private_ios248.py").read_text(encoding="utf-8")
package_updated = (
    package_source
    .replace("v1122_private_ios248", "v1123_private_ios249")
    .replace("第二百四十八次安装_v1122_私人App宿主隔离与存档恢复_请先读.md", "第二百四十九次安装_v1123_模型路线真实诊断_请先读.md")
    .replace("delivery-v1122-private248-host-isolation-recovery", "delivery-v1123-private249-route-diagnostics-final")
    .replace("SmallPhone_v1122_PrivateHostIsolationRecovery_iOS248_MacReady", "SmallPhone_v1123_ModelRouteDiagnostics_iOS249_MacReady")
    .replace("小手机_v1122_私人版_iOS248_宿主隔离与存档恢复.zip", "小手机_v1123_私人版_iOS249_模型路线真实诊断_最终完整包.zip")
    .replace("smallphone-v1122-ios248-", "smallphone-v1123-ios249-")
    .replace("web=v1122", "web=v1123")
    .replace("ios=1.0.248 (248)", "ios=1.0.249 (249)")
    .replace("'1122'", "'1123'")
    .replace("?v=1122", "?v=1123")
        .replace("v1122 · 主屏唱片与网页云备份稳定版", "v1123 · 模型路线真实诊断版")
        .replace("v1123-home-vinyl-web-backup-hotfix-1", "v1123-route-diagnostics-hotfix-1")
    .replace("CURRENT_PROJECT_VERSION = 248;", "CURRENT_PROJECT_VERSION = 249;")
    .replace("MARKETING_VERSION = 1.0.248;", "MARKETING_VERSION = 1.0.249;")
    .replace("build 248", "build 249")
    .replace("build 247", "build 248")
    .replace("version 1.0.247", "version 1.0.248")
    .replace("1.0.248 (248)", "1.0.249 (249)")
    .replace("build248", "build249")
    .replace('private static let build = "1.0.248 (248)"', 'private static let build = "1.0.249 (249)"')
    .replace("private iOS 248", "private iOS 249")
)
# The package template contains quoted repair and diagnostics tokens that are
# intentionally updated independently of the generic build replacements.
package_updated = (
    package_updated
    .replace("private-runtime-diagnostics.js?v=248", "private-runtime-diagnostics.js?v=249")
    .replace("index.html?repair=1&v=1122", "index.html?repair=1&v=1123")
    .replace("private repair page does not return to v1122", "private repair page does not return to v1123")
    .replace('CURRENT_PROJECT_VERSION = 247;', 'CURRENT_PROJECT_VERSION = 248;')
    .replace('MARKETING_VERSION = 1.0.247;', 'MARKETING_VERSION = 1.0.248;')
    .replace("private version 1.0.248 is not set consistently", "private version 1.0.249 is not set consistently")
    .replace(
        '        "function aiCoreUrl",\n',
        '        "function aiCoreUrl",\n'
        '        "function apiRawErrorDetail",\n'
        '        "function roleChatDiagnosticOpen",\n'
        '        "模型与路线诊断",\n'
        '        "立即备份当前网页版",\n'
        '        "homeVinylColor",\n',
    )
)
(ROOT / "scripts/package_v1123_private_ios249.py").write_text(package_updated, encoding="utf-8", newline="\n")

print("advanced synchronized release markers to v1123 / iOS 1.0.249")
