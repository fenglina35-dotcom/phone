"""Build the v1100 / private iOS 1.0.224 unified Mac source package."""

from pathlib import Path

template = Path(__file__).with_name("package_v1071_private_ios195.py").read_text(encoding="utf-8")
for old, new in [
    ("v1071", "v1100"), ("1071", "1100"), ("1.0.195", "1.0.224"), ("(195)", "(224)"),
    ("ios195", "ios224"), ("iOS195", "iOS224"), ("private195", "private224"),
    ("CompleteWeChatBundle", "RolePhotoFrequencyCards"),
    ("第一百九十五次安装_v1100_私人App_完整微信Bundle_请先读.md", "第二百二十四次安装_v1100_图片频率图文朋友圈_请先读.md"),
    ("v1100 · 私人App完整微信Bundle修复版", "v1100 · 图片频率与图文朋友圈版"),
    ("CURRENT_PROJECT_VERSION = 195;", "CURRENT_PROJECT_VERSION = 224;"),
]:
    template = template.replace(old, new)
template = template.replace("if existing != [ZIP_PATH]:", "if existing and existing != [ZIP_PATH]:")
template = template.replace(
    '        "remoteControlRoleReaction",',
    '        "remoteControlRoleReaction",\n'
    '        "function cohabCommitTripPlans",\n'
    '        "function musicKeepOriginalMediaBlob",\n'
    '        "function wechatSummarySystem",\n'
    '        "function callEndTombstoneWrite",\n'
    '        "function roleSocialCardPlan",\n'
    '        "function roleSocialMedia",\n'
    '        "添加图文照片",',
)
exec(compile(template, __file__, "exec"))
