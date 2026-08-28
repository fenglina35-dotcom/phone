"""Bump the role image-frequency release to v1100 / private iOS 1.0.224."""

from pathlib import Path
import re
import subprocess


ROOT = Path(__file__).resolve().parents[1]


def update_text(path: Path) -> bool:
    original = path.read_text(encoding="utf-8")
    updated = re.sub(r"(?<!\d)1099(?!\d)", "1100", original)
    for old, new in [
        ("v1100 · 媒体总结通话稳定版", "v1100 · 图片频率与图文朋友圈版"),
        ("v1100-media-summary-call-stability-1", "v1100-role-photo-frequency-cards-1"),
        ("1.0.223 (223)", "1.0.224 (224)"),
        ("1.0.223（223）", "1.0.224（224）"),
        ("1.0.223", "1.0.224"),
        (r"1\.0\.223", r"1\.0\.224"),
        (r"1\.0\.224 \(223\)", r"1\.0\.224 \(224\)"),
        ("CURRENT_PROJECT_VERSION = 223;", "CURRENT_PROJECT_VERSION = 224;"),
        ("CURRENT_PROJECT_VERSION = 223", "CURRENT_PROJECT_VERSION = 224"),
        ("MARKETING_VERSION = 1.0.223;", "MARKETING_VERSION = 1.0.224;"),
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
