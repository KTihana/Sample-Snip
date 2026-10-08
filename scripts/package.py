"""Build standalone Chrome and Firefox extensions without changing source files."""

import json
import shutil
import tempfile
from pathlib import Path
from packaging import DIST, EXTENSION, ROOT, VERSION, write_zip


def build(browser):
    manifest_file = EXTENSION / ("firefox/manifest.json" if browser == "firefox" else "manifest.json")
    manifest = json.loads(manifest_file.read_text())
    if manifest["version"] != VERSION:
        raise ValueError(f"{browser} manifest version does not match package.json")
    DIST.mkdir(exist_ok=True)
    target = DIST / f"simple-snip-{browser}"
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
    archive = DIST / f"simple-snip-{browser}-{VERSION}.zip"
    write_zip(archive, [(file.relative_to(target), file) for file in target.rglob("*") if file.is_file()])
    return archive


if __name__ == "__main__":
    for browser in ("chrome", "firefox"):
        print(build(browser))
