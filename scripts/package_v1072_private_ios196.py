"""Build the v1072 / private iOS 1.0.196 package with the proven v1071 packager."""

from pathlib import Path


template = Path(__file__).with_name("package_v1071_private_ios195.py").read_text(encoding="utf-8")
for old, new in [
    ("v1071", "v1072"),
    ("1071", "1072"),
    ("1.0.195", "1.0.196"),
    ("(195)", "(196)"),
    ("ios195", "ios196"),
    ("iOS195", "iOS196"),
    ("PRIVATE195", "PRIVATE196"),
    ("private195", "private196"),
    ("构建 195", "构建 196"),
    ("第一百九十五", "第一百九十六"),
    ("私人App完整微信Bundle修复版", "形象工作室与外卖稳定版"),
    ("完整微信Bundle", "形象工作室与外卖稳定"),
    ("CURRENT_PROJECT_VERSION = 195;", "CURRENT_PROJECT_VERSION = 196;"),
]:
    template = template.replace(old, new)

exec(compile(template, __file__, "exec"))
