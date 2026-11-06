import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("publish", ROOT / "scripts" / "publish.py")
publish = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publish)


def release(version="0.17.0-beta.2", prerelease=True, newest_release=True, newest_stable=False):
    return {
        "version": version,
        "tag": f"v{version}",
        "prerelease": prerelease,
        "newest_release": newest_release,
        "newest_stable": newest_stable,
    }


class ChannelTagTests(unittest.TestCase):
    def test_newest_prerelease_publishes_version_and_next(self):
        self.assertEqual(
            publish.channel_tags(release()),
            ["0.17.0-beta.2", "next"],
        )

    def test_newest_stable_publishes_version_and_latest(self):
        self.assertEqual(
            publish.channel_tags(
                release("0.17.0", prerelease=False, newest_stable=True)
            ),
            ["0.17.0", "latest"],
        )

    def test_manual_older_release_publishes_only_its_version(self):
        self.assertEqual(
            publish.channel_tags(
                release("0.16.0", prerelease=False, newest_release=False)
            ),
            ["0.16.0"],
        )


class PushDigestTests(unittest.TestCase):
    def test_reads_the_digest_from_docker_push(self):
        output = "0.17.0-beta.2: digest: sha256:" + "a" * 64 + " size: 1234\n"
        match = publish.PUSH_DIGEST.search(output)
        self.assertIsNotNone(match)
        self.assertEqual(match.group(1), "sha256:" + "a" * 64)


class PackageTests(unittest.TestCase):
    def test_package_name_requires_ghcr(self):
        self.assertEqual(
            publish.package_name("ghcr.io/miloszkolber/openpencil-cloud"),
            "miloszkolber/openpencil-cloud",
        )
        with self.assertRaises(ValueError):
            publish.package_name("docker.io/miloszkolber/openpencil-cloud")


if __name__ == "__main__":
    unittest.main()
