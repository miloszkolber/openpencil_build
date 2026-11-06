import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "fingerprint", ROOT / "scripts" / "fingerprint.py"
)
fingerprint = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fingerprint)


class FingerprintTests(unittest.TestCase):
    def test_is_stable_across_json_key_order(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            dockerfile = root / "Dockerfile"
            smoke = root / "smoke.yml"
            dockerfile.write_text("FROM scratch\n", encoding="utf-8")
            smoke.write_text("services: {}\n", encoding="utf-8")
            first = root / "first.json"
            second = root / "second.json"
            first.write_text(json.dumps({"b": 2, "a": 1}), encoding="utf-8")
            second.write_text(json.dumps({"a": 1, "b": 2}), encoding="utf-8")
            common = [
                ("bases.json", second),
                ("Dockerfile", dockerfile),
                ("smoke.compose.yml", smoke),
            ]
            values = fingerprint.fingerprint([("release.json", first), *common])
            self.assertEqual(len(values), 64)
            self.assertEqual(
                values,
                fingerprint.fingerprint([("release.json", second), *common]),
            )

    def test_changes_when_a_build_input_changes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            release = root / "release.json"
            bases = root / "bases.json"
            dockerfile = root / "Dockerfile"
            smoke = root / "smoke.yml"
            release.write_text('{"version": "1.0.0"}', encoding="utf-8")
            bases.write_text('{"images": []}', encoding="utf-8")
            dockerfile.write_text("FROM scratch\n", encoding="utf-8")
            smoke.write_text("services: {}\n", encoding="utf-8")
            inputs = [
                ("release.json", release),
                ("bases.json", bases),
                ("Dockerfile", dockerfile),
                ("smoke.compose.yml", smoke),
            ]
            before = fingerprint.fingerprint(inputs)
            dockerfile.write_text("FROM busybox\n", encoding="utf-8")
            self.assertNotEqual(before, fingerprint.fingerprint(inputs))


if __name__ == "__main__":
    unittest.main()
