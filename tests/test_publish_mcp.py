import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from publish_mcp import is_ancestor, moving_tags_allowed  # noqa: E402

CANDIDATE = "a" * 40
PREVIOUS = "b" * 40


class MovingTagTests(unittest.TestCase):
    def test_absent_latest_allows_the_move(self):
        self.assertEqual(moving_tags_allowed(None, CANDIDATE), (True, "no published revision"))

    def test_same_revision_allows_the_move(self):
        self.assertEqual(moving_tags_allowed(CANDIDATE, CANDIDATE), (True, "same revision"))

    def test_descendant_allows_the_move(self):
        calls = []

        def ancestor(older, newer):
            calls.append((older, newer))
            return True

        allowed, reason = moving_tags_allowed(PREVIOUS, CANDIDATE, ancestor)
        self.assertTrue(allowed)
        self.assertIn("descends", reason)
        self.assertEqual(calls, [(PREVIOUS, CANDIDATE)])

    def test_older_candidate_keeps_the_moving_tags(self):
        allowed, reason = moving_tags_allowed(PREVIOUS, CANDIDATE, lambda older, newer: False)
        self.assertFalse(allowed)
        self.assertIn("not a descendant", reason)


class AncestryTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.path = Path(self.directory.name)
        self.git("init", "-q")
        self.git("config", "user.email", "test@example.com")
        self.git("config", "user.name", "Test")

    def tearDown(self):
        self.directory.cleanup()

    def git(self, *args):
        return subprocess.run(
            ["git", *args], cwd=self.path, check=True, text=True, stdout=subprocess.PIPE
        ).stdout.strip()

    def commit(self, message):
        (self.path / "file").write_text(message, encoding="utf-8")
        self.git("add", "file")
        self.git("commit", "-q", "-m", message)
        return self.git("rev-parse", "HEAD")

    def test_ancestor_and_unrelated_history(self):
        older = self.commit("older")
        newer = self.commit("newer")
        self.assertTrue(is_ancestor(older, newer, self.path))
        self.assertFalse(is_ancestor(newer, older, self.path))

        self.git("checkout", "-q", "-b", "side", older)
        side = self.commit("side")
        self.assertFalse(is_ancestor(newer, side, self.path))
        self.assertTrue(is_ancestor(older, side, self.path))


if __name__ == "__main__":
    unittest.main()
