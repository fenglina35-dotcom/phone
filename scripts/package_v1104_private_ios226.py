"""Build the v1104 / private iOS 1.0.226 unified Mac source package."""

from pathlib import Path

template = Path(__file__).with_name("package_v1071_private_ios195.py").read_text(encoding="utf-8")
for old, new in [
    ("v1071", "v1104"), ("1071", "1104"), ("1.0.195", "1.0.226"), ("(195)", "(226)"),
    ("ios195", "ios226"), ("iOS195", "iOS226"), ("private195", "private226"),
    ("CompleteWeChatBundle", "RolePushOutputSafety"),
    ("第一百九十五次安装_v1104_私人App_完整微信Bundle_请先读.md", "第二百二十六次安装_v1104_后台主动消息安全_请先读.md"),
    ("v1104 · 私人App完整微信Bundle修复版", "v1104 · 后台主动消息安全版"),
    ("CURRENT_PROJECT_VERSION = 195;", "CURRENT_PROJECT_VERSION = 226;"),
]:
    template = template.replace(old, new)
template = template.replace("if existing != [ZIP_PATH]:", "if existing and existing != [ZIP_PATH]:")
template = template.replace(
    '        "remoteControlRoleReaction",',
    '        "remoteControlRoleReaction",\n'
    '        "roleServerPushUnsafeBody",\n'
    '        "function cohabCommitTripPlans",\n'
    '        "function musicKeepOriginalMediaBlob",\n'
    '        "function wechatSummarySystem",\n'
    '        "function callEndTombstoneWrite",\n'
    '        "function roleSocialCardPlan",\n'
    '        "添加图文照片",',
)
exec(compile(template, __file__, "exec"))
