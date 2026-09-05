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


template_path = Path(__file__).with_name("package_v1181_private_ios307.py")
code = materialize_packager(template_path)

if "v1181" not in code or "1.0.307" not in code or "build307" not in code:
    raise RuntimeError("v1181/iOS307 packaging baseline is missing")

code = (
    code.replace("v1181", "v1182")
    .replace("1181", "1182")
    .replace("1.0.307", "1.0.308")
    .replace("(307)", "(308)")
    .replace("CURRENT_PROJECT_VERSION = 307;", "CURRENT_PROJECT_VERSION = 308;")
    .replace("build307", "build308")
    .replace("307-release-v1182", "308-release-v1182")
)

replacements = [
    (
        "第三百零七次安装_v1182_综合修复与多人暂离_请先读.md",
        "第三百零八次安装_v1182_连续性记忆与键盘修复_请先读.md",
    ),
    (
        "delivery-v1182-private308-all-fixes-release",
        "delivery-v1182-private308-continuity-memory-keyboard-release",
    ),
    (
        "SmallPhone_v1182_AllFixesTheaterPresence_iOS308_MacReady",
        "SmallPhone_v1182_ContinuityMemoryKeyboard_iOS308_MacReady",
    ),
    (
        "小手机_v1182_私人版_iOS308_综合修复与多人暂离_Mac待编译源码包.zip",
        "小手机_v1182_私人版_iOS308_连续性记忆与键盘修复_Mac待编译源码包.zip",
    ),
    (
        "APP_VER='v1182 · 综合稳定、像素与多人暂离版'",
        "APP_VER='v1182 · 连续性、记忆与键盘修复版'",
    ),
    (
        "smallPhone.webContentTerminationTimes.v16.build308",
        "smallPhone.webContentTerminationTimes.v17.build308",
    ),
    (
        '            "function roleServerConversationSnapshot",',
        '            "function roleServerConversationSnapshot",\n'
        '            "function rolePhoneInspectionNovelText",\n'
        '            "function recentMealProgressIssue",\n'
        '            "function roleMemoryPerspectiveText",',
    ),
]

for old, new in replacements:
    if old not in code:
        raise RuntimeError(f"v1182 packaging template token missing: {old}")
    code = code.replace(old, new)

required_packager_tokens = [
    "delivery-v1182-private308-continuity-memory-keyboard-release",
    "SmallPhone_v1182_ContinuityMemoryKeyboard_iOS308_MacReady",
    "public-web=v1182 (shared-release)",
    "private-web=v1182",
    "ios=1.0.308 (308)",
    "v1182-theater-presence-release-1",
    "v1182-pixel-puzzle-4",
    "308-release-v1182-v1",
    "smallPhone.webContentTerminationTimes.v17.build308",
    "function rolePhoneInspectionNovelText",
    "function recentMealProgressIssue",
    "function roleMemoryPerspectiveText",
]
for token in required_packager_tokens:
    if token not in code:
        raise RuntimeError(f"materialized v1182 packager token missing: {token}")

runtime_globals = {
    "__file__": str(Path(__file__).resolve()),
    "__name__": "__main__",
}
exec(compile(code, str(template_path), "exec"), runtime_globals)
