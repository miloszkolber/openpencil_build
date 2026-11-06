#!/usr/bin/env python3
"""Download and extract the resolved OpenPencil release source archive."""
import argparse
import json
import shutil
import tarfile
import tempfile
import urllib.request
from pathlib import Path, PurePosixPath


def safe_members(archive):
    for member in archive.getmembers():
        parts = PurePosixPath(member.name).parts
        if member.name.startswith("/") or ".." in parts or not parts:
            raise ValueError(f"Unsafe archive member: {member.name}")
        if member.issym() or member.islnk():
            target = PurePosixPath(member.linkname)
            if target.is_absolute() or ".." in target.parts:
                raise ValueError(f"Unsafe archive link: {member.name}")
    return archive.getmembers()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--release", default=".build/release.json")
    parser.add_argument("--destination", default=".build/source")
    args = parser.parse_args()

    release = json.loads(Path(args.release).read_text(encoding="utf-8"))
    url = release["archive_url"]
    version = release["version"]
    destination = Path(args.destination)
    with tempfile.TemporaryDirectory(dir=destination.parent if destination.parent.exists() else ".") as temporary:
        archive_path = Path(temporary) / "source.tar.gz"
        with urllib.request.urlopen(url, timeout=120) as response, archive_path.open("wb") as output:
            shutil.copyfileobj(response, output)
        with tarfile.open(archive_path, "r:gz") as archive:
            safe_members(archive)
            members = [
                member
                for member in archive.getmembers()
                if len(PurePosixPath(member.name).parts) > 1
            ]
            roots = {PurePosixPath(member.name).parts[0] for member in members}
            if len(roots) != 1:
                raise ValueError("Release archive must have one root directory")
            for member in members:
                parts = PurePosixPath(member.name).parts
                member.name = str(PurePosixPath(*parts[1:]))
            if destination.exists():
                shutil.rmtree(destination)
            destination.mkdir(parents=True)
            try:
                archive.extractall(destination, members=members, filter="data")
            except TypeError:
                archive.extractall(destination, members=members)
    package = json.loads((destination / "package.json").read_text(encoding="utf-8"))
    if package.get("version") != version:
        raise SystemExit(
            f"Source version {package.get('version')} does not match release {version}"
        )
    print(f"Extracted OpenPencil {version} to {destination}")


if __name__ == "__main__":
    main()
