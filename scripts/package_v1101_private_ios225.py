"""Build the v1101 / private iOS 1.0.225 unified Mac source package."""

from pathlib import Path

template = Path(__file__).with_name("package_v1071_private_ios195.py").read_text(encoding="utf-8")
for old, new in [
    ("v1071", "v1101"), ("1071", "1101"), ("1.0.195", "1.0.225"), ("(195)", "(225)"),
    ("ios195", "ios225"), ("iOS195", "iOS225"), ("private195", "private225"),
    ("CompleteWeChatBundle", "RealDeliveryMultiItemSpec"),
    ("第一百九十五次安装_v1101_私人App_完整微信Bundle_请先读.md", "第二百二十五次安装_v1101_外卖多商品规格安全_请先读.md"),
    ("v1101 · 私人App完整微信Bundle修复版", "v1101 · 外卖多商品规格安全版"),
    ("CURRENT_PROJECT_VERSION = 195;", "CURRENT_PROJECT_VERSION = 225;"),
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
