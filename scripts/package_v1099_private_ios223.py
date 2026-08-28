"""Build the v1099 / private iOS 1.0.223 unified Mac source package."""

from pathlib import Path

template = Path(__file__).with_name("package_v1071_private_ios195.py").read_text(encoding="utf-8")
for old, new in [
    ("v1071", "v1099"), ("1071", "1099"), ("1.0.195", "1.0.223"), ("(195)", "(223)"),
    ("ios195", "ios223"), ("iOS195", "iOS223"), ("private195", "private223"),
    ("CompleteWeChatBundle", "MediaSummaryCallStability"),
    ("第一百九十五次安装_v1099_私人App_完整微信Bundle_请先读.md", "第二百二十三次安装_v1099_媒体总结通话稳定_请先读.md"),
    ("v1099 · 私人App完整微信Bundle修复版", "v1099 · 媒体总结通话稳定版"),
    ("CURRENT_PROJECT_VERSION = 195;", "CURRENT_PROJECT_VERSION = 223;"),
]:
    template = template.replace(old, new)
template = template.replace("if existing != [ZIP_PATH]:", "if existing and existing != [ZIP_PATH]:")
template = template.replace(
    '        "remoteControlRoleReaction",',
    '        "remoteControlRoleReaction",\n'
    '        "function cohabCommitTripPlans",\n'
    '        "function musicKeepOriginalMediaBlob",\n'
    '        "function wechatSummarySystem",\n'
    '        "function callEndTombstoneWrite",',
)
exec(compile(template, __file__, "exec"))
