"""Check build contents, runtime resource paths, licenses and reproducibility."""

import hashlib
import importlib.util
import json
import re
import zipfile
from packaging import DIST, VERSION
from package import build


def digest(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()


def check_browser(browser):
    archive = build(browser)
    first = digest(archive)
    assert digest(build(browser)) == first, "Extension ZIP is not reproducible"
    target = DIST / f"simple-snip-{browser}"
    manifest = json.loads((target / "manifest.json").read_text())
    assert manifest["version"] == VERSION
    assert "LICENSE" in zipfile.ZipFile(archive).namelist()
    paths = list(manifest["icons"].values())
    background = manifest["background"]
    paths.append(background.get("page") or background["service_worker"])
    action = manifest.get("action", manifest.get("browser_action"))
    paths.append(action["default_popup"])
    paths.append(manifest.get("side_panel", manifest.get("sidebar_action")).get("default_path")
                 or manifest["sidebar_action"]["default_panel"])
    paths.extend(manifest.get("web_accessible_resources", []))
    for name in paths:
        assert (target / name.split("?")[0]).is_file(), f"Missing manifest resource: {name}"
    for file in target.rglob("*"):
        if file.suffix not in {".js", ".html"} or "vendor" in file.parts:
            continue
        source = file.read_text()
        references = re.findall(r'(?:from|importScripts\(|addModule\(|new URL\()\s*["\'](\.[^"\']+)', source)
        if file.suffix == ".html":
            references.extend(re.findall(r'(?:src|href)="([^"?#]+)', source))
        for reference in references:
            assert (file.parent / reference).is_file(), f"Missing resource in {file.name}: {reference}"
    assert (target / "vendor/lamejs-LICENSE.txt").exists()
    assert not (target / ("chrome" if browser == "firefox" else "firefox")).exists()


for browser in ("chrome", "firefox"):
    check_browser(browser)
spec = importlib.util.spec_from_file_location("source_package", DIST.parent / "scripts/package-source.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
archive = module.build_source()
first = digest(archive)
assert digest(module.build_source()) == first, "Source ZIP is not reproducible"
with zipfile.ZipFile(archive) as source:
    names = source.namelist()
    assert "LICENSE" in names and "extension/vendor/lamejs-LICENSE.txt" in names
    assert "package-lock.json" in names and ".github/workflows/check.yml" in names
    assert not any(name.startswith(("release/", "dist/", "node_modules/", "Sample Snip Pro/", ".git/")) for name in names)
    assert "scripts/serve-downloads.py" not in names
print("Chrome, Firefox and source packages passed resource and reproducibility checks.")
