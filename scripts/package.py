"""Build standalone Chrome and Firefox extensions without changing source files."""

import json
import shutil
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXTENSION = ROOT / "extension"
DIST = ROOT / "dist"
VERSION = json.loads((EXTENSION / "manifest.json").read_text())["version"]


def write_zip(destination, folder):
    with zipfile.ZipFile(destination, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for file in sorted(folder.rglob("*")):
            if not file.is_file() or file.name == ".DS_Store":
                continue
            entry = zipfile.ZipInfo(file.relative_to(folder).as_posix(), date_time=(1980, 1, 1, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            entry.external_attr = 0o100644 << 16
            archive.writestr(entry, file.read_bytes())


def build(browser):
    manifest_file = EXTENSION / ("firefox/manifest.json" if browser == "firefox" else "manifest.json")
    manifest = json.loads(manifest_file.read_text())
    if manifest["version"] != VERSION:
        raise ValueError(f"{browser} manifest version does not match the Chrome manifest")
    DIST.mkdir(exist_ok=True)
    target = DIST / f"sample-snip-{browser}"
    with tempfile.TemporaryDirectory(dir=DIST) as temporary:
        staging = Path(temporary)
        for folder in ("audio", "shared", "ui", "icons", "vendor", browser):
            shutil.copytree(EXTENSION / folder, staging / folder)
        if browser == "firefox":
            (staging / "firefox/manifest.json").unlink()
        (staging / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
        shutil.copyfile(ROOT / "LICENSE", staging / "LICENSE")
        shutil.copyfile(ROOT / "docs/privacy.md", staging / "PRIVACY.md")
        if target.exists():
            shutil.rmtree(target)
        shutil.move(str(staging), target)
    archive = DIST / f"sample-snip-{browser}-{VERSION}.zip"
    write_zip(archive, target)
    return archive


if __name__ == "__main__":
    for browser in ("chrome", "firefox"):
        print(build(browser))
