#!/usr/bin/env python3
"""Compute a stable fingerprint of the release, bases and build recipe."""
import argparse
import hashlib
import json
from pathlib import Path


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode("utf-8")


def fingerprint(paths):
    digest = hashlib.sha256()
    for name, path in paths:
        digest.update(name.encode("utf-8"))
        digest.update(b"\0")
        data = Path(path).read_bytes()
        if name.endswith(".json"):
            data = canonical(json.loads(data))
        digest.update(data)
        digest.update(b"\0")
    return digest.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--release", required=True)
    parser.add_argument("--bases", required=True)
    parser.add_argument("--dockerfile", required=True)
    parser.add_argument("--smoke", required=True)
    parser.add_argument("--output", default=".build/fingerprint.txt")
    args = parser.parse_args()

    value = fingerprint(
        [
            ("release.json", args.release),
            ("bases.json", args.bases),
            ("Dockerfile", args.dockerfile),
            ("smoke.compose.yml", args.smoke),
        ]
    )
    target = Path(args.output)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(value + "\n", encoding="utf-8")
    print(value)


if __name__ == "__main__":
    main()
