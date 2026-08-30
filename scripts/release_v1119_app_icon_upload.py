"""Advance the synchronized web/private release to v1119 / iOS 1.0.240."""

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
    replace(path, "window.__NORTH_SHELL_BUILD__!=='1118'", "window.__NORTH_SHELL_BUILD__!=='1119'", 1)
    replace(path, "v1118 · 交互与角色锁定稳定版", "v1119 · 图标美化补全版", 1)
    replace(
        path,
        "sw.js?v=1118&r=v1118-interaction-role-lock-delivery-hotfix-2",
        "sw.js?v=1119&r=v1119-app-icon-upload-hotfix-1",
        1,
    )

replace("sw.js", "v1118-interaction-role-lock-delivery-hotfix-2", "v1119-app-icon-upload-hotfix-1", 1)
replace("sw.js", "north-shell-v1118-interaction-role-lock-delivery-2", "north-shell-v1119-app-icon-upload-1", 1)
replace("sw.js", "const BUILD='1118';", "const BUILD='1119';", 1)
replace(
    "小手机.html",
    "sw.js?v=1118&r=v1118-interaction-role-lock-delivery-hotfix-2",
    "sw.js?v=1119&r=v1119-app-icon-upload-hotfix-1",
    1,
)
replace("小手机.html", "window.__NORTH_SHELL_BUILD__='1118'", "window.__NORTH_SHELL_BUILD__='1119'", 1)
replace("小手机.html", "?v=1118", "?v=1119", 12)
replace("小手机.html", "north-sw-reloaded-1118", "north-sw-reloaded-1119", 1)
replace("index.html", "小手机.html?v=1118", "小手机.html?v=1119", 1)
replace("repair.html", "小手机.html?v=1118", "小手机.html?v=1119", 2)

for path in [
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html",
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/小手机.html",
]:
    replace(path, "window.__NORTH_SHELL_BUILD__='1118'", "window.__NORTH_SHELL_BUILD__='1119'", 1)
    replace(path, "?v=1118", "?v=1119", 13)
    replace(path, "north-sw-reloaded-1118", "north-sw-reloaded-1119", 1)

replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/Info.plist",
    "<string>1118</string>",
    "<string>1119</string>",
    1,
)
replace(
    "native/private-small-phone/Resources/PhoneWebBundleInfo.plist",
    "<string>1118</string>",
    "<string>1119</string>",
    1,
)
replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift",
    "1.0.239 (239)",
    "1.0.240 (240)",
    1,
)
replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj",
    "CURRENT_PROJECT_VERSION = 239;",
    "CURRENT_PROJECT_VERSION = 240;",
    12,
)
replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj",
    "MARKETING_VERSION = 1.0.239;",
    "MARKETING_VERSION = 1.0.240;",
    12,
)

for target in sorted((ROOT / "tests").glob("*.mjs")):
    text = target.read_text(encoding="utf-8")
    if "1118" not in text and "239" not in text:
        continue
    updated = (
        text.replace("v1118 · 交互与角色锁定稳定版", "v1119 · 图标美化补全版")
        .replace("v1118-interaction-role-lock-delivery-hotfix-2", "v1119-app-icon-upload-hotfix-1")
        .replace("north-shell-v1118-interaction-role-lock-delivery-2", "north-shell-v1119-app-icon-upload-1")
        .replace("north-shell-v1118", "north-shell-v1119")
        .replace("?v=1118", "?v=1119")
        .replace("reloaded-1118", "reloaded-1119")
        .replace("__NORTH_SHELL_BUILD__='1118'", "__NORTH_SHELL_BUILD__='1119'")
        .replace("BUILD='1118'", "BUILD='1119'")
        .replace("<string>1118", "<string>1119")
        .replace("v1118", "v1119")
        .replace("1.0.239", "1.0.240")
        .replace(r"1\.0\.239", r"1\.0\.240")
        .replace("VERSION = 239;", "VERSION = 240;")
        .replace("VERSION = 239", "VERSION = 240")
        .replace("(239)", "(240)")
        .replace(r"\(239\)", r"\(240\)")
    )
    if updated != text:
        target.write_text(updated, encoding="utf-8", newline="")

print("advanced synchronized release markers to v1119 / iOS 1.0.240")
