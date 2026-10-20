"""Current committed-source overlay builder; historical filename retained.
Current full/permanent gates and exact baseline/archive checks replace obsolete version-locked guards.
"""

from hashlib import sha256
from pathlib import Path, PurePosixPath
from zipfile import ZIP_DEFLATED, ZipFile
import json
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
SOURCE = "native/private-small-phone/XcodeProject/"
BUNDLE = "PhoneCompanionTest/PhoneWeb.bundle/"
PREFIX = "SmallPhone_v1855_iOS501_Private/"
OUTPUT = ROOT.parent / "最新私人版本覆盖包_v1855_iOS501.zip"

WEB_VERSION = "1855"
REVIEWED_RUNTIME_COMMIT = "HEAD"
MAIN_BASE_COMMIT = "56b55b163fc39bbb2a8c88cb745ec96940e2d5f2"
PUBLIC_VERSION = "1850"
EVIDENCE_ROOT = ROOT / ".codex_tmp"
TEST_LOG = EVIDENCE_ROOT / "eight-chat" / "full-tests.log"
PREVIOUS_ZIP = ROOT.parent / "最新私人版本覆盖包_v1854_iOS501.zip"
PREVIOUS_ZIP_SHA256 = "f4783c32ae0908b64093dfefc74b60b486f5ab9853dbda9ee81cc29156414e27"
PREVIOUS_SOURCE = "35df3db1175e52d48ecaa0f7d3b5041b1b981b70"


class FolderArchive:
    """Read an unpacked overlay like a ZipFile, limited to the files its own manifest lists."""

    def __init__(self, root: Path):
        self.root = root
        manifest = json.loads((root / "SHA256SUMS.json").read_text(encoding="utf-8"))
        self.names = [root.name + "/" + n for n in sorted(manifest)] + [root.name + "/SHA256SUMS.json"]

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def namelist(self) -> list[str]:
        return list(self.names)

    def read(self, name: str) -> bytes:
        return (self.root / name.split("/", 1)[1]).read_bytes()
VOLUME_BYTES = 50 * 1024 * 1024
MARKETING = "1.0.501"
BUILD = "501"
BRIDGE = "42"


def git(*args: str) -> bytes:
    return subprocess.check_output(["git", "-c", "core.safecrlf=false", *args], cwd=ROOT)


def text(body: bytes) -> str:
    return body.decode("utf-8").replace("\r\n", "\n")


def committed_private_files(ref: str = "HEAD") -> dict[str, bytes]:
    """Every releasable tracked file under SOURCE, read from HEAD."""
    listing = text(git("ls-tree", "-r", "-z", "--name-only", ref, "--", SOURCE)).strip("\0")
    files: dict[str, bytes] = {}
    commit = text(git("rev-parse", ref)).strip()
    with subprocess.Popen(["git", "cat-file", "--batch"], cwd=ROOT, stdin=subprocess.PIPE, stdout=subprocess.PIPE) as process:
        for name in listing.split("\0"):
            if not name: continue
            relative = name[len(SOURCE):]
            suffix = PurePosixPath(relative).suffix.lower()
            current_guide = relative == "请在Mac编译前先读.md"
            cozy_doc = relative.startswith(BUNDLE)  # All runtime docs/lists/notices, including stickers.txt, must ship.
            if suffix == ".md" and not (current_guide or cozy_doc): continue
            if suffix == ".txt" and not cozy_doc: continue
            process.stdin.write((commit + ":" + name + "\n").encode("utf-8")); process.stdin.flush()
            header = process.stdout.readline().decode().split()
            assert len(header) == 3 and header[1] == "blob", name
            files[relative] = process.stdout.read(int(header[2]))
            assert process.stdout.read(1) == b"\n"
        process.stdin.close()
        process.wait()
    return files



def file_hash(path):
    digest = sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(4 * 1024 * 1024): digest.update(chunk)
    return digest.hexdigest()


