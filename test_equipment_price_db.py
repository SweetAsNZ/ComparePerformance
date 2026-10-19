import json
import sqlite3
import tempfile
import unittest
from contextlib import closing
from http.server import ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from typing import Any
from unittest.mock import patch
from urllib.request import urlopen
from urllib.error import HTTPError

from equipment_price_db import ROOT, read_catalogue, read_seed, seed_database
from local_server import LocalHandler


class EquipmentPriceDatabaseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.seed = read_seed()

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=ROOT)
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / "prices.sqlite3"
        self.counts = seed_database(self.path, self.seed)

    def test_every_product_has_a_usd_price_source_and_evidence(self):
        self.assertEqual(self.counts["equipment"], 35)
        catalogue = read_catalogue(self.path)
        self.assertEqual(len(catalogue["references"]), 35)
        for ref in catalogue["references"]:
            self.assertGreater(ref["usd"], 0, ref["model"])
            self.assertTrue(ref["url"].startswith("https://"))
            self.assertEqual(ref["checkedDate"], "2026-10-17")
            self.assertTrue(ref["evidence"], ref["model"])
        with closing(sqlite3.connect(self.path)) as conn:
            self.assertEqual(conn.execute("PRAGMA integrity_check").fetchone()[0], "ok")
            self.assertEqual(conn.execute("PRAGMA foreign_key_check").fetchall(), [])

    def test_gbp_conversion_and_review_only_configuration_are_preserved(self):
        johnson = read_catalogue(self.path, "Johnson")["references"][0]
        self.assertEqual(johnson["amount"], 54.99)
        self.assertEqual(johnson["currency"], "GBP")
        self.assertEqual(johnson["usd"], 73.33)
        self.assertEqual(johnson["fxDate"], "2026-10-16")
        self.assertIn("frankfurter", johnson["fxSource"])
        cerbo = read_catalogue(self.path, "Cerbo")["references"][0]
        self.assertTrue(cerbo["reviewOnly"])
        self.assertIn("MK2", cerbo["note"])

    def test_pdf_inventory_and_owner_report_are_distinct(self):
        fortress = read_catalogue(self.path, "FX-55")["references"][0]
        self.assertEqual(fortress["evidence"][0]["kind"], "pdf_inventory")
        self.assertEqual(fortress["evidence"][0]["boat_model"], "Fountaine Pajot Saona 47")
        ekrano = read_catalogue(self.path, "Ekrano")["references"][0]
        self.assertEqual(ekrano["usd"], 619.65)
        self.assertEqual(ekrano["evidence"][0]["kind"], "owner_report")
        self.assertEqual(ekrano["evidence"][0]["boat_model"], "Excess 12")
        self.assertIn("victronenergy", ekrano["evidence"][0]["source_url"])
        self.assertEqual(len(read_catalogue(self.path)["researchRequirements"]), 12)

    def test_seed_is_idempotent_and_preserves_newer_quotes(self):
        self.assertEqual(seed_database(self.path, self.seed), self.counts)
        with closing(sqlite3.connect(self.path)) as conn, conn:
            conn.execute(
                """INSERT INTO price_quotes(equipment_id,amount,currency,usd_cents,checked_date,fx_date,source_url)
                SELECT id,'600','USD',60000,'2026-10-18','2026-10-16','https://example.com/new-quote'
                FROM equipment WHERE model='Garmin GMI 20'"""
            )
        seed_database(self.path, self.seed)
        ref = read_catalogue(self.path, "GMI 20")["references"][0]
        self.assertEqual(ref["usd"], 600)
        self.assertEqual(ref["checkedDate"], "2026-10-18")
        with closing(sqlite3.connect(self.path)) as conn:
            self.assertEqual(conn.execute("SELECT count(*) FROM price_quotes").fetchone()[0], 36)

    def test_search_is_parameterized_and_missing_database_is_not_created(self):
        self.assertEqual(read_catalogue(self.path, "' OR 1=1 --")["references"], [])
        missing = self.path.parent / "missing.sqlite3"
        with self.assertRaises(sqlite3.OperationalError):
            read_catalogue(missing)
        self.assertFalse(missing.exists())
        self.assertEqual(json.loads(json.dumps(read_catalogue(self.path)))["currency"], "USD")

    def test_http_catalogue_reads_database_and_reports_database_errors(self):
        with ThreadingHTTPServer(("127.0.0.1", 0), LocalHandler) as server:
            thread = Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                def catalogue(search: str = "") -> dict[str, Any]:
                    return read_catalogue(self.path, search)

                with patch("local_server.read_catalogue", side_effect=catalogue):
                    with urlopen(f"http://127.0.0.1:{server.server_port}/api/equipment-prices?q=Johnson") as response:
                        result = json.load(response)
                    self.assertEqual(len(result["references"]), 1)
                    self.assertEqual(result["references"][0]["usd"], 73.33)
                with patch("local_server.read_catalogue", side_effect=sqlite3.OperationalError("missing table")):
                    with self.assertRaises(HTTPError) as failure:
                        urlopen(f"http://127.0.0.1:{server.server_port}/api/equipment-prices")
                    self.assertEqual(failure.exception.code, 503)
                    failure.exception.close()
            finally:
                server.shutdown()
                thread.join()


if __name__ == "__main__":
    unittest.main()
