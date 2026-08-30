"""Advance the synchronized web/private release to v1118 / iOS 1.0.239."""

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
    replace(path, "window.__NORTH_SHELL_BUILD__!=='1117'", "window.__NORTH_SHELL_BUILD__!=='1118'", 1)
    replace(path, "v1117 · 输出与存储稳定版", "v1118 · 交互与角色锁定稳定版", 1)
    replace(
        path,
        "sw.js?v=1117&r=v1117-home-mood-wedding-social-hotfix-3",
        "sw.js?v=1118&r=v1118-interaction-role-lock-delivery-hotfix-1",
        1,
    )

replace(
    "sw.js",
    "v1117-home-mood-wedding-social-hotfix-3",
    "v1118-interaction-role-lock-delivery-hotfix-1",
    1,
)
replace(
    "sw.js",
    "north-shell-v1117-home-mood-wedding-social-3",
    "north-shell-v1118-interaction-role-lock-delivery-1",
    1,
)
replace("sw.js", "const BUILD='1117';", "const BUILD='1118';", 1)
replace(
    "小手机.html",
    "sw.js?v=1117&r=v1117-home-mood-wedding-social-hotfix-3",
    "sw.js?v=1118&r=v1118-interaction-role-lock-delivery-hotfix-1",
    1,
)
replace("小手机.html", "window.__NORTH_SHELL_BUILD__='1117'", "window.__NORTH_SHELL_BUILD__='1118'", 1)
replace("小手机.html", "?v=1117", "?v=1118", 12)
replace("小手机.html", "north-sw-reloaded-1117", "north-sw-reloaded-1118", 1)
replace("index.html", "小手机.html?v=1117", "小手机.html?v=1118", 1)
replace("repair.html", "小手机.html?v=1117", "小手机.html?v=1118", 2)

for path in [
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html",
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/小手机.html",
]:
    replace(path, "window.__NORTH_SHELL_BUILD__='1117'", "window.__NORTH_SHELL_BUILD__='1118'", 1)
    replace(path, "?v=1117", "?v=1118", 13)
    replace(path, "north-sw-reloaded-1117", "north-sw-reloaded-1118", 1)

replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/Info.plist",
    "<string>1117</string>",
    "<string>1118</string>",
    1,
)
replace(
    "native/private-small-phone/Resources/PhoneWebBundleInfo.plist",
    "<string>1117</string>",
    "<string>1118</string>",
    1,
)
replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift",
    "1.0.238 (238)",
    "1.0.239 (239)",
    1,
)
replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj",
    "CURRENT_PROJECT_VERSION = 238;",
    "CURRENT_PROJECT_VERSION = 239;",
    12,
)
replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj",
    "MARKETING_VERSION = 1.0.238;",
    "MARKETING_VERSION = 1.0.239;",
    12,
)

for target in sorted((ROOT / "tests").glob("*.mjs")):
    text = target.read_text(encoding="utf-8")
    if "1117" not in text and "238" not in text:
        continue
    updated = (
        text.replace("v1117 · 输出与存储稳定版", "v1118 · 交互与角色锁定稳定版")
        .replace("v1117-home-mood-wedding-social-hotfix-3", "v1118-interaction-role-lock-delivery-hotfix-1")
        .replace("north-shell-v1117-home-mood-wedding-social-3", "north-shell-v1118-interaction-role-lock-delivery-1")
        .replace("north-shell-v1117", "north-shell-v1118")
        .replace("?v=1117", "?v=1118")
        .replace("reloaded-1117", "reloaded-1118")
        .replace("__NORTH_SHELL_BUILD__='1117'", "__NORTH_SHELL_BUILD__='1118'")
        .replace("BUILD='1117'", "BUILD='1118'")
        .replace("<string>1117", "<string>1118")
        .replace("v1117", "v1118")
        .replace("1.0.238", "1.0.239")
        .replace(r"1\.0\.238", r"1\.0\.239")
        .replace("VERSION = 238;", "VERSION = 239;")
        .replace("(238)", "(239)")
        .replace(r"\(238\)", r"\(239\)")
    )
    if updated != text:
        target.write_text(updated, encoding="utf-8", newline="")

print("advanced synchronized release markers to v1118 / iOS 1.0.239")
