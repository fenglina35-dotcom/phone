"""Build the v1092 / private iOS 1.0.217 unified Mac source package."""

from pathlib import Path


template = Path(__file__).with_name("package_v1071_private_ios195.py").read_text(encoding="utf-8")
for old, new in [
    ("v1071", "v1092"),
    ("1071", "1092"),
    ("1.0.195", "1.0.217"),
    ("(195)", "(217)"),
    ("ios195", "ios217"),
    ("iOS195", "iOS217"),
    ("private195", "private217"),
    ("CompleteWeChatBundle", "WeChatLoginPerformance"),
    (
        "第一百九十五次安装_v1092_私人App_完整微信Bundle_请先读.md",
        "第二百一十七次安装_v1092_微信登录回话与交互流畅修复_请先读.md",
    ),
    ("v1092 · 私人App完整微信Bundle修复版", "v1092 · 微信登录回话与交互流畅修复版"),
    ("CURRENT_PROJECT_VERSION = 195;", "CURRENT_PROJECT_VERSION = 217;"),
]:
    template = template.replace(old, new)
template = template.replace("if existing != [ZIP_PATH]:", "if existing and existing != [ZIP_PATH]:")
template = template.replace(
    '        "remoteControlRoleReaction",',
    '        "remoteControlRoleReaction",\n'
    '        "function wxLoginEnsureRequestedRemark",\n'
    '        "function wxLoginCompletionReplyValid",\n'
    '        "function quoteComposerRefresh",',
)
exec(compile(template, __file__, "exec"))
