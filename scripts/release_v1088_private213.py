"""Bump the Screen Time control rollback to v1088 / iOS 1.0.213."""

from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]

def update_text(path: Path) -> bool:
    original = path.read_text(encoding="utf-8")
    updated = re.sub(r"(?<!\d)1087(?!\d)", "1088", original)
    for old, new in [
        ("v1088 · 后台解锁去重与必达修复版", "v1088 · 抖音锁定与限额回退修复版"),
        ("v1088-background-unlock-delivery-1", "v1088-screen-time-control-rollback-1"),
        ("1.0.212 (212)", "1.0.213 (213)"),
        ("1.0.212（212）", "1.0.213（213）"),
        ("1.0.212", "1.0.213"),
        (r"1\.0\.212", r"1\.0\.213"),
        (r"1\.0\.213 \(212\)", r"1\.0\.213 \(213\)"),
        ("CURRENT_PROJECT_VERSION = 212;", "CURRENT_PROJECT_VERSION = 213;"),
        ("CURRENT_PROJECT_VERSION = 212", "CURRENT_PROJECT_VERSION = 213"),
        ("MARKETING_VERSION = 1.0.212;", "MARKETING_VERSION = 1.0.213;"),
    ]:
        updated = updated.replace(old, new)
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
