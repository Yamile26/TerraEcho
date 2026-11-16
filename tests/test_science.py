"""Scientific contracts and actual shipped-snapshot reconciliation.
Synthetic fixtures are tests only; never published as NASA observations.
"""

import datetime as dt
import gzip
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
import numpy as np
import pandas as pd
from terraecho.science import (
    assign_regions,
    bin_dates,
    valid_weeks,
    robust_scores,
    load_archives,
)
from terraecho.frames import layer_masks, scan

ROOT = Path(__file__).resolve().parents[1]


class ScienceContracts(unittest.TestCase):
    def test_missing_observations_are_not_product_outages(self):
        valid = valid_weeks([2025], ["2024-07-10"])
        self.assertTrue(valid.all())
        valid = valid_weeks([2024], ["2024-07-10"])
        self.assertFalse(valid[0, 27])
        self.assertFalse(valid_weeks([2012], [])[0, 0])

    def test_final_bin_obeys_leap_year(self):
        a, b = bin_dates(2024, 51)
        self.assertEqual((b - a).days + 1, 9)
        a, b = bin_dates(2025, 51)
        self.assertEqual((b - a).days + 1, 8)

    def test_point_assignment_reconciles_borders_and_excludes_outside(self):
        f = lambda name, coords: {
            "properties": {"shapeName": name},
            "geometry": {"type": "Polygon", "coordinates": [coords]},
        }
        features = [
            f("large", [[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]]),
            f("small", [[1, 1], [2, 1], [2, 2], [1, 2], [1, 1]]),
        ]
        d = pd.DataFrame({"longitude": [1.5, 3, 6, 0], "latitude": [1.5, 3, 6, 2]})
        r, _, amb = assign_regions(d, features)
        self.assertEqual(r.tolist(), [1, 0, -1, 0])
        self.assertEqual(amb, 1)

    def test_gap_values_cannot_leak_into_neighboring_baseline(self):
        years = np.arange(2012, 2026)
        counts = np.full((14, 52, 1), 5.0)
        valid = np.ones((14, 52), bool)
        valid[0, 10] = False
        a = robust_scores(counts, valid, years)
        counts[0, 10, 0] = 1e12
        b = robust_scores(counts, valid, years)
        np.testing.assert_allclose(a, b, equal_nan=True)
        self.assertTrue(np.isnan(b[0, 10, 0]))

    def test_sp_loader_preserves_unknown_frp_and_nonidentical_records(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "data/raw").mkdir(parents=True)
            p = root / "data/raw/viirs-snpp_2025_Peru.csv"
            p.write_text(
                "latitude,longitude,acq_date,acq_time,frp,version,type,satellite,confidence\n-10,-75,2025-08-01,1230,,2,0,N,n\n-10,-75,2025-08-01,1230,8.1,2,0,N,n\n"
            )
            manifest = {
                "entries": [
                    {
                        "year": 2025,
                        "http_status": 200,
                        "sha256": hashlib.sha256(p.read_bytes()).hexdigest(),
                    }
                ]
            }
            d, qa = load_archives(root, manifest)
            self.assertEqual(len(d), 2)
            self.assertEqual(int(d.frp.isna().sum()), 1)
            self.assertEqual(qa[0]["identical_duplicates_removed"], 0)

    def test_all_four_official_legend_centers_survive_layer_thresholds(self):
        # Exact RGB samples from the supplied official legend; not atmospheric truth.
        samples = (
            np.array(
                [[(210, 94, 69), (193, 154, 220), (133, 170, 169), (83, 220, 52)]],
                dtype=float,
            )
            / 255
        )
        masks = layer_masks(samples)
        for i, k in enumerate(["black_carbon", "dust", "sea_salt", "sulfate"]):
            self.assertGreater(masks[k][0, i], 0)
        candidate = np.array([[(61, 75, 55)]], dtype=float) / 255
        self.assertEqual(layer_masks(candidate)["sulfate"][0, 0], 0)

    def test_invalid_crop_and_empty_scan_bands_rejected(self):
        image = str(ROOT / "data/eic/Aerosols_2025-08-19T20_00_00_1920x1080.png")
        for crop in [(0, 0, 0, 1), (-1, 0, 1, 1), (0, 0, 0.001, 0.001)]:
            with self.assertRaises(ValueError):
                scan(image, 104, crop)

    def test_real_shipped_archive_reconciles_all_departments_and_hashes(self):
        catalog = json.loads((ROOT / "data/scores/catalog.json").read_text())
        for entry in catalog["entries"]:
            if entry["quality"] != "reprocessed-source-archive":
                continue
            raw = gzip.decompress(
                (
                    ROOT / f"data/scores/verified/terraecho_{entry['year']}.json.gz"
                ).read_bytes()
            )
            self.assertEqual(hashlib.sha256(raw).hexdigest(), entry["scoreSha256"])
            d = json.loads(raw)
            self.assertNotIn(2026, d["meta"]["baseline_years"])
            for w in d["weeks"]:
                self.assertEqual(
                    w["country"]["count"], sum(r["count"] for r in w["regions"])
                )
                if w["data_gap"]:
                    self.assertEqual(w["cells"], [])
                    self.assertIsNone(w["country"]["z"])
                else:
                    for r in w["regions"]:
                        self.assertEqual(
                            r["count"],
                            sum(
                                c["count"]
                                for c in w["cells"]
                                if c["region"] == r["name"]
                            ),
                        )


if __name__ == "__main__":
    unittest.main()
