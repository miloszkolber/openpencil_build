#!/usr/bin/env python3
"""Resolve the newest OpenPencil mainline release, including prereleases."""
import argparse
import json
import os
import re
import subprocess
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

UPSTREAM = "open-pencil/open-pencil"
REPOSITORY = f"https://github.com/{UPSTREAM}"
API = "https://api.github.com"
SEMVER = re.compile(
    r"^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)"
    r"(?:-([0-9A-Za-z.-]+))?$"
)
FULL_SHA = re.compile(r"[0-9a-f]{40}$")
PRERELEASE_IDENTIFIER = re.compile(r"^[0-9A-Za-z-]+$")


def version_key(tag):
    """Return a sortable semver key for a v-prefixed release tag, or None."""
    match = SEMVER.fullmatch(tag or "")
    if match is None:
        return None
    major, minor, patch, prerelease = match.groups()
    if prerelease is None:
        return (int(major), int(minor), int(patch), (1, ()))
    identifiers = prerelease.split(".")
    if not identifiers:
        raise ValueError(f"Invalid prerelease in release tag: {tag}")
    key = []
    for identifier in identifiers:
        if not PRERELEASE_IDENTIFIER.fullmatch(identifier):
            raise ValueError(f"Invalid prerelease identifier in release tag: {tag}")
        if identifier.isdigit():
            if len(identifier) > 1 and identifier[0] == "0":
                raise ValueError(f"Numeric prerelease identifier has a leading zero: {tag}")
            key.append((0, int(identifier)))
        else:
            key.append((1, identifier))
    return (int(major), int(minor), int(patch), (0, tuple(key)))


def normalize_tag(value):
    tag = value.strip()
    if not tag:
        raise ValueError("Release tag is empty")
    return tag if tag.startswith("v") else f"v{tag}"


def select_release(releases, override=""):
    """Select the newest non-draft release, optionally by exact tag."""
    candidates = []
    for release in releases:
        if not isinstance(release, dict):
            raise ValueError("Invalid release record")
        if release.get("draft") is True:
            continue
        tag = release.get("tag_name")
        key = version_key(tag) if isinstance(tag, str) else None
        if key is None:
            continue
        if not isinstance(release.get("prerelease"), bool):
            raise ValueError(f"Release {tag} has no prerelease flag")
        candidates.append((key, release))
    if not candidates:
        raise ValueError("No versioned OpenPencil releases found")
    if override:
        tag = normalize_tag(override)
        matches = [pair for pair in candidates if pair[1].get("tag_name") == tag]
        if not matches:
            raise ValueError(f"OpenPencil release not found: {tag}")
        return matches[0][1]
    return max(candidates, key=lambda pair: pair[0])[1]


def tag_commit(tag):
    """Resolve the commit a release tag points to, including annotated tags."""
    refs = {
        f"refs/tags/{tag}": None,
        f"refs/tags/{tag}^{{}}": None,
    }
    try:
        output = subprocess.check_output(
            [
                "git",
                "ls-remote",
                f"{REPOSITORY}.git",
                f"refs/tags/{tag}",
                f"refs/tags/{tag}^{{}}",
            ],
            text=True,
            timeout=60,
        )
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
        raise ValueError(f"Cannot resolve release tag: {tag}") from error
    for line in output.splitlines():
        sha, _, ref = line.partition("\t")
        if ref in refs:
            refs[ref] = sha
    sha = refs[f"refs/tags/{tag}^{{}}"] or refs[f"refs/tags/{tag}"]
    if not FULL_SHA.fullmatch(sha or ""):
        raise ValueError(f"Release tag did not resolve to a commit: {tag}")
    return sha


def github_releases():
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "openpencil_build",
    }
    token = os.getenv("GH_TOKEN") or os.getenv("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    releases = []
    for page in range(1, 11):
        request = Request(
            f"{API}/repos/{UPSTREAM}/releases?per_page=100&page={page}",
            headers=headers,
        )
        try:
            with urlopen(request, timeout=30) as response:
                payload = json.load(response)
        except HTTPError as error:
            raise ValueError(f"Release listing failed (HTTP {error.code})") from error
        if not isinstance(payload, list):
            raise ValueError("Invalid release listing")
        releases.extend(payload)
        if len(payload) < 100:
            return releases
    raise ValueError("Release pagination exceeded the bound")


def release_inputs(release, all_releases):
    tag = release["tag_name"]
    versioned = [
        item
        for item in all_releases
        if item.get("draft") is not True and version_key(item.get("tag_name")) is not None
    ]
    newest_stable = max(
        (item for item in versioned if item.get("prerelease") is False),
        key=lambda item: version_key(item["tag_name"]),
        default=None,
    )
    newest_release = max(versioned, key=lambda item: version_key(item["tag_name"]))
    commit = tag_commit(tag)
    return {
        "repository": REPOSITORY,
        "release_id": release.get("id"),
        "tag": tag,
        "version": tag[1:],
        "commit": commit,
        "prerelease": release["prerelease"],
        "published_at": release.get("published_at"),
        "newest_release": release["id"] == newest_release["id"],
        "newest_stable": newest_stable is not None and release["id"] == newest_stable["id"],
        "archive_url": f"https://codeload.github.com/{UPSTREAM}/tar.gz/{commit}",
        "release_url": f"{REPOSITORY}/releases/tag/{tag}",
    }


def emit(values):
    for key, value in values.items():
        if isinstance(value, bool):
            value = "true" if value else "false"
        print(f"{key}={value}")
    destination = os.getenv("GITHUB_OUTPUT")
    if destination:
        with open(destination, "a", encoding="utf-8") as output:
            for key, value in values.items():
                if isinstance(value, bool):
                    value = "true" if value else "false"
                output.write(f"{key}={value}\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tag", default="", help="Optional release tag override")
    parser.add_argument("--output", default=".build/release.json")
    args = parser.parse_args()

    releases = github_releases()
    release = select_release(releases, args.tag)
    inputs = release_inputs(release, releases)
    target = Path(args.output)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(inputs, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(inputs, indent=2))
    emit(
        {
            "tag": inputs["tag"],
            "version": inputs["version"],
            "commit": inputs["commit"],
            "release_id": inputs["release_id"],
            "prerelease": inputs["prerelease"],
            "newest_release": inputs["newest_release"],
            "newest_stable": inputs["newest_stable"],
            "archive_url": inputs["archive_url"],
        }
    )


if __name__ == "__main__":
    main()
