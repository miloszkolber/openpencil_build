import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("publish", ROOT / "scripts" / "publish.py")
publish = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publish)


def release(version="0.17.0-beta.2", newest_release=True):
    return {
        "version": version,
        "tag": f"v{version}",
        "newest_release": newest_release,
    }


class ChannelTagTests(unittest.TestCase):
    def test_newest_prerelease_publishes_version_and_latest(self):
        self.assertEqual(
            publish.channel_tags(release()),
            ["0.17.0-beta.2", "latest"],
        )

    def test_newest_stable_publishes_version_and_latest(self):
        self.assertEqual(
            publish.channel_tags(release("0.17.0")),
            ["0.17.0", "latest"],
        )

    def test_manual_older_release_publishes_only_its_version(self):
        self.assertEqual(
            publish.channel_tags(release("0.16.0", newest_release=False)),
            ["0.16.0"],
        )


class CurrentReleaseTests(unittest.TestCase):
    digest = "sha256:" + "a" * 64
    other = "sha256:" + "b" * 64

    def test_newest_release_is_current_only_when_latest_matches(self):
        self.assertTrue(publish.release_is_current(self.digest, self.digest, True))
        self.assertFalse(publish.release_is_current(self.digest, self.other, True))
        self.assertFalse(publish.release_is_current(self.digest, None, True))
        self.assertFalse(publish.release_is_current(None, self.digest, True))

    def test_older_release_is_current_when_its_version_exists(self):
        self.assertTrue(publish.release_is_current(self.digest, self.other, False))
        self.assertFalse(publish.release_is_current(None, self.digest, False))


class PushDigestTests(unittest.TestCase):
    def test_reads_the_digest_from_docker_push(self):
        output = "0.17.0-beta.2: digest: sha256:" + "a" * 64 + " size: 1234\n"
        match = publish.PUSH_DIGEST.search(output)
        self.assertIsNotNone(match)
        self.assertEqual(match.group(1), "sha256:" + "a" * 64)


class PackageTests(unittest.TestCase):
    def test_package_name_requires_ghcr(self):
        self.assertEqual(
            publish.package_name("ghcr.io/miloszkolber/openpencil"),
            "miloszkolber/openpencil",
        )
        with self.assertRaises(ValueError):
            publish.package_name("docker.io/miloszkolber/openpencil")


if __name__ == "__main__":
    unittest.main()
