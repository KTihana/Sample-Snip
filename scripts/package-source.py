"""Package the public source; private release files and separate projects stay local."""

from packaging import DIST, ROOT, VERSION, source_files, write_zip


def build_source():
    archive = DIST / f"simple-snip-source-{VERSION}.zip"
    write_zip(archive, [(file.relative_to(ROOT), file) for file in source_files()])
    return archive


if __name__ == "__main__":
    print(build_source())