def validate(files):
    for name in ("PhoneCompanionTest.xcodeproj/project.pbxproj", "PhoneCompanionTest/PhoneNativeBridge.swift", "PhoneCompanionTest/CheckInShortcuts.swift", "PhoneCompanionTest/PhoneCompanionTest.entitlements", "PhoneCompanionTest/LocalPhoneWebView.swift", "请在Mac编译前先读.md"):
        assert name in files, name
    app = text(files[BUNDLE + "app.js"])
    assert f"APP_VER='v{WEB_VERSION} · 语音查看与表情修复'" in app
    runtime = app + text(files[BUNDLE + "cohab-theater.js"]) + text(files[BUNDLE + "glass-theme.css"])
    for marker in ("ROLE_OWNER_TODO_REPORT_V1", "GRUDGE_JAIL_ANNOUNCE_V1", "roleJailAnnounced(decisionText)", "data-settings-appearance", "OFF_LAST_SESSION_V1", "CONTACT_PHOTO_DEL_V1", "APP_SOLID_MODAL_V1", "COHAB_GLASS_NO_COLOR_V1", "VOICE_SEND_DIAG_V1", "ROLE_LOCK_UNTIL_V1"):
        assert marker in runtime, marker
    assert "SETTINGS_BLACK_BLUE_V1" in text(files[BUNDLE + "glass-theme.css"])
    assert "SKY_ROLE_SYNC_V1" in text(files[BUNDLE + "private-sky-sync.js"])
    assert "setInterval(" not in text(files[BUNDLE + "private-sky-sync.js"]), "no idle cloud polling"
    assert "NorthSkyRoleSync.preparePhone(c)" in app
    assert "DAILY_CHECKIN_V1" in text(files[BUNDLE + "phone-shortcuts.js"])
    for name in ("private-cloud-backup.js", "cohab-theater.js", "task-notes.js", "license-gate.js", "delivery.js", "private-runtime-diagnostics.js", "private-sky-sync.js"):
        assert BUNDLE + name in files, name
    bridge = text(files["PhoneCompanionTest/PhoneNativeBridge.swift"])
    assert f"static let contractVersion = {BRIDGE}" in bridge
    assert "account.backup.file.commit" in bridge and "checkin.configure" in bridge
    pbx = text(files["PhoneCompanionTest.xcodeproj/project.pbxproj"])
    assert set(re.findall(r"CURRENT_PROJECT_VERSION = ([^;]+);", pbx)) == {BUILD}
    assert set(re.findall(r"MARKETING_VERSION = ([^;]+);", pbx)) == {MARKETING}
    for entry in ("index.html", "小手机.html"):
        html = text(files[BUNDLE + entry])
        assert f"window.__NORTH_SHELL_BUILD__='{WEB_VERSION}'" in html
        for resource in re.findall(r"(?:src|href)=[\"']([^\"'?#]+\.(?:js|css))", html):
            if "://" not in resource and not resource.startswith("data:"):
                assert BUNDLE + resource.removeprefix("./") in files, resource
    sticker_root = BUNDLE + "assets/task-notes/stickers/"
    stickers = [n for n in files if n.startswith(sticker_root) and n.endswith(".png")]
    assert len(stickers) == 43
    rows = text(files[sticker_root + "stickers.txt"]).strip().splitlines()
    assert len(rows) == 43
    for name in stickers: assert name.rsplit("/", 1)[1] in "\n".join(rows), name
    assert len([n for n in files if n.startswith(BUNDLE + "assets/task-notes/") and "/stickers/" not in n and n.endswith(".png")]) == 25


