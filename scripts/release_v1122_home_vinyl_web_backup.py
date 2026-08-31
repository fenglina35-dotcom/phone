"""Advance the synchronized web/private release to v1122 / iOS 1.0.243."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def replace(path: str, old: str, new: str, expected: int | None = None) -> None:
    target = ROOT / path
    text = target.read_text(encoding="utf-8")
    count = text.count(old)
    if expected is not None and count != expected:
        raise RuntimeError(f"{path}: expected {expected} matches for {old!r}, found {count}")
    if count == 0:
        raise RuntimeError(f"{path}: missing release marker {old!r}")
    target.write_text(text.replace(old, new), encoding="utf-8", newline="")


for path in [
    "app.js",
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js",
]:
    replace(path, "window.__NORTH_SHELL_BUILD__!=='1121'", "window.__NORTH_SHELL_BUILD__!=='1122'", 1)
    replace(path, "v1121 · 云状态可信显示版", "v1122 · 主屏唱片与网页云备份稳定版", 1)
    replace(
        path,
        "sw.js?v=1121&r=v1121-cloud-status-reliability-hotfix-1",
        "sw.js?v=1122&r=v1122-home-vinyl-web-backup-hotfix-1",
        1,
    )
    replace(path, "mp4box.all.js?v=1121&r=file-safe-1", "mp4box.all.js?v=1122&r=file-safe-1", 1)

replace("sw.js", "v1121-cloud-status-reliability-hotfix-1", "v1122-home-vinyl-web-backup-hotfix-1", 1)
replace("sw.js", "north-shell-v1121-cloud-status-reliability-1", "north-shell-v1122-home-vinyl-web-backup-1", 1)
replace("sw.js", "const BUILD='1121';", "const BUILD='1122';", 1)
replace(
    "小手机.html",
    "sw.js?v=1121&r=v1121-cloud-status-reliability-hotfix-1",
    "sw.js?v=1122&r=v1122-home-vinyl-web-backup-hotfix-1",
    1,
)
replace("小手机.html", "window.__NORTH_SHELL_BUILD__='1121'", "window.__NORTH_SHELL_BUILD__='1122'", 1)
replace("小手机.html", "?v=1121", "?v=1122", 12)
replace("小手机.html", "north-sw-reloaded-1121", "north-sw-reloaded-1122", 1)
replace("index.html", "小手机.html?v=1121", "小手机.html?v=1122", 1)
replace("repair.html", "小手机.html?v=1121", "小手机.html?v=1122", 2)

for path in [
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html",
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/小手机.html",
]:
    replace(path, "window.__NORTH_SHELL_BUILD__='1121'", "window.__NORTH_SHELL_BUILD__='1122'", 1)
    replace(path, "?v=1121", "?v=1122", 13)
    replace(path, "north-sw-reloaded-1121", "north-sw-reloaded-1122", 1)

replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/Info.plist",
    "<string>1121</string>",
    "<string>1122</string>",
    1,
)
replace(
    "native/private-small-phone/Resources/PhoneWebBundleInfo.plist",
    "<string>1121</string>",
    "<string>1122</string>",
    1,
)
replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift",
    "1.0.242 (242)",
    "1.0.243 (243)",
    1,
)
replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj",
    "CURRENT_PROJECT_VERSION = 242;",
    "CURRENT_PROJECT_VERSION = 243;",
    12,
)
replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj",
    "MARKETING_VERSION = 1.0.242;",
    "MARKETING_VERSION = 1.0.243;",
    12,
)

for target in sorted((ROOT / "tests").glob("*.mjs")):
    text = target.read_text(encoding="utf-8")
    if "1121" not in text and "242" not in text:
        continue
    updated = (
        text.replace("v1121 · 云状态可信显示版", "v1122 · 主屏唱片与网页云备份稳定版")
        .replace("v1121-cloud-status-reliability-hotfix-1", "v1122-home-vinyl-web-backup-hotfix-1")
        .replace("north-shell-v1121-cloud-status-reliability-1", "north-shell-v1122-home-vinyl-web-backup-1")
        .replace("north-shell-v1121", "north-shell-v1122")
        .replace("?v=1121", "?v=1122")
        .replace("reloaded-1121", "reloaded-1122")
        .replace("__NORTH_SHELL_BUILD__='1121'", "__NORTH_SHELL_BUILD__='1122'")
        .replace("BUILD='1121'", "BUILD='1122'")
        .replace("<string>1121", "<string>1122")
        .replace("v1121", "v1122")
        .replace("1.0.242", "1.0.243")
        .replace(r"1\.0\.242", r"1\.0\.243")
        .replace("VERSION = 242;", "VERSION = 243;")
        .replace("VERSION = 242", "VERSION = 243")
        .replace("(242)", "(243)")
        .replace(r"\(242\)", r"\(243\)")
    )
    if updated != text:
        target.write_text(updated, encoding="utf-8", newline="")

print("advanced synchronized release markers to v1122 / iOS 1.0.243")
