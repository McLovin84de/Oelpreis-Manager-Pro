import importlib.util
import os
import tempfile
import unittest
from pathlib import Path

import pandas as pd


TEMP_DIR = tempfile.TemporaryDirectory()
os.environ["OEL_EXPORT_BASE_DIR"] = TEMP_DIR.name
os.environ["OEL_PROJECT_DIR"] = TEMP_DIR.name
module_path = Path(__file__).with_name("oel_json_export_v3.py")
spec = importlib.util.spec_from_file_location("oel_json_export_v3", module_path)
exporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exporter)


class CategoryDetectionTests(unittest.TestCase):
    def export_one(self, **values):
        row = {
            "ArtikelNrOrder": "OEL-999",
            "ArtikelNr": "OEL-999",
            "HArtNr": "TEST-999",
            "Hersteller": "Test",
            "Bezeichnung": "Motoröl 5L Standard 5W-40",
            "Bemerkungen": "",
            "nettopreislieferant": "10,00",
            "vk1": "87,50",
        }
        row.update(values)
        return exporter.export_json(pd.DataFrame([row]))["daten"][0]

    def test_explicit_wap_categories_win(self):
        self.assertEqual(
            exporter.detect_category("Motoröl 5L Longlife/Spezial 5W-30", "Porsche C30"),
            "Longlife/Spezial",
        )
        self.assertEqual(
            exporter.detect_category("Motoröl Fassware Standard 10W-40", "BMW Spezialölliste"),
            "Standard",
        )
        self.assertEqual(exporter.detect_category("Motoröl 20L Standart 5W-40", "Porsche A40"), "Standard")

    def test_porsche_or_rs_fragment_is_not_automatically_premium(self):
        self.assertEqual(
            exporter.detect_category("Motoröl 5L", "Porsche C30, BMW LL-04"),
            "Longlife/Spezial",
        )
        self.assertEqual(exporter.detect_category("Motoröl 5L", "Herstellertext mit rs"), "")

    def test_explicit_high_performance_and_unknown_cases(self):
        self.assertEqual(
            exporter.detect_category("Motoröl 5L Premium/Hochleistung 0W-20", "ACEA C5"),
            "Premium/Hochleistung",
        )
        self.assertEqual(exporter.detect_category("Motoröl 5L", "API SN"), "")

    def test_historical_special_stock_keeps_confirmed_sale_price_without_margin(self):
        item = self.export_one(
            ArtikelNrOrder="OEL-037",
            ArtikelNr="OEL-037",
            HArtNr="08232-P99L2LHE",
            Bezeichnung="Motoröl Fassware Standard 10W-40",
            nettopreislieferant="0,00",
            vk1="17,50",
        )
        self.assertEqual(item["vk1"], 17.5)
        self.assertTrue(item["preiswirksam"])
        self.assertEqual(item["status"], "OK")
        self.assertEqual(item["sonderbestand_status"], exporter.HISTORICAL_SPECIAL_STOCK_STATUS)
        self.assertIsNone(item["rohertrag"])
        self.assertIsNone(item["marge_prozent"])

    def test_zero_cost_without_special_stock_is_review_and_not_price_effective(self):
        item = self.export_one(nettopreislieferant="0,00", vk1="87,50")
        self.assertEqual(item["status"], "REVIEW")
        self.assertEqual(item["unvollstaendig"], "EK_NICHT_VERGLEICHBAR")
        self.assertFalse(item["preiswirksam"])
        self.assertIsNone(item["marge_prozent"])

    def test_unknown_category_preserves_wap_price_without_price_effect(self):
        item = self.export_one(Bezeichnung="Motoröl 5L", Bemerkungen="API SN", vk1="19,90")
        self.assertEqual(item["status"], "REVIEW")
        self.assertEqual(item["unvollstaendig"], "KATEGORIE_UNKLAR")
        self.assertEqual(item["vk1"], 19.9)
        self.assertFalse(item["preiswirksam"])


if __name__ == "__main__":
    unittest.main()
