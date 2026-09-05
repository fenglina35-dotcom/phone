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


template_path = Path(__file__).with_name("package_v1183_private_ios309.py")
code = materialize_packager(template_path)

if "v1183" not in code or "1.0.309" not in code or "build309" not in code:
    raise RuntimeError("v1183/iOS309 packaging baseline is missing")

code = (
    code.replace("v1183", "v1184")
    .replace("1183", "1184")
    .replace("1.0.309", "1.0.310")
    .replace("(309)", "(310)")
    .replace("CURRENT_PROJECT_VERSION = 309;", "CURRENT_PROJECT_VERSION = 310;")
    .replace("build309", "build310")
    .replace("309-release-v1184", "310-release-v1184")
    .replace("?v=309", "?v=310")
    .replace("private309", "private310")
    .replace("iOS309", "iOS310")
)

replacements = [
    (
        "第三百零九次安装_v1184_共同生活键盘与安卓唱片配色修复_请先读.md",
        "第三百一十次安装_v1184_iPhone稳定剧场顺序与键盘修复_请先读.md",
    ),
    (
        "delivery-v1184-private310-cohab-keyboard-vinyl-release",
        "delivery-v1184-private310-ios-web-cohab-keyboard-release",
    ),
    (
        "SmallPhone_v1184_CohabKeyboardAndroidVinyl_iOS310_MacReady",
        "SmallPhone_v1184_iPhoneWebCohabKeyboard_iOS310_MacReady",
    ),
    (
        "小手机_v1184_私人版_iOS310_共同生活键盘与安卓唱片配色修复_Mac待编译源码包.zip",
        "小手机_v1184_私人版_iOS310_iPhone稳定剧场顺序与键盘修复_Mac待编译源码包.zip",
    ),
    (
        "APP_VER='v1184 · 共同生活键盘与唱片配色修复版'",
        "APP_VER='v1184 · iPhone稳定、剧场顺序与键盘修复版'",
    ),
    (
        "v1184-cohab-keyboard-vinyl-release-1",
        "v1184-ios-web-crash-cohab-turn-keyboard-1",
    ),
    (
        "smallPhone.webContentTerminationTimes.v18.build310",
        "smallPhone.webContentTerminationTimes.v19.build310",
    ),
    (
        '            "function homeVinylColorPaint(value)",',
        '            "function homeVinylColorPaint(value)",\n'
        '            "IOS_WEB_IMAGE_CACHE_CHAR_LIMIT=24*1024*1024",\n'
        '            "function lazyStoredImagesOn()",\n'
        '            "function offNarrationPress(e)",',
    ),
]

for old, new in replacements:
    if old not in code:
        raise RuntimeError(f"v1184 packaging template token missing: {old}")
    code = code.replace(old, new)

required_packager_tokens = [
    "delivery-v1184-private310-ios-web-cohab-keyboard-release",
    "SmallPhone_v1184_iPhoneWebCohabKeyboard_iOS310_MacReady",
    "public-web=v1184 (shared-release)",
    "private-web=v1184",
    "ios=1.0.310 (310)",
    "v1184-ios-web-crash-cohab-turn-keyboard-1",
    "v1184-pixel-puzzle-4",
    "310-release-v1184-v1",
    "smallPhone.webContentTerminationTimes.v19.build310",
    "IOS_WEB_IMAGE_CACHE_CHAR_LIMIT=24*1024*1024",
    "function lazyStoredImagesOn()",
    "function offNarrationPress(e)",
]
for token in required_packager_tokens:
    if token not in code:
        raise RuntimeError(f"materialized v1184 packager token missing: {token}")

runtime_globals = {
    "__file__": str(Path(__file__).resolve()),
    "__name__": "__main__",
}
exec(compile(code, str(template_path), "exec"), runtime_globals)
