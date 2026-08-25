"""Build the v1073 / private iOS 1.0.197 package with the proven v1071 packager."""

from pathlib import Path


template = Path(__file__).with_name("package_v1071_private_ios195.py").read_text(encoding="utf-8")
for old, new in [
    ("v1071", "v1073"),
    ("1071", "1073"),
    ("1.0.195", "1.0.197"),
    ("(195)", "(197)"),
    ("ios195", "ios197"),
    ("iOS195", "iOS197"),
    ("PRIVATE195", "PRIVATE197"),
    ("private195", "private197"),
    ("构建 195", "构建 197"),
    ("第一百九十五", "第一百九十七"),
    ("私人App完整微信Bundle修复版", "形象工作室露脸修复版"),
    ("完整微信Bundle", "形象工作室露脸修复"),
    ("CURRENT_PROJECT_VERSION = 195;", "CURRENT_PROJECT_VERSION = 197;"),
]:
    template = template.replace(old, new)

exec(compile(template, __file__, "exec"))
