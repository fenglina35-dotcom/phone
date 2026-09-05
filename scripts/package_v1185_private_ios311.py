from pathlib import Path


def materialize_packager(wrapper_path: Path) -> str:
    """Expand the previous release wrapper without running its packager."""
    current_path = wrapper_path.resolve()
    code = current_path.read_text(encoding="utf-8")
    while "\nruntime_globals =" in code:
        prefix = code.rsplit("\nruntime_globals =", 1)[0]
        namespace = {
            "__file__": str(current_path),
            "__name__": "__packager_expand__",
        }
        exec(compile(prefix, str(current_path), "exec"), namespace)
        code = namespace["code"]
        current_path = Path(namespace["template_path"])
    return code


template_path = Path(__file__).with_name("package_v1184_private_ios310.py")
code = materialize_packager(template_path)

baseline_tokens = [
    "delivery-v1184-private310-ios-web-cohab-keyboard-release",
    "SmallPhone_v1184_iPhoneWebCohabKeyboard_iOS310_MacReady",
    "小手机_v1184_私人版_iOS310_iPhone稳定剧场顺序与键盘修复_Mac待编译源码包.zip",
    "第三百一十次安装_v1184_iPhone稳定剧场顺序与键盘修复_请先读.md",
    "ios=1.0.310 (310)",
    "310-release-v1184-v1",
    "smallPhone.webContentTerminationTimes.v19.build310",
]
for token in baseline_tokens:
    if token not in code:
        raise RuntimeError(f"v1184/iOS310 packaging baseline token missing: {token}")

replacements = [
    (
        'public_paths = ["app.js", "index.html", "小手机.html", "sw.js", "manifest.webmanifest"]',
        'public_paths = ["app.js", "index.html", "小手机.html", "sw.js", "manifest.webmanifest"]\n'
        "# v1185 changes only the private iOS shell; reject accidental public web edits.\n"
        "if git(\"diff\", \"--quiet\", \"--\", *public_paths, check=False).returncode != 0:\n"
        "    raise RuntimeError(\"public web files changed during a private-only release\")",
    ),
    (
        'ALLOW_DIRTY_PACKAGE = "--allow-dirty" in sys.argv[1:]',
        'ALLOW_DIRTY_PACKAGE = "--allow-dirty" in sys.argv[1:]\n'
        'REPLACE_EXACT_PACKAGE = "--replace-exact-package" in sys.argv[1:]',
    ),
    (
        'if DELIVERY.exists() and any(DELIVERY.iterdir()):\n'
        '    raise RuntimeError(f"refusing to overwrite non-empty delivery: {DELIVERY}")',
        'if DELIVERY.exists() and any(DELIVERY.iterdir()):\n'
        '    existing_delivery = list(DELIVERY.iterdir())\n'
        '    if not REPLACE_EXACT_PACKAGE or existing_delivery != [ZIP_PATH]:\n'
        '        raise RuntimeError(f"refusing to overwrite non-exact delivery: {DELIVERY}")',
    ),
    (
        'if USER_ZIP.exists() and sha256(USER_ZIP.read_bytes()).hexdigest().upper() != digest:',
        'if (USER_ZIP.exists() and not REPLACE_EXACT_PACKAGE\n'
        '        and sha256(USER_ZIP.read_bytes()).hexdigest().upper() != digest):',
    ),
    (
        "第三百一十次安装_v1184_iPhone稳定剧场顺序与键盘修复_请先读.md",
        "第三百一十一次安装_v1185_共同生活键盘同步修复_请先读.md",
    ),
    (
        "delivery-v1184-private310-ios-web-cohab-keyboard-release",
        "delivery-v1185-private311-keyboard-sync-release",
    ),
    (
        "SmallPhone_v1184_iPhoneWebCohabKeyboard_iOS310_MacReady",
        "SmallPhone_v1185_PrivateKeyboardSync_iOS311_MacReady",
    ),
    (
        "小手机_v1184_私人版_iOS310_iPhone稳定剧场顺序与键盘修复_Mac待编译源码包.zip",
        "小手机_v1185_私人版_iOS311_共同生活键盘同步修复_Mac待编译源码包.zip",
    ),
    ("scope=shared-private-package", "scope=private-only"),
    ("public-web=v1184 (shared-release)", "public-web=v1184 (unchanged)"),
    ("ios=1.0.310 (310)", "ios=1.0.311 (311)"),
    ("1.0.310 (310)", "1.0.311 (311)"),
    ("CURRENT_PROJECT_VERSION = 310;", "CURRENT_PROJECT_VERSION = 311;"),
    ("MARKETING_VERSION = 1.0.310;", "MARKETING_VERSION = 1.0.311;"),
    ("smallPhone.webContentTerminationTimes.v19.build310", "smallPhone.webContentTerminationTimes.v20.build311"),
    ("310-release-v1184-v1", "311-private-v1185-keyboard-layout-guide-1"),
    ("private-runtime-diagnostics.js?v=310", "private-runtime-diagnostics.js?v=311"),
    (
        '            "configuration.websiteDataStore = .default()",',
        '            "configuration.websiteDataStore = .default()",\n'
        '            "final class KeyboardSynchronizedContainer: UIView",\n'
        '            "keyboardLayoutGuide.usesBottomSafeArea = false",\n'
        '            "equalTo: keyboardLayoutGuide.topAnchor",',
    ),
]

for old, new in replacements:
    if old not in code:
        raise RuntimeError(f"v1185 packaging template token missing: {old}")
    code = code.replace(old, new)

required_packager_tokens = [
    "delivery-v1185-private311-keyboard-sync-release",
    "SmallPhone_v1185_PrivateKeyboardSync_iOS311_MacReady",
    "public-web=v1184 (unchanged)",
    "private-web=v1184",
    "ios=1.0.311 (311)",
    "311-private-v1185-keyboard-layout-guide-1",
    "smallPhone.webContentTerminationTimes.v20.build311",
    "final class KeyboardSynchronizedContainer: UIView",
    "keyboardLayoutGuide.usesBottomSafeArea = false",
    "equalTo: keyboardLayoutGuide.topAnchor",
    "public web files changed during a private-only release",
    "REPLACE_EXACT_PACKAGE",
    "refusing to overwrite non-exact delivery",
]
for token in required_packager_tokens:
    if token not in code:
        raise RuntimeError(f"materialized v1185 packager token missing: {token}")

runtime_globals = {
    "__file__": str(Path(__file__).resolve()),
    "__name__": "__main__",
}
exec(compile(code, str(template_path), "exec"), runtime_globals)
