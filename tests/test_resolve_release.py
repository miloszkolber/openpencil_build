import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "resolve_release", ROOT / "scripts" / "resolve_release.py"
)
resolve_release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(resolve_release)


def release(tag, prerelease=False, draft=False, identifier=None):
    return {
        "id": identifier or tag,
        "tag_name": tag,
        "prerelease": prerelease,
        "draft": draft,
    }


class VersionKeyTests(unittest.TestCase):
    def test_prerelease_orders_below_stable(self):
        self.assertGreater(
            resolve_release.version_key("v1.0.0"),
            resolve_release.version_key("v1.0.0-beta.2"),
        )

    def test_numeric_prerelease_orders_numerically(self):
        self.assertGreater(
            resolve_release.version_key("v1.0.0-beta.10"),
            resolve_release.version_key("v1.0.0-beta.2"),
        )

    def test_newer_prerelease_orders_above_older_stable(self):
        self.assertGreater(
            resolve_release.version_key("v0.17.0-beta.2"),
            resolve_release.version_key("v0.16.0"),
        )

    def test_alpha_orders_below_beta(self):
        self.assertLess(
            resolve_release.version_key("v1.0.0-alpha.1"),
            resolve_release.version_key("v1.0.0-beta.1"),
        )

    def test_non_versioned_tags_are_ignored(self):
        for tag in ["canary", "v1.0", "v1.0.0+build"]:
            self.assertIsNone(resolve_release.version_key(tag), tag)

    def test_malformed_prerelease_fails_closed(self):
        with self.assertRaises(ValueError):
            resolve_release.version_key("v1.0.0-01")


class SelectReleaseTests(unittest.TestCase):
    def test_newest_release_includes_prereleases(self):
        releases = [
            release("v0.16.0", identifier="1"),
            release("v0.17.0-beta.2", prerelease=True, identifier="2"),
        ]
        selected = resolve_release.select_release(releases)
        self.assertEqual(selected["tag_name"], "v0.17.0-beta.2")

    def test_drafts_and_non_versioned_releases_are_ignored(self):
        releases = [
            release("v0.16.0", identifier="1"),
            release("v0.18.0", draft=True, identifier="2"),
            release("canary", prerelease=True, identifier="3"),
        ]
        selected = resolve_release.select_release(releases)
        self.assertEqual(selected["tag_name"], "v0.16.0")

    def test_override_accepts_version_or_tag(self):
        releases = [
            release("v0.16.0", identifier="1"),
            release("v0.17.0-beta.2", prerelease=True, identifier="2"),
        ]
        for value in ["0.17.0-beta.2", "v0.17.0-beta.2"]:
            selected = resolve_release.select_release(releases, value)
            self.assertEqual(selected["tag_name"], "v0.17.0-beta.2")

    def test_unknown_override_fails(self):
        releases = [release("v0.16.0", identifier="1")]
        with self.assertRaises(ValueError):
            resolve_release.select_release(releases, "v0.17.0")

    def test_no_versioned_releases_fails(self):
        with self.assertRaises(ValueError):
            resolve_release.select_release([release("canary", prerelease=True)])


if __name__ == "__main__":
    unittest.main()
