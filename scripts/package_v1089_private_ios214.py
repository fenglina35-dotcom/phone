"""Build the v1089 / private iOS 1.0.214 unified Mac source package."""

from pathlib import Path

template = Path(__file__).with_name("package_v1071_private_ios195.py").read_text(encoding="utf-8")
for old, new in [
    ("v1071", "v1089"), ("1071", "1089"), ("1.0.195", "1.0.214"), ("(195)", "(214)"),
    ("ios195", "ios214"), ("iOS195", "iOS214"), ("private195", "private214"),
    ("CompleteWeChatBundle", "GroupLeaveCareProgress"),
    ("第一百九十五次安装_v1089_私人App_完整微信Bundle_请先读.md", "第二百一十四次安装_v1089_群聊退出与关心进度修复_请先读.md"),
    ("v1089 · 私人App完整微信Bundle修复版", "v1089 · 群聊退出与关心进度修复版"),
    ("CURRENT_PROJECT_VERSION = 195;", "CURRENT_PROJECT_VERSION = 214;"),
]:
    template = template.replace(old, new)
template = template.replace("if existing != [ZIP_PATH]:", "if existing and existing != [ZIP_PATH]:")
template = template.replace(
    '"remoteControlRoleReaction",',
    '"remoteControlRoleReaction",\n        "function manualUnlockReplyFallback",\n        "roleServerPushHandoffAlreadyVisible(c,body,rowAt)",\n        "function recentMealProgressPrompt",\n        "phone_friend_group_leave",',
)
exec(compile(template, __file__, "exec"))
