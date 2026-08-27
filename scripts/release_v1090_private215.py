"""Bump the natural delivery commitment release to v1090 / iOS 1.0.215."""

from pathlib import Path
import re
import subprocess


ROOT = Path(__file__).resolve().parents[1]


def update_text(path: Path) -> bool:
    original = path.read_text(encoding="utf-8")
    updated = re.sub(r"(?<!\d)1089(?!\d)", "1090", original)
    for old, new in [
        ("v1090 · 群聊退出与关心进度修复版", "v1090 · 自然外卖承诺执行修复版"),
        ("v1090-group-leave-care-progress-1", "v1090-natural-delivery-commitment-1"),
        ("1.0.214 (214)", "1.0.215 (215)"),
        ("1.0.214（214）", "1.0.215（215）"),
        ("1.0.214", "1.0.215"),
        (r"1\.0\.214", r"1\.0\.215"),
        (r"1\.0\.215 \(214\)", r"1\.0\.215 \(215\)"),
        ("CURRENT_PROJECT_VERSION = 214;", "CURRENT_PROJECT_VERSION = 215;"),
        ("CURRENT_PROJECT_VERSION = 214", "CURRENT_PROJECT_VERSION = 215"),
        ("MARKETING_VERSION = 1.0.214;", "MARKETING_VERSION = 1.0.215;"),
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
for path in [
    ROOT / "native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj",
    ROOT / "native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift",
]:
    if update_text(path):
        changed.append(path)
print(f"Updated {len(changed)} versioned files")
