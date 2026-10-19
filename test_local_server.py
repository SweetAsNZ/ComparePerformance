import tempfile
import unittest
from pathlib import Path

from local_server import PROJECT_ROOT, find_photos, resolve_photo


class LocalPhotoTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=PROJECT_ROOT)
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.boat = self.root / "Boats" / "Test boat"
        (self.boat / "Photos").mkdir(parents=True)
        (self.boat / "Inventory.pdf").write_bytes(b"test pdf")
        (self.boat / "Photos" / "hull.jpg").write_bytes(b"test photo")
        (self.boat / "Photos" / "cabin.jpg").write_bytes(b"test photo")

    def test_pdf_matches_name_and_size_and_selects_exterior_subfolder_photo(self):
        result = find_photos(self.root, "Inventory.pdf", 8, {})
        self.assertEqual(len(result["photos"]), 2)
        self.assertIn("hull.jpg", result["selected"] or "")
        with self.assertRaises(FileNotFoundError):
            find_photos(self.root, "Inventory.pdf", 9, {})

    def test_verified_preference_selects_numbered_photo(self):
        (self.boat / "Photos" / "2.jpg").write_bytes(b"test photo")
        result = find_photos(self.root, "Inventory.pdf", 8, {"Boats/Test boat": "Photos/2.jpg"})
        self.assertIn("2.jpg", result["selected"] or "")

    def test_unknown_numbered_photos_are_not_assumed_to_be_exterior(self):
        (self.boat / "Photos" / "hull.jpg").rename(self.boat / "Photos" / "3.jpg")
        result = find_photos(self.root, "Inventory.pdf", 8, {})
        self.assertIsNone(result["selected"])
        self.assertEqual(len(result["photos"]), 2)

    def test_duplicate_pdf_folders_are_rejected(self):
        other = self.root / "Another boat"
        other.mkdir()
        (other / "Inventory.pdf").write_bytes(b"test pdf")
        with self.assertRaisesRegex(ValueError, "Multiple local folders"):
            find_photos(self.root, "Inventory.pdf", 8, {})

    def test_photo_access_rejects_escape_and_non_images(self):
        self.assertTrue(resolve_photo(self.root, "Boats/Test boat/Photos/hull.jpg").is_file())
        with self.assertRaises(ValueError):
            resolve_photo(self.root, "../outside.jpg")
        with self.assertRaises(ValueError):
            resolve_photo(self.root, "Boats/Test boat/Inventory.pdf")
        with self.assertRaises(ValueError):
            find_photos(self.root, "../Inventory.pdf", 8, {})


if __name__ == "__main__":
    unittest.main()
