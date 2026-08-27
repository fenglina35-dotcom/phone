"""Bump the background unlock delivery repair to v1087 / iOS 1.0.212."""

from pathlib import Path
import re
import subprocess


ROOT = Path(__file__).resolve().parents[1]


def update_text(path: Path) -> bool:
    original = path.read_text(encoding="utf-8")
    updated = re.sub(r"(?<!\d)1086(?!\d)", "1087", original)
    for old, new in [
        ("v1087 · 私人App降载回退与图片引用修复版", "v1087 · 后台解锁去重与必达修复版"),
        ("v1087-private-performance-rollback-image-quote-1", "v1087-background-unlock-delivery-1"),
        ("1.0.211 (211)", "1.0.212 (212)"),
        ("1.0.211（211）", "1.0.212（212）"),
        ("1.0.211", "1.0.212"),
        (r"1\.0\.211", r"1\.0\.212"),
        (r"1\.0\.212 \(211\)", r"1\.0\.212 \(212\)"),
        ("CURRENT_PROJECT_VERSION = 211;", "CURRENT_PROJECT_VERSION = 212;"),
        ("CURRENT_PROJECT_VERSION = 211", "CURRENT_PROJECT_VERSION = 212"),
        ("MARKETING_VERSION = 1.0.211;", "MARKETING_VERSION = 1.0.212;"),
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
