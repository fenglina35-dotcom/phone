"""Build the v1074 / private iOS 1.0.199 storage and music recovery package."""

from pathlib import Path


template = Path(__file__).with_name("package_v1071_private_ios195.py").read_text(encoding="utf-8")
for old, new in [
    ("v1071", "v1074"),
    ("1071", "1074"),
    ("1.0.195", "1.0.199"),
    ("(195)", "(199)"),
    ("ios195", "ios199"),
    ("iOS195", "iOS199"),
    ("PRIVATE195", "PRIVATE199"),
    ("private195", "private199"),
    ("构建 195", "构建 199"),
    ("第一百九十五", "第一百九十九"),
    ("私人App完整微信Bundle修复版", "存档歌单与网页电量修复版"),
    ("完整微信Bundle", "存档歌单与网页电量修复"),
    ("CURRENT_PROJECT_VERSION = 195;", "CURRENT_PROJECT_VERSION = 199;"),
]:
    template = template.replace(old, new)

template = template.replace("if existing != [ZIP_PATH]:", "if existing and existing != [ZIP_PATH]:")

exec(compile(template, __file__, "exec"))