def main():
    assert not text(git("status", "--porcelain", "--untracked-files=no", "--", SOURCE)).strip(), "commit tracked changes before packaging"
    assert not OUTPUT.exists() and not list(OUTPUT.parent.glob(OUTPUT.name + ".[0-9][0-9][0-9]")), "refusing to overwrite deliverables"
    commit = text(git("rev-parse", "HEAD")).strip()
    git("merge-base", "--is-ancestor", MAIN_BASE_COMMIT, commit)
    git("merge-base", "--is-ancestor", PREVIOUS_SOURCE, commit)
    assert f"APP_VER='v{PUBLIC_VERSION} · 语音查看与表情修复'" in text(git("show", "HEAD:app.js"))
    files = committed_private_files()
    validate(files)
    base = committed_private_files(MAIN_BASE_COMMIT)
    assert set(base) | {BUNDLE + "private-sky-sync.js"} == set(files), "unexpected runtime/native file additions or removals"
    reviewed = {BUNDLE + n for n in ("app.js", "glass-theme.css", "index.html", "小手机.html", "repair.html", "web-hotfix.js", "public-north-runtime.js", "private-sky-sync.js", "cohab-theater.js")} | {"PhoneCompanionTest.xcodeproj/project.pbxproj", "请在Mac编译前先读.md", "PhoneCompanionTest/LocalPhoneWebView.swift", "PhoneCompanionTest/PhoneNativeBridge.swift"}
    changed = {n for n in files if n not in base or files[n] != base[n]}
    assert changed <= reviewed, "unreviewed private changes: " + str(sorted(changed - reviewed))
    def normalized_versions(body):
        return re.sub(r"MARKETING_VERSION = 1\.0\.\d+;", "MARKETING_VERSION = <version>;", re.sub(r"CURRENT_PROJECT_VERSION = \d+;", "CURRENT_PROJECT_VERSION = <build>;", text(body)))
    assert normalized_versions(files["PhoneCompanionTest.xcodeproj/project.pbxproj"]) == normalized_versions(base["PhoneCompanionTest.xcodeproj/project.pbxproj"]), "signing/build configuration changed"
    for name in ("PhoneCompanionTest/LocalPhoneWebView.swift", "PhoneCompanionTest/PhoneNativeBridge.swift"):
        assert files[name] == base[name], "unexpected native change: " + name
    assert files[BUNDLE + "private-sky-sync.js"] == base[BUNDLE + "private-sky-sync.js"], "Sky must stay private and unchanged"
    del base
    assert file_hash(PREVIOUS_ZIP) == PREVIOUS_ZIP_SHA256
    with ZipFile(PREVIOUS_ZIP) as prior:
        assert prior.testzip() is None
        prefix = next(n for n in prior.namelist() if n.endswith("/SOURCE_STATE.json")).removesuffix("SOURCE_STATE.json")
        manifest_bytes = prior.read(prefix + "SHA256SUMS.json")
        manifest = json.loads(manifest_bytes)
        assert set(manifest) == {n[len(prefix):] for n in prior.namelist() if n.startswith(prefix)} - {"SHA256SUMS.json"}
        for name, digest in manifest.items(): assert sha256(prior.read(prefix + name)).hexdigest() == digest, name
        previous_state = json.loads(prior.read(prefix + "SOURCE_STATE.json"))
        assert previous_state["sourceCommit"].startswith(PREVIOUS_SOURCE)
        assert not (set(manifest) - {"SOURCE_STATE.json"} - set(files)), "previous package files missing"
    log = text(TEST_LOG.read_bytes())
    match = re.search(r"pass (\d+)", log)
    assert match and int(match[1]) >= 4491 and re.search(r"fail 0\b", log) and "cancelled 0" in log
    browser = text((EVIDENCE_ROOT / "eight-chat/eight-browser.log").read_bytes())
    assert browser.count('"refreshAndSinceAndRevocation":true,"pageErrors":0') >= 2
    owner_browser = text((EVIDENCE_ROOT / "eight-chat/eight-browser.log").read_bytes())
    assert owner_browser.count('"ownerTodo":true,"realEditor":true') >= 2
    state = {
        "sourceCommit": commit, "webSourceCommit": commit, "privateWeb": "v"+WEB_VERSION, "publicWeb": "v"+PUBLIC_VERSION,
        "marketingVersion": MARKETING, "build": BUILD, "bridge": BRIDGE, "packageKind": "Mac/Xcode committed-source overlay, not IPA",
        "mainBaseCommit": MAIN_BASE_COMMIT,
        "lastDeliveredPackage": {"name": PREVIOUS_ZIP.name, "sha256": PREVIOUS_ZIP_SHA256, "manifestSha256": sha256(manifest_bytes).hexdigest(), "sourceCommit": PREVIOUS_SOURCE},
        "inheritedValidation": {"sourceCommit": PREVIOUS_SOURCE, "validation": previous_state.get("validation", {})},
        "preserved": sorted(set(previous_state.get("preserved", [])) | {"complete-private-v1852-ios501-payload", "GRUDGE_JAIL_ANNOUNCE_V1", "SETTINGS_BLACK_BLUE_V1", "all-43-stickers-and-list", "all-25-task-note-assets", "OFF_LAST_SESSION_V1", "COHAB_GLASS_NO_COLOR_V1", "APP_SOLID_MODAL_V1", "SKY_ROLE_SYNC_V1", "complete-private-v1854-package-inherited", "COHAB_VOICE_TOUCH_ROUTE_V1", "COHAB_VOICE_PHONE_ACTIONS_V1", "PRIVATE_MONITOR_REAL_USAGE_V1", "STICKER_EXPLICIT_FORMAT_V1"}),
        "knownUnresolved": ["this-overlay-Mac-build-signing-and-real-iPhone-not-verified", "checkin-after-19:08-user-result-pending", "historical-checkin-Busy-launch-not-proven-fixed", "cohab-real-laughter-and-voice-visual-device-acceptance-pending", "sky-role-pairing-and-game-to-phone-device-verification-pending"],
        "validation": {"nodeTests": {"passed": int(match[1]), "failed": 0, "sourceCommit": commit}, "authorizedChatBothRuntimes": True, "ownerTodoBothRuntimes": True, "previousManifestCRCVerified": True, "publishedBaselinePayloadVerified": True, "privateCompanionNativeChangesThisRelease": False, "signingConfigurationUnchanged": True, "macBuildVerified": False, "realIPhoneVerified": False},
        "ownerTodoBackend": {"private":47,"public":43,"deployedSeparately":True,"realDeviceVerified":False},
        "skyRoleBackend": {"project": "qvuahlqimcfgeoetosnl", "marker": "SKY_ROLE_SYNC_V1", "deployed": True, "transactionTestsRolledBack": True, "cloudModelCalls": 0, "periodicPolling": False, "realRolePaired": False},
        "externalBackend": {"APNS_ENV_FALLBACK_V1": "already deployed separately; one real test sent and client acknowledged; not redeployed by this ZIP"},
        "intentionalExclusions": "historical native install docs; all runtime resources and notices included",
        "reviewedPrivateChanges": sorted(changed),
    }
    files["SOURCE_STATE.json"] = json.dumps(state, ensure_ascii=False, indent=2).encode("utf-8")
    files["SHA256SUMS.json"] = json.dumps({n: sha256(b).hexdigest() for n,b in sorted(files.items())}, ensure_ascii=False, indent=2).encode("utf-8")
    with ZipFile(OUTPUT, "x", ZIP_DEFLATED, compresslevel=6) as archive:
        for name in sorted(files): archive.writestr(PREFIX + name, files[name])
    with ZipFile(OUTPUT) as archive:
        assert archive.testzip() is None
        assert len(archive.namelist()) == len(files)
        checks = json.loads(archive.read(PREFIX + "SHA256SUMS.json"))
        assert set(checks) == set(files) - {"SHA256SUMS.json"}
        for name, body in files.items():
            reread = archive.read(PREFIX + name)
            assert reread == body, "source roundtrip: " + name
            if name in checks: assert sha256(reread).hexdigest() == checks[name], name
    volumes, combined = [], sha256()
    with OUTPUT.open("rb") as source:
        part = 1
        while chunk := source.read(VOLUME_BYTES):
            path = OUTPUT.with_name(OUTPUT.name + f".{part:03d}")
            with path.open("xb") as out: assert out.write(chunk) == len(chunk)
            reread = path.read_bytes(); assert reread == chunk
            combined.update(reread); volumes.append({"name": path.name, "bytes": len(reread), "sha256": sha256(reread).hexdigest()}); part += 1
    digest = file_hash(OUTPUT); assert combined.hexdigest() == digest
    print(json.dumps({"path": str(OUTPUT), "sourceCommit": commit, "files": len(files), "manifestEntries": len(files)-1, "bytes": OUTPUT.stat().st_size, "sha256": digest, "privateWeb": "v"+WEB_VERSION, "native": f"{MARKETING} ({BUILD})", "bridge": BRIDGE, "volumes": volumes, "splitConcatenationVerified": True}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
