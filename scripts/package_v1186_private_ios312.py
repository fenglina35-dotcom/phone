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


template_path = Path(__file__).with_name("package_v1185_private_ios311.py")
code = materialize_packager(template_path)

baseline_tokens = [
    "delivery-v1185-private311-keyboard-sync-release",
    "SmallPhone_v1185_PrivateKeyboardSync_iOS311_MacReady",
    "小手机_v1185_私人版_iOS311_共同生活键盘同步修复_Mac待编译源码包.zip",
    "第三百一十一次安装_v1185_共同生活键盘同步修复_请先读.md",
    "ios=1.0.311 (311)",
    "311-private-v1185-keyboard-layout-guide-1",
    "smallPhone.webContentTerminationTimes.v20.build311",
    "final class KeyboardSynchronizedContainer: UIView",
    "keyboardLayoutGuide.usesBottomSafeArea = false",
    "equalTo: keyboardLayoutGuide.topAnchor",
]
for token in baseline_tokens:
    if token not in code:
        raise RuntimeError(f"v1185/iOS311 packaging baseline token missing: {token}")

replacements = [
    (
        "第三百一十一次安装_v1185_共同生活键盘同步修复_请先读.md",
        "第三百一十二次安装_v1186_共同生活键盘隔离修复_请先读.md",
    ),
    (
        "delivery-v1185-private311-keyboard-sync-release",
        "delivery-v1186-private312-cohab-keyboard-isolation-release",
    ),
    (
        "SmallPhone_v1185_PrivateKeyboardSync_iOS311_MacReady",
        "SmallPhone_v1186_CohabKeyboardIsolation_iOS312_MacReady",
    ),
    (
        "小手机_v1185_私人版_iOS311_共同生活键盘同步修复_Mac待编译源码包.zip",
        "小手机_v1186_私人版_iOS312_共同生活键盘隔离修复_Mac待编译源码包.zip",
    ),
    ("ios=1.0.311 (311)", "ios=1.0.312 (312)"),
    ("1.0.311 (311)", "1.0.312 (312)"),
    ("CURRENT_PROJECT_VERSION = 311;", "CURRENT_PROJECT_VERSION = 312;"),
    ("MARKETING_VERSION = 1.0.311;", "MARKETING_VERSION = 1.0.312;"),
    (
        "smallPhone.webContentTerminationTimes.v20.build311",
        "smallPhone.webContentTerminationTimes.v21.build312",
    ),
    (
        "311-private-v1185-keyboard-layout-guide-1",
        "312-private-v1186-cohab-keyboard-isolation-1",
    ),
    ("private-runtime-diagnostics.js?v=311", "private-runtime-diagnostics.js?v=312"),
    (
        "final class KeyboardSynchronizedContainer: UIView",
        "smallPhoneOfflineKeyboardScope",
    ),
    (
        "keyboardLayoutGuide.usesBottomSafeArea = false",
        "target.id === 'off_in'",
    ),
    (
        "equalTo: keyboardLayoutGuide.topAnchor",
        "scrollView.isScrollEnabled = false",
    ),
]

for old, new in replacements:
    if old not in code:
        raise RuntimeError(f"v1186 packaging template token missing: {old}")
    code = code.replace(old, new)

required_packager_tokens = [
    "delivery-v1186-private312-cohab-keyboard-isolation-release",
    "SmallPhone_v1186_CohabKeyboardIsolation_iOS312_MacReady",
    "public-web=v1184 (unchanged)",
    "private-web=v1184",
    "ios=1.0.312 (312)",
    "312-private-v1186-cohab-keyboard-isolation-1",
    "smallPhone.webContentTerminationTimes.v21.build312",
    "smallPhoneOfflineKeyboardScope",
    "target.id === 'off_in'",
    "scrollView.isScrollEnabled = false",
    "public web files changed during a private-only release",
]
for token in required_packager_tokens:
    if token not in code:
        raise RuntimeError(f"materialized v1186 packager token missing: {token}")

for forbidden in [
    "final class KeyboardSynchronizedContainer: UIView",
    "keyboardLayoutGuide.usesBottomSafeArea = false",
    "equalTo: keyboardLayoutGuide.topAnchor",
]:
    if forbidden in code:
        raise RuntimeError(f"v1185 global keyboard layout leaked into v1186: {forbidden}")

runtime_globals = {
    "__file__": str(Path(__file__).resolve()),
    "__name__": "__main__",
}
exec(compile(code, str(template_path), "exec"), runtime_globals)
