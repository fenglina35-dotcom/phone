from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def replace(path, old, new, expected=None):
    target = ROOT / path
    text = target.read_bytes().decode("utf-8")
    count = text.count(old)
    if expected is not None and count != expected:
        raise RuntimeError(
            f"{path}: expected {expected} occurrences of {old!r}, found {count}"
        )
    if count:
        target.write_bytes(text.replace(old, new).encode("utf-8"))


replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift",
    "1.0.153 (153)",
    "1.0.154 (154)",
    1,
)
replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj",
    "CURRENT_PROJECT_VERSION = 153;",
    "CURRENT_PROJECT_VERSION = 154;",
    12,
)
replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj",
    "MARKETING_VERSION = 1.0.153;",
    "MARKETING_VERSION = 1.0.154;",
    12,
)

for test_path in sorted((ROOT / "tests").glob("*.test.mjs")):
    text = test_path.read_bytes().decode("utf-8")
    original = text
    text = text.replace("1\\.0\\.153", "1\\.0\\.154")
    text = text.replace("1.0.153", "1.0.154")
    text = text.replace("CURRENT_PROJECT_VERSION = 153", "CURRENT_PROJECT_VERSION = 154")
    text = text.replace("MARKETING_VERSION = 1.0.153", "MARKETING_VERSION = 1.0.154")
    text = text.replace("\\(153\\)", "\\(154\\)")
    text = text.replace("(153)", "(154)")
    if text != original:
        test_path.write_bytes(text.encode("utf-8"))

print("Updated private iOS to 1.0.154 (154); web remains v1033 and native bridge remains 25")
