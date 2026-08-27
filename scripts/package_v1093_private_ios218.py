"""Build the v1093 / private iOS 1.0.218 unified Mac source package."""

from pathlib import Path


template = Path(__file__).with_name("package_v1071_private_ios195.py").read_text(encoding="utf-8")
for old, new in [
    ("v1071", "v1093"),
    ("1071", "1093"),
    ("1.0.195", "1.0.218"),
    ("(195)", "(218)"),
    ("ios195", "ios218"),
    ("iOS195", "iOS218"),
    ("private195", "private218"),
    ("CompleteWeChatBundle", "WeChatLoginReturn"),
    (
        "第一百九十五次安装_v1093_私人App_完整微信Bundle_请先读.md",
        "第二百一十八次安装_v1093_微信登录退出回话修复_请先读.md",
    ),
    ("v1093 · 私人App完整微信Bundle修复版", "v1093 · 微信登录退出回话修复版"),
    ("CURRENT_PROJECT_VERSION = 195;", "CURRENT_PROJECT_VERSION = 218;"),
]:
    template = template.replace(old, new)
template = template.replace("if existing != [ZIP_PATH]:", "if existing and existing != [ZIP_PATH]:")
template = template.replace(
    '        "remoteControlRoleReaction",',
    '        "remoteControlRoleReaction",\n'
    '        "function wxLoginCompletionChannel",\n'
    '        "function wxLoginCompletionRepairPrompt",\n'
    '        "function wxLoginCompletionReplyValid",',
)
exec(compile(template, __file__, "exec"))
