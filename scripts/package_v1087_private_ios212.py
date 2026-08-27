"""Build the v1087 / private iOS 1.0.212 unified Mac source package."""

from pathlib import Path


template = Path(__file__).with_name("package_v1071_private_ios195.py").read_text(encoding="utf-8")
for old, new in [
    ("v1071", "v1087"),
    ("1071", "1087"),
    ("1.0.195", "1.0.212"),
    ("(195)", "(212)"),
    ("ios195", "ios212"),
    ("iOS195", "iOS212"),
    ("private195", "private212"),
    ("CompleteWeChatBundle", "BackgroundUnlockDelivery"),
    ("第一百九十五次安装_v1087_私人App_完整微信Bundle_请先读.md", "第二百一十二次安装_v1087_后台解锁去重与必达修复_请先读.md"),
    ("v1087 · 私人App完整微信Bundle修复版", "v1087 · 后台解锁去重与必达修复版"),
    ("CURRENT_PROJECT_VERSION = 195;", "CURRENT_PROJECT_VERSION = 212;"),
]:
    template = template.replace(old, new)

template = template.replace("if existing != [ZIP_PATH]:", "if existing and existing != [ZIP_PATH]:")
template = template.replace(
    '"remoteControlRoleReaction",',
    '"remoteControlRoleReaction",\n        "function manualUnlockReplyFallback",\n        "function manualUnlockReplyGuard",\n        "roleServerPushHandoffAlreadyVisible(c,body,rowAt)",',
)
exec(compile(template, __file__, "exec"))
