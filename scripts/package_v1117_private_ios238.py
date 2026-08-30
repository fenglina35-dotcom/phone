"""Build and verify the v1117 / private iOS 1.0.238 unified Mac source package."""

from pathlib import Path


template = Path(__file__).with_name("package_v1116_private_ios237.py").read_text(encoding="utf-8")
for old, new in [
    ("v1116", "v1117"),
    ("1116", "1117"),
    ("1.0.237", "1.0.238"),
    ("(237)", "(238)"),
    ("ios237", "ios238"),
    ("iOS237", "iOS238"),
    ("private237", "private238"),
    ("CallVideoMemory", "OutputStorageStability"),
    ("第二百三十七次安装_v1116_通话视频与记忆证据_请先读.md", "第二百三十八次安装_v1117_输出与存储稳定_请先读.md"),
    ("第二百三十七次安装", "第二百三十八次安装"),
    ("v1116 · 通话视频与记忆证据版", "v1117 · 输出与存储稳定版"),
    ("CURRENT_PROJECT_VERSION = 237;", "CURRENT_PROJECT_VERSION = 238;"),
]:
    template = template.replace(old, new)
template = template.replace(
    '        "视频通话角色画面",',
    '        "视频通话角色画面",\n'
    '        "function wechatReasoningLeak",\n'
    '        "function wechatInnerThoughtOnlyValue",\n'
    '        "function pfLocalizeRemoteAvatar",\n'
    '        "nativeProtectionBytes",',
)
exec(compile(template, __file__, "exec"))
