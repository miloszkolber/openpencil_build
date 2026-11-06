#!/usr/bin/env python3
"""Check or publish the OpenPencil image and its channel tags."""
import argparse
import base64
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import quote, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parent))
from resolve_release import version_key  # noqa: E402

ACCEPT = ", ".join(
    [
        "application/vnd.oci.image.manifest.v1+json",
        "application/vnd.oci.image.index.v1+json",
        "application/vnd.docker.distribution.manifest.v2+json",
        "application/vnd.docker.distribution.manifest.list.v2+json",
    ]
)
DIGEST = re.compile(r"sha256:[a-f0-9]{64}")
PUSH_DIGEST = re.compile(r"digest: (sha256:[a-f0-9]{64}) size:")
GHCR = "https://ghcr.io"


class SafeRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, file, code, message, headers, url):
        redirected = super().redirect_request(request, file, code, message, headers, url)
        if redirected is not None:
            if urlsplit(url).netloc != urlsplit(request.full_url).netloc:
                redirected.remove_header("Authorization")
        return redirected


OPENER = build_opener(SafeRedirect())


def registry_open(request):
    return OPENER.open(request, timeout=30)


def docker(*args):
    result = subprocess.run(
        ["docker", *args],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    if result.returncode != 0:
        raise SystemExit(f"docker {' '.join(args)} failed:\n{result.stdout}")
    return result.stdout


def package_name(image):
    prefix = "ghcr.io/"
    if not image.startswith(prefix):
        raise ValueError(f"Expected a ghcr.io image, got {image}")
    return image[len(prefix) :]


def registry_token(package, scope, actor, token):
    if not token:
        return None
    credentials = base64.b64encode(f"{actor}:{token}".encode()).decode()
    request = Request(
        f"{GHCR}/token?service=ghcr.io&scope=repository:{quote(package, safe='/')}:{scope}",
        headers={"Authorization": f"Basic {credentials}"},
    )
    try:
        with urlopen(request, timeout=30) as response:
            payload = json.load(response)
    except HTTPError as error:
        raise SystemExit(f"GHCR token request failed (HTTP {error.code})") from error
    token_value = payload.get("token") or payload.get("access_token")
    if not isinstance(token_value, str) or not token_value:
        raise SystemExit("GHCR token response had no token")
    return token_value


def registry_manifest(package, tag, actor, token):
    bearer = registry_token(package, "pull", actor, token)
    if bearer is None:
        return None
    request = Request(
        f"{GHCR}/v2/{quote(package, safe='/')}/manifests/{quote(tag, safe=':')}",
        headers={"Authorization": f"Bearer {bearer}", "Accept": ACCEPT},
    )
    try:
        with registry_open(request) as response:
            body = json.load(response)
            digest = response.headers.get("docker-content-digest")
    except HTTPError as error:
        if error.code == 404:
            return None
        raise SystemExit(f"GHCR manifest lookup failed (HTTP {error.code})") from error
    if not isinstance(digest, str) or not DIGEST.fullmatch(digest):
        raise SystemExit("GHCR manifest response had no valid digest")
    return digest, body


def registry_config(package, digest, actor, token):
    bearer = registry_token(package, "pull", actor, token)
    if bearer is None:
        return None
    request = Request(
        f"{GHCR}/v2/{quote(package, safe='/')}/blobs/{digest}",
        headers={"Authorization": f"Bearer {bearer}"},
    )
    try:
        with registry_open(request) as response:
            return json.load(response)
    except HTTPError as error:
        raise SystemExit(f"GHCR blob lookup failed (HTTP {error.code})") from error


def image_labels(package, tag, actor, token):
    manifest = registry_manifest(package, tag, actor, token)
    if manifest is None:
        return None
    _digest, body = manifest
    if isinstance(body.get("manifests"), list):
        matches = [
            item
            for item in body["manifests"]
            if item.get("platform", {}).get("os") == "linux"
            and item.get("platform", {}).get("architecture") == "amd64"
        ]
        if len(matches) != 1:
            raise SystemExit(f"{tag} has no unique linux/amd64 manifest")
        manifest = registry_manifest(package, matches[0]["digest"], actor, token)
        if manifest is None:
            return None
        _digest, body = manifest
    config_digest = body.get("config", {}).get("digest")
    if not isinstance(config_digest, str) or not DIGEST.fullmatch(config_digest):
        raise SystemExit(f"{tag} manifest has no config digest")
    config = registry_config(package, config_digest, actor, token)
    if config is None:
        return None
    labels = config.get("config", {}).get("Labels") or {}
    return labels


def release_is_current(exact_digest, latest_digest, newest_release):
    """Whether the published tags already represent this release."""
    if exact_digest is None:
        return False
    if not newest_release:
        return True
    return latest_digest is not None and latest_digest == exact_digest


def channel_tags(release):
    tags = [release["version"]]
    if release["newest_release"]:
        tags.append("latest")
    return tags


def push(local, reference):
    docker("tag", local, reference)
    output = docker("push", reference)
    print(output, end="" if output.endswith("\n") else "\n")
    match = PUSH_DIGEST.search(output)
    return match.group(1) if match else None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--image", default="ghcr.io/miloszkolber/openpencil")
    parser.add_argument("--local", default="openpencil:local")
    parser.add_argument("--release", default=".build/release.json")
    parser.add_argument("--fingerprint", default=".build/fingerprint.txt")
    parser.add_argument("--output", default=".build/published.json")
    parser.add_argument(
        "--check",
        action="store_true",
        help="Report whether the release tags are already published and exit",
    )
    args = parser.parse_args()

    release = json.loads(Path(args.release).read_text(encoding="utf-8"))
    package = package_name(args.image)
    token = os.getenv("GH_TOKEN") or os.getenv("GITHUB_TOKEN")
    actor = os.getenv("GITHUB_ACTOR", "local")

    if args.check:
        exact = registry_manifest(package, release["version"], actor, token)
        latest = (
            registry_manifest(package, "latest", actor, token)
            if release["newest_release"]
            else None
        )
        current = release_is_current(
            exact[0] if exact else None,
            latest[0] if latest else None,
            release["newest_release"],
        )
        value = "true" if current else "false"
        print(f"published={value}")
        destination = os.getenv("GITHUB_OUTPUT")
        if destination:
            with open(destination, "a", encoding="utf-8") as output:
                output.write(f"published={value}\n")
        return

    fingerprint = Path(args.fingerprint).read_text(encoding="utf-8").strip()

    tags = channel_tags(release)
    if "latest" in tags and token:
        existing = image_labels(package, "latest", actor, token)
        if existing is not None:
            current = existing.get("org.opencontainers.image.version")
            try:
                current_key = version_key(f"v{current}")
            except ValueError as error:
                raise SystemExit("Published latest image has an invalid version") from error
            if current_key is None:
                raise SystemExit("Published latest image has no readable version")
            if current_key > version_key(f"v{release['version']}"):
                print(f"Keeping latest at {current}; {release['version']} is older")
                tags.remove("latest")

    published = {}
    for tag in tags:
        reference = f"{args.image}:{tag}"
        digest = push(args.local, reference)
        remote = registry_manifest(package, tag, actor, token)
        if remote is None:
            raise SystemExit(f"Published tag is not readable: {reference}")
        remote_digest = remote[0]
        if digest and digest != remote_digest:
            raise SystemExit(f"Pushed digest and registry digest differ for {reference}")
        published[tag] = remote_digest
        print(f"{reference} = {remote_digest}")

    labels = image_labels(package, release["version"], actor, token)
    if labels is None:
        raise SystemExit("Published image is not readable")
    expected = {
        "org.opencontainers.image.version": release["version"],
        "io.openpencil-build.upstream.commit": release["commit"],
        "io.openpencil-build.inputs": fingerprint,
    }
    for key, value in expected.items():
        if labels.get(key) != value:
            raise SystemExit(f"Published label {key} is {labels.get(key)!r}, expected {value!r}")

    result = {
        "image": args.image,
        "version": release["version"],
        "tag": release["tag"],
        "commit": release["commit"],
        "fingerprint": fingerprint,
        "tags": published,
    }
    target = Path(args.output)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
