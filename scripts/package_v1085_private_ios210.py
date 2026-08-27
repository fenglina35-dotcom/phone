"""Build the v1085 / private iOS 1.0.210 unified Mac source package."""

from pathlib import Path


template = Path(__file__).with_name("package_v1071_private_ios195.py").read_text(encoding="utf-8")
for old, new in [
    ("v1071", "v1085"),
    ("1071", "1085"),
    ("1.0.195", "1.0.210"),
    ("(195)", "(210)"),
    ("ios195", "ios210"),
    ("iOS195", "iOS210"),
    ("private195", "private210"),
    ("CompleteWeChatBundle", "WebContentMemoryWechatManualSummary"),
    ("第一百九十五次安装_v1085_私人App_完整微信Bundle_请先读.md", "第二百一十次安装_v1085_WebContent降载与微信手动总结_请先读.md"),
    ("v1085 · 私人App完整微信Bundle修复版", "v1085 · WebContent降载与微信手动总结版"),
    ("const PRIVATE_IMAGE_CACHE_CHAR_LIMIT=48*1024*1024", "const PRIVATE_IMAGE_CACHE_CHAR_LIMIT=16*1024*1024"),
    ("CURRENT_PROJECT_VERSION = 195;", "CURRENT_PROJECT_VERSION = 210;"),
]:
    template = template.replace(old, new)

template = template.replace("if existing != [ZIP_PATH]:", "if existing and existing != [ZIP_PATH]:")
exec(compile(template, __file__, "exec"))
