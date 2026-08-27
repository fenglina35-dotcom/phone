"""Build the v1086 / private iOS 1.0.211 unified Mac source package."""

from pathlib import Path


template = Path(__file__).with_name("package_v1071_private_ios195.py").read_text(encoding="utf-8")
for old, new in [
    ("v1071", "v1086"),
    ("1071", "1086"),
    ("1.0.195", "1.0.211"),
    ("(195)", "(211)"),
    ("ios195", "ios211"),
    ("iOS195", "iOS211"),
    ("private195", "private211"),
    ("CompleteWeChatBundle", "PerformanceRollbackImageQuote"),
    ("第一百九十五次安装_v1086_私人App_完整微信Bundle_请先读.md", "第二百一十一次安装_v1086_降载回退与图片引用修复_请先读.md"),
    ("v1086 · 私人App完整微信Bundle修复版", "v1086 · 私人App降载回退与图片引用修复版"),
    ("CURRENT_PROJECT_VERSION = 195;", "CURRENT_PROJECT_VERSION = 211;"),
]:
    template = template.replace(old, new)

template = template.replace("if existing != [ZIP_PATH]:", "if existing and existing != [ZIP_PATH]:")
exec(compile(template, __file__, "exec"))
