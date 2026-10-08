"""Shared file selection and reproducible ZIP creation."""

from pathlib import Path
import json
import zipfile

ROOT = Path(__file__).resolve().parent.parent
EXTENSION = ROOT / "extension"
DIST = ROOT / "dist"
VERSION = json.loads((ROOT / "package.json").read_text())["version"]
PUBLIC_FOLDERS = ("extension", "docs", "tests", "scripts", ".github")
PUBLIC_FILES = (
    ".editorconfig", ".gitignore", ".prettierignore", ".prettierrc.json",
    "eslint.config.js", "LICENSE", "README.md", "package.json", "package-lock.json",
)


def source_files():
    files = [ROOT / name for name in PUBLIC_FILES]
    for folder in PUBLIC_FOLDERS:
        files.extend(
            file for file in (ROOT / folder).rglob("*")
            if file.is_file()
            and "__pycache__" not in file.parts
            and file.name not in {".DS_Store", "serve-downloads.py"}
        )
    return sorted(files)


def write_zip(destination, files):
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(destination, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, file in sorted(files):
            entry = zipfile.ZipInfo(Path(name).as_posix(), date_time=(1980, 1, 1, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            entry.external_attr = 0o100644 << 16
            archive.writestr(entry, file.read_bytes())
