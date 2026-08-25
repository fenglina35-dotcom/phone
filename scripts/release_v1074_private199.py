"""Bump the storage, music-manifest, and web-battery repair to v1074 / iOS 1.0.199."""

from pathlib import Path
import re
import subprocess


ROOT = Path(__file__).resolve().parents[1]


def update_text(path: Path) -> bool:
    original = path.read_text(encoding="utf-8")
    updated = re.sub(r"(?<!\d)1073(?!\d)", "1074", original)
    for old, new in [
        ("v1074 · 形象工作室露脸修复版", "v1074 · 存档歌单与网页电量修复版"),
        ("v1074-role-image-visible-face-integration-1", "v1074-storage-music-battery-recovery-1"),
        ("1.0.198 (198)", "1.0.199 (199)"),
        ("1.0.198（198）", "1.0.199（199）"),
        ("1.0.198", "1.0.199"),
        (r"1\.0\.198", r"1\.0\.199"),
        ("CURRENT_PROJECT_VERSION = 198;", "CURRENT_PROJECT_VERSION = 199;"),
        ("MARKETING_VERSION = 1.0.198;", "MARKETING_VERSION = 1.0.199;"),
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
    ["git", "grep", "-l", "-E", r"v1073|1073|1\.0\.198|VERSION = 198", "--", "tests"],
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
