import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("bases", ROOT / "scripts" / "bases.py")
bases = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bases)


class ParseTests(unittest.TestCase):
    def test_reads_external_images_and_skips_stages(self):
        text = "\n".join(
            [
                "# syntax=docker/dockerfile:1",
                "FROM --platform=$BUILDPLATFORM oven/bun:1.4.4 AS bun",
                "FROM --platform=$BUILDPLATFORM mcr.microsoft.com/playwright:v1.63.0-noble AS build",
                "COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun",
                "FROM node:22-bookworm-slim",
                "FROM build AS final",
            ]
        )
        self.assertEqual(
            bases.parse_from_lines(text),
            [
                "oven/bun:1.4.4",
                "mcr.microsoft.com/playwright:v1.63.0-noble",
                "node:22-bookworm-slim",
            ],
        )

    def test_ignores_scratch(self):
        self.assertEqual(bases.parse_from_lines("FROM scratch\n"), [])


class RewriteTests(unittest.TestCase):
    def test_preserves_platform_and_stage(self):
        text = "FROM --platform=$BUILDPLATFORM oven/bun:1.4.4 AS bun\n"
        digest = "sha256:" + "a" * 64
        rewritten = bases.rewrite(text, {"oven/bun:1.4.4": digest})
        self.assertEqual(
            rewritten,
            f"FROM --platform=$BUILDPLATFORM oven/bun:1.4.4@{digest} AS bun\n",
        )

    def test_does_not_duplicate_an_existing_digest(self):
        digest = "sha256:" + "a" * 64
        text = f"FROM node@sha256:{'a' * 64}\n"
        self.assertEqual(bases.rewrite(text, {f"node@sha256:{'a' * 64}": digest}), text)


if __name__ == "__main__":
    unittest.main()
