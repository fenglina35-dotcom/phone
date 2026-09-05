from pathlib import Path


def materialize_packager(wrapper_path: Path) -> str:
    """Expand an older lightweight wrapper without running its packager."""
    current_path = wrapper_path.resolve()
    code = current_path.read_text(encoding="utf-8")
    while "\nruntime_globals =" in code:
        prefix = code.rsplit("\nruntime_globals =", 1)[0]
        namespace = {"__file__": str(current_path), "__name__": "__packager_expand__"}
        exec(compile(prefix, str(current_path), "exec"), namespace)
        code = namespace["code"]
        current_path = Path(namespace["template_path"])
    return code


template_path = Path(__file__).with_name("package_v1182_private_ios308.py")
code = materialize_packager(template_path)

if "v1182" not in code or "1.0.308" not in code or "build308" not in code:
    raise RuntimeError("v1182/iOS308 packaging baseline is missing")

code = (
    code.replace("v1182", "v1183")
    .replace("1182", "1183")
    .replace("1.0.308", "1.0.309")
    .replace("(308)", "(309)")
    .replace("CURRENT_PROJECT_VERSION = 308;", "CURRENT_PROJECT_VERSION = 309;")
    .replace("build308", "build309")
    .replace("308-release-v1183", "309-release-v1183")
    .replace("?v=308", "?v=309")
    .replace("private308", "private309")
    .replace("iOS308", "iOS309")
)

replacements = [
    (
        "第三百零八次安装_v1183_连续性记忆与键盘修复_请先读.md",
        "第三百零九次安装_v1183_共同生活键盘与安卓唱片配色修复_请先读.md",
    ),
    (
        "delivery-v1183-private309-continuity-memory-keyboard-release",
        "delivery-v1183-private309-cohab-keyboard-vinyl-release",
    ),
    (
        "SmallPhone_v1183_ContinuityMemoryKeyboard_iOS309_MacReady",
        "SmallPhone_v1183_CohabKeyboardAndroidVinyl_iOS309_MacReady",
    ),
    (
        "小手机_v1183_私人版_iOS309_连续性记忆与键盘修复_Mac待编译源码包.zip",
        "小手机_v1183_私人版_iOS309_共同生活键盘与安卓唱片配色修复_Mac待编译源码包.zip",
    ),
    (
        "APP_VER='v1183 · 连续性、记忆与键盘修复版'",
        "APP_VER='v1183 · 共同生活键盘与唱片配色修复版'",
    ),
    (
        "v1183-theater-presence-release-1",
        "v1183-cohab-keyboard-vinyl-release-1",
    ),
    (
        "smallPhone.webContentTerminationTimes.v17.build309",
        "smallPhone.webContentTerminationTimes.v18.build309",
    ),
    (
        '            "function roleMemoryPerspectiveText",',
        '            "function roleMemoryPerspectiveText",\n'
        '            "function musicDiscColorInput(color)",\n'
        '            "function homeVinylColorPaint(value)",',
    ),
]

for old, new in replacements:
    if old not in code:
        raise RuntimeError(f"v1183 packaging template token missing: {old}")
    code = code.replace(old, new)

required_packager_tokens = [
    "delivery-v1183-private309-cohab-keyboard-vinyl-release",
    "SmallPhone_v1183_CohabKeyboardAndroidVinyl_iOS309_MacReady",
    "public-web=v1183 (shared-release)",
    "private-web=v1183",
    "ios=1.0.309 (309)",
    "v1183-cohab-keyboard-vinyl-release-1",
    "v1183-pixel-puzzle-4",
    "309-release-v1183-v1",
    "smallPhone.webContentTerminationTimes.v18.build309",
    "function musicDiscColorInput(color)",
    "function homeVinylColorPaint(value)",
]
for token in required_packager_tokens:
    if token not in code:
        raise RuntimeError(f"materialized v1183 packager token missing: {token}")

runtime_globals = {
    "__file__": str(Path(__file__).resolve()),
    "__name__": "__main__",
}
exec(compile(code, str(template_path), "exec"), runtime_globals)
