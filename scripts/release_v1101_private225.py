"""Bump the real-delivery multi-item specification release to v1101 / private iOS 1.0.225."""

from pathlib import Path
import re
import subprocess


ROOT = Path(__file__).resolve().parents[1]


def update_text(path: Path) -> bool:
    original = path.read_text(encoding="utf-8")
    updated = original
    for old, new in [
        ("v1100", "v1101"),
        ("?v=1100", "?v=1101"),
        ("BUILD='1100'", "BUILD='1101'"),
        ("BUILD__='1100'", "BUILD__='1101'"),
        ("<string>1100</string>", "<string>1101</string>"),
        ("north-shell-v1100", "north-shell-v1101"),
        ("north-sw-reloaded-1100", "north-sw-reloaded-1101"),
        ("v1101 · 图片频率与图文朋友圈版", "v1101 · 外卖多商品规格安全版"),
        ("v1101-role-photo-frequency-cards-1", "v1101-real-delivery-multi-item-spec-1"),
        ("1.0.224 (224)", "1.0.225 (225)"),
        ("1.0.224（224）", "1.0.225（225）"),
        ("1.0.224", "1.0.225"),
        (r"1\.0\.224", r"1\.0\.225"),
        (r"1\.0\.225 \(224\)", r"1\.0\.225 \(225\)"),
        ("CURRENT_PROJECT_VERSION = 224;", "CURRENT_PROJECT_VERSION = 225;"),
        ("CURRENT_PROJECT_VERSION = 224", "CURRENT_PROJECT_VERSION = 225"),
        ("MARKETING_VERSION = 1.0.224;", "MARKETING_VERSION = 1.0.225;"),
    ]:
        updated = updated.replace(old, new)
    # Release numbers can equal legitimate timing, token-budget, or fixture
    # values. Keep those business constants byte-for-byte stable.
    for accidental, original_value in [
        ("}, 1101);}}", "}, 1100);}}"),
        ("{max:1101,aux:true}", "{max:1100,aux:true}"),
        ("Math.max(1101,Math.min(nar?", "Math.max(1100,Math.min(nar?"),
        ("await sleep(1101);continue;", "await sleep(1100);continue;"),
        ("),1101);else setTimeout", "),1100);else setTimeout"),
        ("Math.min(1101,520+", "Math.min(1100,520+"),
        ("}],{max:1101});", "}],{max:1100});"),
        ("await sleep(1101);if(!remoteControlActive()", "await sleep(1100);if(!remoteControlActive()"),
        ("setTimeout(r,1101))", "setTimeout(r,1100))"),
        ("points: 1101", "points: 1100"),
        ("balance: 1101", "balance: 1100"),
    ]:
        updated = updated.replace(accidental, original_value)
    if updated == original:
        return False
    path.write_text(updated, encoding="utf-8", newline="")
    return True


web_files = [
    ROOT / "app.js", ROOT / "index.html", ROOT / "repair.html", ROOT / "sw.js", ROOT / "小手机.html",
    ROOT / "native/private-small-phone/Resources/PhoneWebBundleInfo.plist",
    ROOT / "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js",
    ROOT / "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html",
    ROOT / "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/Info.plist",
    ROOT / "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/小手机.html",
]
result = subprocess.run(["git", "ls-files", "-z", "--", "tests/*.test.mjs"], cwd=ROOT, check=True, capture_output=True)
test_files = [ROOT / raw.decode("utf-8") for raw in result.stdout.split(b"\0") if raw]
changed = [path for path in web_files + test_files if update_text(path)]
for path in [
    ROOT / "native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj",
    ROOT / "native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift",
]:
    if update_text(path):
        changed.append(path)
print(f"Updated {len(changed)} versioned files")
