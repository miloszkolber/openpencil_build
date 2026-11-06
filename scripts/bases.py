#!/usr/bin/env python3
"""Resolve linux/amd64 digests for Dockerfile base images and rewrite them."""
import argparse
import json
import re
import subprocess
from pathlib import Path

FROM = re.compile(
    r"^FROM\s+(?P<platform>--platform=\S+\s+)?(?P<image>\S+)"
    r"(?:\s+AS\s+(?P<stage>\S+))?\s*$",
    re.IGNORECASE,
)
DIGEST = re.compile(r"@sha256:[a-f0-9]{64}$")
PLATFORM = {"os": "linux", "architecture": "amd64"}


def parse_from_lines(text):
    """Return the external base-image references in a Dockerfile."""
    images = []
    stages = set()
    for line in text.splitlines():
        match = FROM.match(line.strip())
        if match is None:
            continue
        image = match.group("image")
        if image.lower() == "scratch":
            continue
        if image.lower() in stages:
            continue
        images.append(image)
        if match.group("stage"):
            stages.add(match.group("stage").lower())
    return images


def resolve(image):
    """Return the linux/amd64 manifest digest for an image reference."""
    try:
        output = subprocess.check_output(
            [
                "docker",
                "buildx",
                "imagetools",
                "inspect",
                image,
                "--format",
                "{{json .Manifest}}",
            ],
            text=True,
            timeout=120,
        )
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
        raise ValueError(f"Cannot resolve base image: {image}") from error
    manifest = json.loads(output)
    manifests = manifest.get("manifests")
    if isinstance(manifests, list):
        matches = [
            item
            for item in manifests
            if item.get("platform", {}).get("os") == PLATFORM["os"]
            and item.get("platform", {}).get("architecture") == PLATFORM["architecture"]
        ]
        if len(matches) != 1:
            raise ValueError(f"Base image has no unique linux/amd64 manifest: {image}")
        digest = matches[0].get("digest")
    else:
        digest = manifest.get("digest")
    if not isinstance(digest, str) or not re.fullmatch(r"sha256:[a-f0-9]{64}", digest):
        raise ValueError(f"Base image has an invalid manifest digest: {image}")
    return digest


def rewrite(text, references):
    """Replace tag references with resolved digests, preserving other FROM text."""
    lines = []
    for line in text.splitlines():
        match = FROM.match(line.strip())
        if match is None:
            lines.append(line)
            continue
        image = match.group("image")
        digest = references.get(image)
        if digest is None:
            lines.append(line)
            continue
        reference = f"{image}@{digest}" if not DIGEST.search(image) else image
        platform = match.group("platform") or ""
        stage = match.group("stage")
        lines.append(
            f"FROM {platform}{reference}" + (f" AS {stage}" if stage else "")
        )
    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dockerfile", default="cloud/Dockerfile")
    parser.add_argument("--output", default=".build/bases.json")
    parser.add_argument("--rewrite", default=".build/Dockerfile")
    args = parser.parse_args()

    source = Path(args.dockerfile)
    text = source.read_text(encoding="utf-8")
    images = parse_from_lines(text)
    if not images:
        raise SystemExit("No external base images found")
    references = {}
    entries = []
    for image in images:
        digest = resolve(image)
        references[image] = digest
        entries.append({"image": image, "digest": digest})
    result = {
        "dockerfile": str(source),
        "platform": "linux/amd64",
        "images": entries,
    }
    target = Path(args.output)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    if args.rewrite:
        rewritten = Path(args.rewrite)
        rewritten.parent.mkdir(parents=True, exist_ok=True)
        rewritten.write_text(rewrite(text, references), encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
