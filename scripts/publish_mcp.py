#!/usr/bin/env python3
"""Publish the checked MCP bridge image without moving its tags backwards."""
import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from publish import image_labels, package_name, push  # noqa: E402

SHA = __import__("re").compile(r"[0-9a-f]{40}$")
VERSION_TAG = "0.1.0"


def is_ancestor(older, newer, directory=None):
    """Whether the published commit is an ancestor of the candidate."""
    result = subprocess.run(
        ["git", "merge-base", "--is-ancestor", older, newer],
        cwd=directory,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return result.returncode == 0


def moving_tags_allowed(previous, candidate, ancestor_check=is_ancestor):
    """Whether the moving tags may point at the candidate, and why."""
    if previous is None:
        return True, "no published revision"
    if previous == candidate:
        return True, "same revision"
    if ancestor_check(previous, candidate):
        return True, "candidate descends from the published revision"
    return False, "candidate is not a descendant of the published revision"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--image", default="ghcr.io/miloszkolber/openpencil-mcp")
    parser.add_argument("--local", default="openpencil-mcp:local")
    parser.add_argument("--sha", required=True)
    parser.add_argument("--version", default=VERSION_TAG)
    parser.add_argument("--output", default=".build/mcp-published.json")
    parser.add_argument(
        "--check",
        action="store_true",
        help="Report whether the moving tags may move and exit without pushing",
    )
    args = parser.parse_args()

    candidate = args.sha.strip()
    if not SHA.fullmatch(candidate):
        raise SystemExit(f"Expected a full commit SHA, got {candidate!r}")
    package = package_name(args.image)
    token = os.getenv("GH_TOKEN") or os.getenv("GITHUB_TOKEN")
    actor = os.getenv("GITHUB_ACTOR", "local")

    labels = image_labels(package, "latest", actor, token)
    previous = labels.get("org.opencontainers.image.revision") if labels else None
    if labels is not None and not isinstance(previous, str):
        raise SystemExit("Published latest image has no revision label")
    allowed, reason = moving_tags_allowed(previous, candidate)
    if args.check:
        print(json.dumps({"sha": candidate, "previous": previous, "moved": allowed, "reason": reason}))
        return

    published = {}
    immutable = f"sha-{candidate[:12]}"
    digest = push(args.local, f"{args.image}:{immutable}")
    remote = image_labels(package, immutable, actor, token)
    if remote is None:
        raise SystemExit(f"Published tag is not readable: {args.image}:{immutable}")
    if remote.get("org.opencontainers.image.revision") != candidate:
        raise SystemExit(f"Published {immutable} does not carry commit {candidate}")
    published[immutable] = digest or "pushed"

    moving = []
    if allowed:
        moving = ["latest", args.version]
        for tag in moving:
            reference = f"{args.image}:{tag}"
            moved = push(args.local, reference)
            published[tag] = moved or "pushed"
            published_labels = image_labels(package, tag, actor, token)
            if published_labels is None:
                raise SystemExit(f"Published tag is not readable: {reference}")
            if published_labels.get("org.opencontainers.image.revision") != candidate:
                raise SystemExit(f"Published {reference} does not carry commit {candidate}")
    else:
        print(f"Keeping moving tags at {previous}: {reason}")

    result = {
        "image": args.image,
        "sha": candidate,
        "version": args.version,
        "previous": previous,
        "moved": bool(moving),
        "reason": reason,
        "tags": published,
    }
    target = Path(args.output)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))
    destination = os.getenv("GITHUB_OUTPUT")
    if destination:
        with open(destination, "a", encoding="utf-8") as output:
            output.write(f"moved={'true' if moving else 'false'}\n")
            output.write(f"immutable={immutable}\n")


if __name__ == "__main__":
    main()
