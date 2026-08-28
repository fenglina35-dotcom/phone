"""Build the v1098 / private iOS 1.0.222 unified Mac source package."""

from pathlib import Path

template = Path(__file__).with_name("package_v1071_private_ios195.py").read_text(encoding="utf-8")
for old, new in [
    ("v1071", "v1098"), ("1071", "1098"), ("1.0.195", "1.0.222"), ("(195)", "(222)"),
    ("ios195", "ios222"), ("iOS195", "iOS222"), ("private195", "private222"),
    ("CompleteWeChatBundle", "CohabTwoPersonCloudJourney"),
    ("第一百九十五次安装_v1098_私人App_完整微信Bundle_请先读.md", "第二百二十二次安装_v1098_共同生活双人云程_请先读.md"),
    ("v1098 · 私人App完整微信Bundle修复版", "v1098 · 共同生活双人云程版"),
    ("CURRENT_PROJECT_VERSION = 195;", "CURRENT_PROJECT_VERSION = 222;"),
]:
    template = template.replace(old, new)
template = template.replace("if existing != [ZIP_PATH]:", "if existing and existing != [ZIP_PATH]:")
template = template.replace(
    '        "remoteControlRoleReaction",',
    '        "remoteControlRoleReaction",\n'
    '        "function cohabCommitTripPlans",\n'
    '        "function cohabTravelAdvance",\n'
    '        "function cohabTripContext",\n'
    '        "共同生活双人购票能力",',
)
exec(compile(template, __file__, "exec"))
