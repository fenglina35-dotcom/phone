from pathlib import Path
import shutil
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "native" / "private-small-phone" / "XcodeProject"
DELIVERY = ROOT / "delivery-v1029"
FULL = DELIVERY / "SmallPhone_v1029_RealDeliveryWallet"
MAC = DELIVERY / "SmallPhone_v1029_RealDeliveryWallet_MacReady"


def copy_tree_contents(source: Path, destination: Path):
    destination.mkdir(parents=True, exist_ok=False)
    for item in source.iterdir():
        target = destination / item.name
        if item.is_dir():
            shutil.copytree(item, target)
        else:
            shutil.copy2(item, target)


def zip_directory(source: Path, destination: Path):
    with ZipFile(destination, "w", ZIP_DEFLATED, compresslevel=6) as archive:
        for path in sorted(source.rglob("*")):
            if path.is_file():
                archive.write(path, Path(source.name) / path.relative_to(source))


if DELIVERY.exists():
    resolved = DELIVERY.resolve()
    if resolved.parent != ROOT.resolve() or resolved.name != "delivery-v1029":
        raise RuntimeError(f"unsafe delivery path: {resolved}")
    shutil.rmtree(resolved)
if not (SOURCE / "PhoneCompanionTest.xcodeproj" / "project.pbxproj").is_file():
    raise RuntimeError("Xcode project source is incomplete")
if not (SOURCE / "PhoneCompanionTest" / "PhoneWeb.bundle" / "delivery.js").is_file():
    raise RuntimeError("staged private bundle is missing delivery.js")

DELIVERY.mkdir()
FULL.mkdir()
for readme in SOURCE.glob("*请先读.md"):
    shutil.copy2(readme, FULL / readme.name)
nested = FULL / "native" / "private-small-phone"
nested.mkdir(parents=True)
shutil.copytree(SOURCE, nested / "XcodeProject")
copy_tree_contents(SOURCE, MAC)

zip_directory(FULL, DELIVERY / f"{FULL.name}.zip")
zip_directory(MAC, DELIVERY / f"{MAC.name}.zip")

print(f"Created {DELIVERY}")
