"""Build the v1095 / private iOS 1.0.220 unified Mac source package."""

from pathlib import Path

template = Path(__file__).with_name("package_v1071_private_ios195.py").read_text(encoding="utf-8")
for old, new in [
    ("v1071", "v1095"), ("1071", "1095"), ("1.0.195", "1.0.220"), ("(195)", "(220)"),
    ("ios195", "ios220"), ("iOS195", "iOS220"), ("private195", "private220"),
    ("CompleteWeChatBundle", "WechatLogoutReliableReturn"),
    ("第一百九十五次安装_v1095_私人App_完整微信Bundle_请先读.md", "第二百二十次安装_v1095_微信退出回话可靠交付_请先读.md"),
    ("v1095 · 私人App完整微信Bundle修复版", "v1095 · 微信退出回话可靠交付版"),
    ("CURRENT_PROJECT_VERSION = 195;", "CURRENT_PROJECT_VERSION = 220;"),
]:
    template = template.replace(old, new)
template = template.replace("if existing != [ZIP_PATH]:", "if existing and existing != [ZIP_PATH]:")
template = template.replace(
    '        "remoteControlRoleReaction",',
    '        "remoteControlRoleReaction",\n'
    '        "function wxLoginCompletionVisibleContent",\n'
    '        "const _wxLoginCompletion=wxLoginCompletionFeature(note)",',
)
exec(compile(template, __file__, "exec"))
