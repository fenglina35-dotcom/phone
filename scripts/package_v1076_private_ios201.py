"""Build the v1076 / private iOS 1.0.201 pose-first wardrobe package."""

from pathlib import Path


template = Path(__file__).with_name("package_v1071_private_ios195.py").read_text(encoding="utf-8")
for old, new in [
    ("v1071", "v1076"),
    ("1071", "1076"),
    ("1.0.195", "1.0.201"),
    ("(195)", "(201)"),
    ("ios195", "ios201"),
    ("iOS195", "iOS201"),
    ("PRIVATE195", "PRIVATE201"),
    ("private195", "private201"),
    ("构建 195", "构建 201"),
    ("第一百九十五", "第二百零一"),
    ("私人App完整微信Bundle修复版", "用户动作优先衣柜版"),
    ("完整微信Bundle", "动作优先衣柜"),
    ("CompleteWeChatBundle", "PoseFirstWardrobe"),
    ("CURRENT_PROJECT_VERSION = 195;", "CURRENT_PROJECT_VERSION = 201;"),
]:
    template = template.replace(old, new)

template = template.replace("if existing != [ZIP_PATH]:", "if existing and existing != [ZIP_PATH]:")

exec(compile(template, __file__, "exec"))
