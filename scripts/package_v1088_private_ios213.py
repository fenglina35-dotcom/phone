"""Build the v1088 / private iOS 1.0.213 unified Mac source package."""

from pathlib import Path

template = Path(__file__).with_name("package_v1071_private_ios195.py").read_text(encoding="utf-8")
for old, new in [
    ("v1071", "v1088"), ("1071", "1088"), ("1.0.195", "1.0.213"), ("(195)", "(213)"),
    ("ios195", "ios213"), ("iOS195", "iOS213"), ("private195", "private213"),
    ("CompleteWeChatBundle", "ScreenTimeControlRollback"),
    ("第一百九十五次安装_v1088_私人App_完整微信Bundle_请先读.md", "第二百一十三次安装_v1088_抖音锁定与限额回退修复_请先读.md"),
    ("v1088 · 私人App完整微信Bundle修复版", "v1088 · 抖音锁定与限额回退修复版"),
    ("CURRENT_PROJECT_VERSION = 195;", "CURRENT_PROJECT_VERSION = 213;"),
]:
    template = template.replace(old, new)
template = template.replace("if existing != [ZIP_PATH]:", "if existing and existing != [ZIP_PATH]:")
template = template.replace(
    '"remoteControlRoleReaction",',
    '"remoteControlRoleReaction",\n        "function manualUnlockReplyFallback",\n        "function manualUnlockReplyGuard",\n        "roleServerPushHandoffAlreadyVisible(c,body,rowAt)",',
)
exec(compile(template, __file__, "exec"))
