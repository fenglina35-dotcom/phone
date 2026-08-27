"""Bump the sleep-source and limit-lock clarity release to v1084 / iOS 1.0.209."""

from pathlib import Path
import re
import subprocess


ROOT = Path(__file__).resolve().parents[1]


def update_text(path: Path) -> bool:
    original = path.read_text(encoding="utf-8")
    updated = re.sub(r"(?<!\d)1083(?!\d)", "1084", original)
    for old, new in [
        ("v1084 · 通话后台静默与挂断重计时版", "v1084 · 睡眠来源与限额锁标识版"),
        ("v1084-call-background-quiet-1", "v1084-sleep-limit-clarity-1"),
        ("1.0.208 (208)", "1.0.209 (209)"),
        ("1.0.208（208）", "1.0.209（209）"),
        ("1.0.208", "1.0.209"),
        (r"1\.0\.208", r"1\.0\.209"),
        (r"1\.0\.209 \(208\)", r"1\.0\.209 \(209\)"),
        ("CURRENT_PROJECT_VERSION = 208;", "CURRENT_PROJECT_VERSION = 209;"),
        ("CURRENT_PROJECT_VERSION = 208", "CURRENT_PROJECT_VERSION = 209"),
        ("MARKETING_VERSION = 1.0.208;", "MARKETING_VERSION = 1.0.209;"),
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
