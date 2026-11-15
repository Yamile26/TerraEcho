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
        assert names == ["north", "south"] and rc.sum() == counts.sum()
        z = P.anomaly(rc, last_week)
        assert np.nanmean(z[-1, 32:39, 0]) > np.nanmean(z[-1, 32:39, 1])   # anomaly is in the north




def test_missing_year_is_masked():
    """A missing yearly file must not count as a year with zero fires."""
    with tempfile.TemporaryDirectory() as tmp:
        make(tmp)
        os.remove(os.path.join(tmp, "synthetic_2020.csv"))
        os.remove(os.path.join(tmp, "synthetic_2023.csv"))
        grid = P.Grid(*P.PERU_BBOX, res=0.5)
        years, counts, frp, last_week = P.aggregate(P.load_firms(tmp), grid)
        assert last_week[list(years).index(2020)] == -1
        zc = P.anomaly(counts.sum(axis=2, keepdims=True), last_week)[:, :, 0]
        assert np.isnan(zc[list(years).index(2020)]).all()
        assert abs(np.nanmean(zc[list(years).index(2019), 32:39])) < 1.0   # normal year stays normal
        score = build_score(2026, years, grid, counts, frp, P.anomaly(counts, last_week), last_week, zc)
        assert 2020 not in score["meta"]["baseline_years"] and 2023 not in score["meta"]["baseline_years"]


def test_frames_colour_layers():
    """Each aerosol colour must land in its own layer, and position must map to pitch and time."""
    from PIL import Image
    from terraecho import frames as F
    img = np.zeros((100, 200, 3), dtype=np.uint8)
    img[5:25, 10:40] = (210, 94, 69)       # black carbon, top left
    img[70:95, 150:190] = (83, 220, 52)    # sulfate, bottom right
    img[40:60, 90:110] = (193, 154, 220)   # dust, centre
    with tempfile.TemporaryDirectory() as tmp:
        p = os.path.join(tmp, "f.png")
        Image.fromarray(img).save(p)
        s = F.scan(p, n_steps=20)
        g = lambda layer: np.array([st["layers"][layer]["gain"] for st in s["steps"]])
        assert g("black_carbon").argmax() < 5 and g("sulfate").argmax() > 14 and 8 <= g("dust").argmax() <= 11
        assert g("sea_salt").max() == 0
        bc = s["steps"][int(g("black_carbon").argmax())]["layers"]["black_carbon"]
        su = s["steps"][int(g("sulfate").argmax())]["layers"]["sulfate"]
        assert bc["height"] > 0.7 and su["height"] < 0.3          # top of frame = high
        assert F.render(s, os.path.join(tmp, "f.wav")) > 0


def test_nrt_overlap_and_static_sources():
    """NRT rows must not double count SP dates, and NRT hits on a known volcano are dropped."""
    import pandas as pd
    with tempfile.TemporaryDirectory() as tmp:
        base = dict(bright_ti4=330, acq_time="1800", satellite="N", instrument="VIIRS",
                    confidence="n", frp=5.0, daynight="D")
        sp = pd.DataFrame([
            dict(latitude=-8.0, longitude=-74.0, acq_date="2026-03-01", version="2", type=0, **base),
            dict(latitude=-15.787, longitude=-71.857, acq_date="2026-03-01", version="2", type=1, **base),  # volcano
        ])
        nrt = pd.DataFrame([
            dict(latitude=-8.001, longitude=-74.001, acq_date="2026-03-01", version="2.0NRT", **base),  # same day as SP
            dict(latitude=-8.0, longitude=-74.0, acq_date="2026-09-01", version="2.0NRT", **base),      # new fire
            dict(latitude=-15.79, longitude=-71.86, acq_date="2026-09-01", version="2.0NRT", **base),   # volcano again
        ])
        sp.to_csv(os.path.join(tmp, "sp.csv"), index=False)
        nrt.to_csv(os.path.join(tmp, "nrt.csv"), index=False)
        df = P.load_firms(tmp)
        assert len(df) == 2, df
        assert sorted(df.acq_date.dt.strftime("%Y-%m-%d")) == ["2026-03-01", "2026-09-01"]
        assert (df.latitude > -9).all()                      # nothing left at the volcano


if __name__ == "__main__":
    test_end_to_end(); test_dissonance_bounds(); test_regions(); test_missing_year_is_masked(); test_frames_colour_layers(); test_nrt_overlap_and_static_sources(); print("all tests passed")
