"""Build and verify the v1116 / private iOS 1.0.237 unified Mac source package."""

from pathlib import Path


template = Path(__file__).with_name("package_v1115_private_ios236.py").read_text(encoding="utf-8")
for old, new in [
    ("v1115", "v1116"),
    ("1115", "1116"),
    ("1.0.236", "1.0.237"),
    ("(236)", "(237)"),
    ("ios236", "ios237"),
    ("iOS236", "iOS237"),
    ("private236", "private237"),
    ("RoleVoiceRoute", "CallVideoMemory"),
    ("第二百三十六次安装_v1116_角色独立语音路线_请先读.md", "第二百三十七次安装_v1116_通话视频与记忆证据_请先读.md"),
    ("第二百三十六次安装", "第二百三十七次安装"),
    ("v1116 · 角色独立语音路线版", "v1116 · 通话视频与记忆证据版"),
    ("CURRENT_PROJECT_VERSION = 236;", "CURRENT_PROJECT_VERSION = 237;"),
]:
    template = template.replace(old, new)
template = template.replace(
    '        "page.p===\'wxmoment\'",',
    '        "page.p===\'wxmoment\'",\n'
    '        "function memoryCandidateQuality",\n'
    '        "function memoryCandidateGrounded",\n'
    '        "function roleCallLoopVideoSave",\n'
    '        "function callRoleVisualToggle",\n'
    '        "视频通话角色画面",',
)
template = template.replace(
    '    if source_bundle != archived_bundle:\n        raise RuntimeError("ZIP PhoneWeb.bundle differs from source bundle")',
    '    if source_bundle != archived_bundle:\n'
    '        missing = sorted(set(source_bundle) - set(archived_bundle))\n'
    '        extra = sorted(set(archived_bundle) - set(source_bundle))\n'
    '        changed = sorted(k for k in set(source_bundle) & set(archived_bundle) if source_bundle[k] != archived_bundle[k])\n'
    '        raise RuntimeError(f"ZIP PhoneWeb.bundle differs from source bundle: missing={missing}, extra={extra}, changed={changed}")',
)
exec(compile(template, __file__, "exec"))
