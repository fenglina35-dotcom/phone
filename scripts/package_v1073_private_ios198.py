"""Build the v1073 / private iOS 1.0.198 co-living background-message package."""

from pathlib import Path


template = Path(__file__).with_name("package_v1071_private_ios195.py").read_text(encoding="utf-8")
for old, new in [
    ("v1071", "v1073"),
    ("1071", "1073"),
    ("1.0.195", "1.0.198"),
    ("(195)", "(198)"),
    ("ios195", "ios198"),
    ("iOS195", "iOS198"),
    ("PRIVATE195", "PRIVATE198"),
    ("private195", "private198"),
    ("构建 195", "构建 198"),
    ("第一百九十五", "第一百九十八"),
    ("私人App完整微信Bundle修复版", "形象工作室露脸修复版"),
    ("完整微信Bundle", "共同生活后台消息同步"),
    ("CURRENT_PROJECT_VERSION = 195;", "CURRENT_PROJECT_VERSION = 198;"),
]:
    template = template.replace(old, new)

template = template.replace("if existing != [ZIP_PATH]:", "if existing and existing != [ZIP_PATH]:")

exec(compile(template, __file__, "exec"))
