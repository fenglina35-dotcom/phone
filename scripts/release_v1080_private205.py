"""Bump the real-delivery role acknowledgement release to v1080 / iOS 1.0.205."""

from pathlib import Path
import re
import subprocess


ROOT = Path(__file__).resolve().parents[1]


def update_text(path: Path) -> bool:
    original = path.read_text(encoding="utf-8")
    updated = re.sub(r"(?<!\d)1079(?!\d)", "1080", original)
    for old, new in [
        ("v1080 · 图文照片卡与吃货豆红包修复版", "v1080 · 外卖角色回执真实性修复版"),
        ("v1080-photo-text-card-points-coupon-1", "v1080-real-delivery-role-ack-1"),
        ("1.0.204 (204)", "1.0.205 (205)"),
        ("1.0.204（204）", "1.0.205（205）"),
        ("1.0.204", "1.0.205"),
        (r"1\.0\.204", r"1\.0\.205"),
        (r"1\.0\.205 \(204\)", r"1\.0\.205 \(205\)"),
        ("CURRENT_PROJECT_VERSION = 204;", "CURRENT_PROJECT_VERSION = 205;"),
        ("CURRENT_PROJECT_VERSION = 204", "CURRENT_PROJECT_VERSION = 205"),
        ("MARKETING_VERSION = 1.0.204;", "MARKETING_VERSION = 1.0.205;"),
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
    ["git", "ls-files", "-z", "--", "tests/*.test.mjs"],
    cwd=ROOT,
    check=True,
    capture_output=True,
)
test_files = [ROOT / raw.decode("utf-8") for raw in result.stdout.split(b"\0") if raw]
changed = [path for path in web_files + test_files if update_text(path)]

project = ROOT / "native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj"
webview = ROOT / "native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift"
for path in [project, webview]:
    if update_text(path):
        changed.append(path)

print(f"Updated {len(changed)} versioned files")
