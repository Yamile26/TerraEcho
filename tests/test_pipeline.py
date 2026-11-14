"""End-to-end check on synthetic data. Run: python -m pytest -q  (or python tests/test_pipeline.py)"""
import json
import os
import sys
import tempfile
import wave

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from make_synthetic import make                      # noqa: E402
from terraecho import pipeline as P                  # noqa: E402
from terraecho.render import render                  # noqa: E402
from terraecho.sonify import build_score, dissonance  # noqa: E402


def _run(tmp):
    make(tmp)
    grid = P.Grid(*P.PERU_BBOX, res=0.5)
    df = P.load_firms(tmp)
    years, counts, frp, last_week = P.aggregate(df, grid)
    z_cell = P.anomaly(counts, last_week)
    z_country = P.anomaly(counts.sum(axis=2, keepdims=True), last_week)[:, :, 0]
    return grid, df, years, counts, frp, last_week, z_cell, z_country


def test_end_to_end():
    with tempfile.TemporaryDirectory() as tmp:
        grid, df, years, counts, frp, last_week, z_cell, z_country = _run(tmp)

        assert (df.confidence != "l").all()                       # low confidence dropped
        assert counts.sum() == len(df)                            # nothing lost in gridding
        assert last_week[-1] == (317 - 1) // 7                    # 2026 stops in mid November
        assert np.isnan(z_country[-1, last_week[-1] + 1:]).all()  # future weeks are masked

        peak = slice(32, 39)                                      # around day 250
        z26 = np.nanmean(z_country[-1, peak])
        z_other = np.nanmean(z_country[:-1, peak])
        assert z26 > 1.2, z26                                     # 4x in one of four clusters = 1.75x nationally
        assert abs(z_other) < 1.0, z_other                        # normal years stay near zero

        # the anomaly is located in the right place (Ucayali cluster)
        cell = grid.cell_of(-8.4, -74.5)
        assert np.nanmax(z_cell[-1, peak, cell]) > 2.5
        cusco = grid.cell_of(-13.0, -72.3)
        assert np.nanmax(np.abs(z_cell[-1, peak, cusco])) < 2.5

        score = build_score(2026, years, grid, counts, frp, z_cell, last_week, z_country)
        calm = build_score(2020, years, grid, counts, frp, z_cell, last_week, z_country)
        json.dumps(score)                                         # serialisable
        d26 = max(w["country"]["dissonance"] for w in score["weeks"])
        d20 = np.mean([w["country"]["dissonance"] for w in calm["weeks"][32:39]])
        assert d26 > 0.3 and d20 < 0.1, (d26, d20)
        for w in score["weeks"]:
            for v in w["cells"]:
                assert 0 <= v["gain"] <= 1 and 1 <= v["density"] <= 4
                assert -1 <= v["pan"] <= 1 and v["interval"] in (7, 6, 1)
        assert any(v["alert"] for w in score["weeks"] for v in w["cells"])

        path = os.path.join(tmp, "t.wav")
        secs = render(score, path)
        with wave.open(path) as w:
            assert w.getnchannels() == 2 and w.getnframes() > 0
        assert abs(secs - 0.5 * len(score["weeks"])) < 0.01


def test_dissonance_bounds():
    assert dissonance(-3) == 0 and dissonance(1) == 0 and dissonance(10) == 1
    assert dissonance(float("nan")) == 0


def test_regions():
    try:
        import shapely  # noqa: F401
    except ImportError:
        return
    with tempfile.TemporaryDirectory() as tmp:
        grid, df, years, counts, frp, last_week, *_ = _run(tmp)
        gj = {"type": "FeatureCollection", "features": [
            {"type": "Feature", "properties": {"name": "north"}, "geometry": {
                "type": "Polygon", "coordinates": [[[-81.5, -10], [-68.5, -10], [-68.5, 0], [-81.5, 0], [-81.5, -10]]]}},
            {"type": "Feature", "properties": {"name": "south"}, "geometry": {
                "type": "Polygon", "coordinates": [[[-81.5, -18.5], [-68.5, -18.5], [-68.5, -10], [-81.5, -10], [-81.5, -18.5]]]}}]}
        p = os.path.join(tmp, "r.geojson")
        with open(p, "w") as f:
            json.dump(gj, f)
        names, region = P.load_regions(p, grid)
        rc = P.sum_by_region(counts, region, len(names))
        assert names == ["North", "South"] and rc.sum() == counts.sum()
        z = P.anomaly(rc, last_week)
        assert np.nanmean(z[-1, 32:39, 0]) > np.nanmean(z[-1, 32:39, 1])   # anomaly is in the north


if __name__ == "__main__":
    test_end_to_end(); test_dissonance_bounds(); test_regions(); print("all tests passed")
