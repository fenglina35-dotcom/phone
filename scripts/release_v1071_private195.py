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
    ["git", "grep", "-l", "-E", "v1070|1070|1\\.0\\.194|VERSION = 194", "--", "tests"],
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
            (b"1070", b"1071"),
            (
                "v1071 · 私人App WebContent恢复与内存边界版".encode("utf-8"),
                "v1071 · 私人App完整微信Bundle修复版".encode("utf-8"),
            ),
            (b"1\\.0\\.194 \\(194\\)", b"1\\.0\\.195 \\(195\\)"),
            (b"1.0.194 (194)", b"1.0.195 (195)"),
            (b"1.0.194", b"1.0.195"),
            (b"1\\.0\\.194", b"1\\.0\\.195"),
            (b"CURRENT_PROJECT_VERSION = 194;", b"CURRENT_PROJECT_VERSION = 195;"),
            (b"MARKETING_VERSION = 1.0.194;", b"MARKETING_VERSION = 1.0.195;"),
        ],
    )

replace_bytes(
    ROOT / "native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj",
    [
        (b"CURRENT_PROJECT_VERSION = 194;", b"CURRENT_PROJECT_VERSION = 195;"),
        (b"MARKETING_VERSION = 1.0.194;", b"MARKETING_VERSION = 1.0.195;"),
    ],
)
replace_bytes(
    ROOT / "native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift",
    [(b"1.0.194 (194)", b"1.0.195 (195)")],
)

old_guide = ROOT / "native/private-small-phone/XcodeProject/第一百九十四次安装_v1070_私人App_WebContent恢复与内存边界_请先读.md"
new_guide = ROOT / "native/private-small-phone/XcodeProject/第一百九十五次安装_v1071_私人App_完整微信Bundle_请先读.md"
guide = old_guide.read_bytes()
for old, new in [
    ("第一百九十四".encode("utf-8"), "第一百九十五".encode("utf-8")),
    (b"1070", b"1071"),
    (b"1.0.194", b"1.0.195"),
    ("构建 194".encode("utf-8"), "构建 195".encode("utf-8")),
    ("若仍显示 1.0.193".encode("utf-8"), "若仍显示 1.0.194".encode("utf-8")),
    ("本次只改私人 App 稳定性".encode("utf-8"), "本次修正私人 App 完整 Bundle 交付".encode("utf-8")),
]:
    guide = guide.replace(old, new)
new_guide.write_bytes(guide)

print(f"Updated {len(web_files)} current shell files and {len(test_files)} version tests")
print(f"Created {new_guide.relative_to(ROOT)}")
