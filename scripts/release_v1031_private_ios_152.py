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


def replace_or_already(path, old, new, expected):
    target = ROOT / path
    text = target.read_bytes().decode("utf-8")
    old_count = text.count(old)
    new_count = text.count(new)
    if old_count == expected:
        target.write_bytes(text.replace(old, new).encode("utf-8"))
        return
    if old_count == 0 and new_count >= expected:
        return
    raise RuntimeError(
        f"{path}: expected {expected} old or new occurrences, "
        f"found old={old_count}, new={new_count}"
    )


replace_or_already(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift",
    "1.0.150 (150)",
    "1.0.152 (152)",
    1,
)
replace_or_already(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj",
    "CURRENT_PROJECT_VERSION = 150;",
    "CURRENT_PROJECT_VERSION = 152;",
    12,
)
replace_or_already(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj",
    "MARKETING_VERSION = 1.0.150;",
    "MARKETING_VERSION = 1.0.152;",
    12,
)

readme_path = "native/private-small-phone/XcodeProject/请在Mac编译前先读.md"
old_candidate = (
    "> 当前候选交付：网页 v1029；私人 iOS 1.0.150 (150)；原生桥 25。"
    "请使用本次第一百五十次安装说明，并打开全新 `SmallPhone_v1029_RealDeliveryWallet`，"
    "不要覆盖任何旧工程目录。"
)
new_candidate = (
    "> 当前候选交付：网页 v1031；私人 iOS 1.0.152 (152)；原生桥 25。"
    "请使用本次第一百五十二次安装说明，并打开全新 `SmallPhone_v1031_WeChatHome_iOS152`，"
    "不要覆盖任何旧工程目录。"
)
old_heading = "## v1029／1.0.150 真实外卖与角色钱包版"
new_heading = "## v1031／1.0.152 微信首页视觉升级版"
new_section = (
    new_heading + "\r\n\r\n"
    "- 包含 v1029 真实外卖与角色钱包基线，以及 v1031 微信首页的白天／夜间、固定磨砂顶栏、透视底栏和四个真实微信选中态。\r\n"
    "- 不包含另一工作区尚未合入的 v1030 支付回执闭环，也不覆盖用户保存的聊天、角色、外置语音配置或真实好友数据。\r\n"
    "- Windows 自动复核 934/934 通过；仍须在 Mac 编译签名，并用真实 iPhone 覆盖安装验证。\r\n\r\n"
    + old_heading
)
replace_or_already(readme_path, old_candidate, new_candidate, 1)
readme = (ROOT / readme_path).read_bytes().decode("utf-8")
if new_heading not in readme:
    if readme.count(old_heading) != 1:
        raise RuntimeError(f"{readme_path}: expected one legacy heading")
    (ROOT / readme_path).write_bytes(readme.replace(old_heading, new_section).encode("utf-8"))

for test_path in sorted((ROOT / "tests").glob("*.test.mjs")):
    text = test_path.read_bytes().decode("utf-8")
    original = text
    text = text.replace("1.0.150", "1.0.152")
    text = text.replace("1\\.0\\.150", "1\\.0\\.152")
    text = text.replace("\\(150\\)", "\\(152\\)")
    text = text.replace("CURRENT_PROJECT_VERSION = 150", "CURRENT_PROJECT_VERSION = 152")
    if text != original:
        test_path.write_bytes(text.encode("utf-8"))

print("Updated private iOS to 1.0.152 (152); web remains v1031")
