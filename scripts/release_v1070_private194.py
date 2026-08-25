from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[1]


def replace_bytes(path: Path, replacements: list[tuple[bytes, bytes]]) -> None:
    original = path.read_bytes()
    updated = original
    for old, new in replacements:
        updated = updated.replace(old, new)
    if updated == original:
        raise RuntimeError(f"no version marker changed in {path}")
    path.write_bytes(updated)


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

test_result = subprocess.run(
    ["git", "grep", "-l", "-E", "v1069|1069|1\\.0\\.193|VERSION = 193", "--", "tests"],
    cwd=ROOT,
    check=True,
    capture_output=True,
    text=True,
    encoding="utf-8",
)
test_files = [ROOT / line for line in test_result.stdout.splitlines() if line]

for path in web_files + test_files:
    replace_bytes(
        path,
        [
            (b"1069", b"1070"),
            (
                "v1070 · 角色外卖续触发与私人稳定整合版".encode("utf-8"),
                "v1070 · 私人App WebContent恢复与内存边界版".encode("utf-8"),
            ),
            (b"1.0.193 (193)", b"1.0.194 (194)"),
            (b"1.0.193", b"1.0.194"),
            (b"1\\.0\\.193", b"1\\.0\\.194"),
            (b"CURRENT_PROJECT_VERSION = 193;", b"CURRENT_PROJECT_VERSION = 194;"),
            (b"MARKETING_VERSION = 1.0.193;", b"MARKETING_VERSION = 1.0.194;"),
        ],
    )

replace_bytes(
    ROOT / "native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj",
    [
        (b"CURRENT_PROJECT_VERSION = 193;", b"CURRENT_PROJECT_VERSION = 194;"),
        (b"MARKETING_VERSION = 1.0.193;", b"MARKETING_VERSION = 1.0.194;"),
    ],
)
replace_bytes(
    ROOT / "native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift",
    [(b"1.0.193 (193)", b"1.0.194 (194)")],
)

old_guide = ROOT / "native/private-small-phone/XcodeProject/第一百九十三次安装_v1069_私人App_WebContent恢复与内存边界_请先读.md"
new_guide = ROOT / "native/private-small-phone/XcodeProject/第一百九十四次安装_v1070_私人App_WebContent恢复与内存边界_请先读.md"
guide = old_guide.read_bytes()
for old, new in [
    ("第一百九十三".encode("utf-8"), "第一百九十四".encode("utf-8")),
    (b"1069", b"1070"),
    (b"1.0.193", b"1.0.194"),
    ("构建 193".encode("utf-8"), "构建 194".encode("utf-8")),
    ("仍显示 1.0.192".encode("utf-8"), "仍显示 1.0.193".encode("utf-8")),
]:
    guide = guide.replace(old, new)
new_guide.write_bytes(guide)

old_package = ROOT / "scripts/package_v1069_private_ios193.py"
new_package = ROOT / "scripts/package_v1070_private_ios194.py"
package = old_package.read_bytes()
for old, new in [
    (b"1069", b"1070"),
    (b"193", b"194"),
    ("第一百九十三".encode("utf-8"), "第一百九十四".encode("utf-8")),
]:
    package = package.replace(old, new)
new_package.write_bytes(package)

print(f"Updated {len(web_files)} current shell files and {len(test_files)} version tests")
print(f"Created {new_guide.relative_to(ROOT)}")
print(f"Created {new_package.relative_to(ROOT)}")
