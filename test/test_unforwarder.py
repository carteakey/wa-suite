import json
import tempfile
import unittest
from pathlib import Path

from unforwarder.unforwarder import (
    IMAGE_EXTENSIONS,
    VIDEO_EXTENSIONS,
    collect_input_paths,
    parse_model_answer,
    process_images,
)


class FakeMessage:
    def __init__(self, content):
        self.content = content


class FakeResponse:
    def __init__(self, content):
        self.message = FakeMessage(content)


class FakeClient:
    def __init__(self, responses):
        self.responses = iter(responses)

    def chat(self, **_kwargs):
        return FakeResponse(next(self.responses))


class UnforwarderTest(unittest.TestCase):
    def test_extensions_and_json_decisions(self):
        self.assertTrue({".png", ".webp"}.issubset(IMAGE_EXTENSIONS))
        self.assertIn(".mp4", VIDEO_EXTENSIONS)
        self.assertEqual(parse_model_answer('{"forwarded": false, "confidence": 0.95}')['forwarded'], False)
        uncertain = parse_model_answer('{"forwarded": false, "confidence": 0.2}')
        self.assertTrue(uncertain['uncertain'])
        self.assertIsNone(parse_model_answer('maybe').get('forwarded'))

    def test_list_file_is_bounded_to_source(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "inside.png").write_bytes(b"fixture")
            outside = root.parent / "outside.png"
            outside.write_bytes(b"fixture")
            try:
                list_file = root / "paths.txt"
                list_file.write_text("inside.png\n../outside.png\n", encoding="utf-8")
                paths = collect_input_paths(root, list_file)
                self.assertEqual([path.name for path in paths], ["inside.png"])
            finally:
                outside.unlink(missing_ok=True)

    def test_dry_run_does_not_move_or_checkpoint(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "photo.png").write_bytes(b"fixture")
            result = process_images(root, dry_run=True, client=FakeClient(['{"forwarded": false, "confidence": 0.9}']))
            self.assertEqual(result['saved'], 1)
            self.assertTrue((root / "photo.png").exists())
            self.assertFalse((root / ".unforwarder_progress.json").exists())

    def test_live_move_is_checkpointed_and_uncertain_goes_to_review(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "personal.jpg").write_bytes(b"fixture")
            (root / "uncertain.webp").write_bytes(b"fixture")
            result = process_images(
                root,
                dry_run=False,
                client=FakeClient([
                    '{"forwarded": false, "confidence": 0.9}',
                    '{"forwarded": false, "confidence": 0.2}',
                ]),
            )
            self.assertEqual(result['saved'], 1)
            self.assertEqual(result['review'], 1)
            self.assertTrue((root / "save" / "personal.jpg").exists())
            self.assertTrue((root / "review-n-delete" / "uncertain.webp").exists())
            checkpoint = json.loads((root / ".unforwarder_progress.json").read_text(encoding="utf-8"))
            self.assertEqual(len(checkpoint['done']), 2)


if __name__ == "__main__":
    unittest.main()
