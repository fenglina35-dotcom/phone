"""Advance the public web release from v1153 to v1155."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FILES = (
    "app.js", "小手机.html", "sw.js", "web-hotfix.js", "index.html", "repair.html",
)
OLD_CACHE = "v1153-delivery-identity-intercept-release-1"
NEW_CACHE = "v1155-role-moment-image-permission-1"


def update(path: Path, replacements: tuple[tuple[str, str], ...]) -> None:
    text = path.read_text(encoding="utf-8")
    changed = text
    for old, new in replacements:
        changed = changed.replace(old, new)
    if changed == text:
        raise RuntimeError(f"no release marker changed in {path}")
    path.write_text(changed, encoding="utf-8", newline="\n")


for name in FILES:
    replacements = (
        ("v1153 · 外卖独立身份与拦截释放版", "v1155 · 角色朋友圈图片权限版"),
        ("v1153-delivery-identity-intercept-release-hotfix-1", "v1155-role-moment-image-permission-hotfix-1"),
        ("north-shell-v1153-delivery-identity-intercept-release-1", "north-shell-v1155-role-moment-image-permission-1"),
        (OLD_CACHE, NEW_CACHE),
        ("1153", "1155"),
    )
    update(ROOT / name, replacements)

changed_tests = []
for path in sorted((ROOT / "tests").glob("*.test.mjs")):
    text = path.read_text(encoding="utf-8")
    changed = text.replace(
        "v1153 · 外卖独立身份与拦截释放版",
        "v1155 · 角色朋友圈图片权限版",
    ).replace(
        "v1153-delivery-identity-intercept-release-hotfix-1",
        "v1155-role-moment-image-permission-hotfix-1",
    ).replace(
        "north-shell-v1153-delivery-identity-intercept-release-1",
        "north-shell-v1155-role-moment-image-permission-1",
    ).replace(OLD_CACHE, NEW_CACHE).replace("1153", "1155")
    if changed != text:
        path.write_text(changed, encoding="utf-8", newline="\n")
        changed_tests.append(path.name)

if not changed_tests:
    raise RuntimeError("no current public test markers changed")
print("PUBLIC_RELEASE=v1155")
print(f"UPDATED_TEST_FILES={len(changed_tests)}")
