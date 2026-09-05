from pathlib import Path


def materialize_packager(wrapper_path: Path) -> str:
    """Expand the older lightweight wrappers without running their packager."""
    current_path = wrapper_path.resolve()
    code = current_path.read_text(encoding="utf-8")
    while "\nruntime_globals =" in code:
        prefix = code.rsplit("\nruntime_globals =", 1)[0]
        namespace = {"__file__": str(current_path), "__name__": "__packager_expand__"}
        exec(compile(prefix, str(current_path), "exec"), namespace)
        code = namespace["code"]
        current_path = Path(namespace["template_path"])
    return code


template_path = Path(__file__).with_name("package_v1180_private_ios306.py")
code = materialize_packager(template_path)

if "v1180" not in code or "306" not in code:
    raise RuntimeError("v1180/iOS306 packaging baseline is missing")
code = code.replace("v1180", "v1181").replace("1180", "1181").replace("306", "307")

replacements = [
    (
        "第三百零六次安装_v1181_综合稳定像素外卖修复_请先读.md",
        "第三百零七次安装_v1181_综合修复与多人暂离_请先读.md",
    ),
    (
        "delivery-v1181-private307-stability-pixel-delivery-release",
        "delivery-v1181-private307-all-fixes-release",
    ),
    (
        "SmallPhone_v1181_StabilityPixelDelivery_iOS307_MacReady",
        "SmallPhone_v1181_AllFixesTheaterPresence_iOS307_MacReady",
    ),
    (
        "小手机_v1181_私人版_iOS307_综合稳定像素外卖修复_Mac待编译源码包.zip",
        "小手机_v1181_私人版_iOS307_综合修复与多人暂离_Mac待编译源码包.zip",
    ),
    (
        "APP_VER='v1181 · 综合稳定、像素与外卖修正版'",
        "APP_VER='v1181 · 综合稳定、像素与多人暂离版'",
    ),
    ("v1181-summary-call-offline-1", "v1181-theater-presence-release-1"),
    ("v1181-pixel-puzzle-3", "v1181-pixel-puzzle-4"),
    ("smallPhone.webContentTerminationTimes.v15.build307", "smallPhone.webContentTerminationTimes.v16.build307"),
    ("EXPECTED_PACKAGE_FILES = 191", "EXPECTED_PACKAGE_FILES = 191"),
    (
        'require_tokens(theater, ["v1181-theater-presence-release-1", "_theaterTurnTargets",',
        'require_tokens(theater, ["v1181-theater-presence-release-1", "_theaterTurnTargets", "cohabTheaterPresence", "theaterPresent", "你已暂时离场",',
    ),
]

for old, new in replacements:
    if old not in code:
        raise RuntimeError(f"v1181 packaging template token missing: {old}")
    code = code.replace(old, new)

required_packager_tokens = [
    "delivery-v1181-private307-all-fixes-release",
    "SmallPhone_v1181_AllFixesTheaterPresence_iOS307_MacReady",
    "public-web=v1181 (shared-release)",
    "private-web=v1181",
    "ios=1.0.307 (307)",
    "v1181-theater-presence-release-1",
    "v1181-pixel-puzzle-4",
    "307-release-v1181-v1",
    "smallPhone.webContentTerminationTimes.v16.build307",
    "cohabTheaterPresence",
    "你已暂时离场",
]
for token in required_packager_tokens:
    if token not in code:
        raise RuntimeError(f"materialized v1181 packager token missing: {token}")

runtime_globals = {
    "__file__": str(Path(__file__).resolve()),
    "__name__": "__main__",
}
exec(compile(code, str(template_path), "exec"), runtime_globals)
