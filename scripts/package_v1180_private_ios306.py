from pathlib import Path


def materialize_packager(wrapper_path: Path) -> str:
    """Expand the older lightweight wrappers without running their packager."""
    current_path = wrapper_path.resolve()
    code = current_path.read_text(encoding="utf-8")
    while "runtime_globals =" in code:
        prefix = code.split("runtime_globals =", 1)[0]
        namespace = {"__file__": str(current_path), "__name__": "__packager_expand__"}
        exec(compile(prefix, str(current_path), "exec"), namespace)
        code = namespace["code"]
        current_path = Path(namespace["template_path"])
    return code


template_path = Path(__file__).with_name("package_v1179_private_ios305.py")
code = materialize_packager(template_path)

# Advance both release identities in the fully materialized packager, then
# tighten the names and integrity tokens that are unique to this release.
if "v1179" not in code or "305" not in code:
    raise RuntimeError("v1179/iOS305 packaging baseline is missing")
code = code.replace("v1179", "v1180").replace("305", "306")

replacements = [
    (
        "第三百零五次安装_v1180_格式与拼图修复_请先读.md",
        "第三百零六次安装_v1180_综合稳定像素外卖修复_请先读.md",
    ),
    (
        "delivery-v1180-private306-format-bead-release",
        "delivery-v1180-private306-stability-pixel-delivery-release",
    ),
    (
        "SmallPhone_v1180_FormatPixelFix_iOS306_MacReady",
        "SmallPhone_v1180_StabilityPixelDelivery_iOS306_MacReady",
    ),
    (
        "小手机_v1180_私人版_iOS306_格式与拼图修复_Mac待编译源码包.zip",
        "小手机_v1180_私人版_iOS306_综合稳定像素外卖修复_Mac待编译源码包.zip",
    ),
    (
        "APP_VER='v1180 · 格式与拼图修正版'",
        "APP_VER='v1180 · 综合稳定、像素与外卖修正版'",
    ),
    ("v1180-format-bead-fix-1", "v1180-summary-call-offline-1"),
    ("v1180-pixel-puzzle-2", "v1180-pixel-puzzle-3"),
    ("306-format-bead-v1", "306-release-v1180-v1"),
    (
        '"_beadSourceCache", "保存进度", "archivedView"',
        '"_beadSourceCache", "保存进度", "beadRoleFinishAll", "completionMessaged", "labelPx/scale"',
    ),
    (
        "smallPhone.webContentTerminationTimes.v14.build306",
        "smallPhone.webContentTerminationTimes.v15.build306",
    ),
]

for old, new in replacements:
    if old not in code:
        raise RuntimeError(f"v1180 packaging template token missing: {old}")
    code = code.replace(old, new)

required_packager_tokens = [
    "delivery-v1180-private306-stability-pixel-delivery-release",
    "SmallPhone_v1180_StabilityPixelDelivery_iOS306_MacReady",
    "public-web=v1180 (shared-release)",
    "private-web=v1180",
    "ios=1.0.306 (306)",
    "v1180-summary-call-offline-1",
    "v1180-pixel-puzzle-3",
    "306-release-v1180-v1",
    "smallPhone.webContentTerminationTimes.v15.build306",
]
for token in required_packager_tokens:
    if token not in code:
        raise RuntimeError(f"materialized v1180 packager token missing: {token}")

runtime_globals = {
    "__file__": str(Path(__file__).resolve()),
    "__name__": "__main__",
}
exec(compile(code, str(template_path), "exec"), runtime_globals)
