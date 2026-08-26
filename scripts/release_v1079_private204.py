"""Bump the photo-card and points-coupon release to v1079 / iOS 1.0.204."""

from pathlib import Path
import re
import subprocess


ROOT = Path(__file__).resolve().parents[1]


def update_text(path: Path) -> bool:
    original = path.read_text(encoding="utf-8")
    updated = re.sub(r"(?<!\d)1078(?!\d)", "1079", original)
    for old, new in [
        ("v1079 · 时间约会记忆与真人聊天修复版", "v1079 · 图文照片卡与吃货豆红包修复版"),
        ("v1079-time-date-memory-phone-friend-1", "v1079-photo-text-card-points-coupon-1"),
        ("1.0.203 (203)", "1.0.204 (204)"),
        ("1.0.203（203）", "1.0.204（204）"),
        ("1.0.203", "1.0.204"),
        (r"1\.0\.203", r"1\.0\.204"),
        ("CURRENT_PROJECT_VERSION = 203;", "CURRENT_PROJECT_VERSION = 204;"),
        ("MARKETING_VERSION = 1.0.203;", "MARKETING_VERSION = 1.0.204;"),
    ]:
        updated = updated.replace(old, new)
    if updated == original:
        return False
    path.write_text(updated, encoding="utf-8", newline="")
    return True


web_files = [
    ROOT / "app.js",
    ROOT / "index.html",
    ROOT / "repair.html",
    ROOT / "sw.js",
    ROOT / "小手机.html",
    ROOT / "native/private-small-phone/Resources/PhoneWebBundleInfo.plist",
    ROOT / "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js",
    ROOT / "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html",
    ROOT / "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/Info.plist",
    ROOT / "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/小手机.html",
]

result = subprocess.run(
    ["git", "grep", "-l", "-E", r"v1078|1078", "--", "tests"],
    cwd=ROOT,
    check=True,
    capture_output=True,
    text=True,
    encoding="utf-8",
)
test_files = [ROOT / line for line in result.stdout.splitlines() if line]
changed = [path for path in web_files + test_files if update_text(path)]

project = ROOT / "native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj"
webview = ROOT / "native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift"
for path in [project, webview]:
    if update_text(path):
        changed.append(path)

print(f"Updated {len(changed)} versioned files")
