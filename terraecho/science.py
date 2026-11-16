"""Reproducible SP archive analysis. Raw-point territorial assignment precedes aggregation.

No-detection days are never used to infer satellite outages. Known product gaps
come from NASA's public missing-data table. Cloud/overpass coverage is unknown.
"""

from __future__ import annotations
import datetime as dt
import hashlib
import gzip
import json
from pathlib import Path
import warnings
import numpy as np
import pandas as pd
import shapely
from shapely.geometry import shape, box
from .pipeline import Grid, PERU_BBOX, week_of_year
from .sonify import _voice, chord_for, dissonance, level_for, MAPPING_DOC

REFERENCE_YEARS = tuple(range(2012, 2025))
VERSION = "national-point-sp-2.0.0"


def bin_dates(year: int, week: int):
    start = dt.date(year, 1, 1) + dt.timedelta(days=week * 7)
    end = dt.date(year, 12, 31) if week == 51 else start + dt.timedelta(days=6)
    return start, end


def valid_weeks(years, missing_dates):
    missing = {dt.date.fromisoformat(d) for d in missing_dates}
    valid = np.ones((len(years), 52), dtype=bool)
    for i, year in enumerate(years):
        for wk in range(52):
            a, b = bin_dates(int(year), wk)
            if a < dt.date(2012, 1, 20) or any(a <= d <= b for d in missing):
                valid[i, wk] = False
    return valid


def robust_scores(
    counts, valid, years, reference=REFERENCE_YEARS, half=1, min_scale=0.35
):
    x = np.where(valid[:, :, None], np.log1p(counts), np.nan)
    shifted = [np.roll(x, k, axis=1) for k in range(-half, half + 1)]
    denom = sum(np.isfinite(v) for v in shifted)
    smoothed = np.divide(
        sum(np.nan_to_num(v) for v in shifted),
        denom,
        out=np.full_like(x, np.nan),
        where=denom > 0,
    )
    z = np.full_like(x, np.nan)
    for yi, year in enumerate(years):
        ids = [i for i, y in enumerate(years) if int(y) in reference and y != year]
        if len(ids) < 5:
            continue
        base = np.where(valid[ids, :, None], smoothed[ids], np.nan)
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", RuntimeWarning)
            med = np.nanmedian(base, axis=0)
            mad = np.nanmedian(np.abs(base - med), axis=0)
        z[yi] = (smoothed[yi] - med) / np.maximum(1.4826 * mad, min_scale)
        z[yi, ~valid[yi]] = np.nan
        z[yi, np.isfinite(base).sum(axis=0) < 5] = np.nan
    return z


def assign_regions(frame, features):
    polygons = np.array([shape(f["geometry"]) for f in features], dtype=object)
    if any(not p.is_valid for p in polygons):
        raise ValueError("Invalid territorial geometry")
    points = shapely.points(frame.longitude.to_numpy(), frame.latitude.to_numpy())
    pairs = shapely.STRtree(polygons).query(points, predicate="covered_by")
    result = np.full(len(frame), -1, dtype=int)
    # Shared borders/overlaps are assigned deterministically to the smaller polygon.
    areas = np.array([p.area for p in polygons])
    order = np.lexsort((pairs[1], areas[pairs[1]], pairs[0]))
    point_idx, poly_idx = pairs[:, order]
    _, first = np.unique(point_idx, return_index=True)
    result[point_idx[first]] = poly_idx[first]
    ambiguous = int((np.bincount(pairs[0], minlength=len(frame)) > 1).sum())
    return result, polygons, ambiguous


def load_archives(root: Path, manifest):
    frames = []
    qa = []
    for entry in manifest["entries"]:
        if entry.get("http_status") != 200:
            continue
        year = int(entry["year"])
        p = root / f"data/raw/viirs-snpp_{year}_Peru.csv"
        if (
            not p.exists()
            or hashlib.sha256(p.read_bytes()).hexdigest() != entry["sha256"]
        ):
            raise ValueError(f"Source checksum mismatch: {year}")
        d = pd.read_csv(
            p,
            dtype={
                "confidence": str,
                "satellite": str,
                "acq_time": str,
                "version": str,
            },
        )
        required = {
            "latitude",
            "longitude",
            "acq_date",
            "acq_time",
            "frp",
            "version",
            "type",
            "satellite",
            "confidence",
        }
        if not required.issubset(d.columns):
            raise ValueError(f"Incomplete SP schema: {year}")
        dates = pd.to_datetime(d.acq_date, errors="raise")
        if (dates.dt.year != year).any():
            raise ValueError("Unexpected source year")
        if d.version.str.contains("NRT", case=False).any():
            raise ValueError("SP cohort cannot silently include NRT")
        before = len(d)
        d = d.drop_duplicates()
        duplicates = before - len(d)
        # Nonidentical location/time collisions remain distinct source records.
        keep = (
            (d.satellite.str.strip() == "N")
            & (pd.to_numeric(d["type"], errors="coerce") == 0)
            & ~d.confidence.str.lower().isin(["l", "low"])
        )
        filtered = int((~keep).sum())
        d = d.loc[keep].copy()
        d["acq_date"] = pd.to_datetime(d.acq_date, errors="raise")
        for c in ("latitude", "longitude"):
            d[c] = pd.to_numeric(d[c], errors="raise")
        if not np.isfinite(d[["latitude", "longitude"]]).all().all():
            raise ValueError("Invalid coordinate")
        f = pd.to_numeric(d.frp, errors="coerce")
        d["frp"] = f.where(np.isfinite(f) & (f >= 0), np.nan)
        d["source_year"] = year
        frames.append(d)
        qa.append(
            {
                "year": year,
                "source_rows": before,
                "identical_duplicates_removed": duplicates,
                "confidence_or_type_filtered": filtered,
                "frp_unknown": int(d.frp.isna().sum()),
                "source_sha256": entry["sha256"],
            }
        )
    if not frames:
        raise ValueError("No validated archives available")
    return pd.concat(frames, ignore_index=True), qa


def build(root: Path, output: Path):
    manifest = json.loads((root / "data/manifests/firms-downloads.json").read_text())
    availability = json.loads(
        (root / "data/manifests/firms-product-availability.json").read_text()
    )
    df, qa = load_archives(root, manifest)
    geo_path = root / "data/peru_departments.geojson"
    geo = json.loads(geo_path.read_text())
    features = geo["features"]
    names = [f["properties"]["shapeName"] for f in features]
    assignments, polygons, ambiguous = assign_regions(df, features)
    df["region_index"] = assignments
    for q in qa:
        q["outside_simplified_admin1"] = int(
            ((df.source_year == q["year"]) & (assignments < 0)).sum()
        )
    df = df.loc[assignments >= 0].copy()
    grid = Grid(*PERU_BBOX, res=0.5)
    raw_cell = grid.cell_of(df.latitude, df.longitude)
    composite = raw_cell * len(names) + df.region_index.to_numpy()
    units, ui = np.unique(composite, return_inverse=True)
    unit_region = units % len(names)
    unit_cell = units // len(names)
    coords = []
    for cell, r in zip(unit_cell, unit_region):
        row, col = divmod(int(cell), grid.n_lon)
        west = grid.west + col * grid.res
        south = grid.south + row * grid.res
        point = (
            polygons[r]
            .intersection(box(west, south, west + grid.res, south + grid.res))
            .representative_point()
        )
        coords.append((point.y, point.x))
    years = np.array(sorted(df.source_year.unique()))
    yi = np.searchsorted(years, df.source_year)
    wi = week_of_year(df.acq_date)
    shape_ = (len(years), 52, len(units))
    counts = np.zeros(shape_)
    frp = np.zeros(shape_)
    known = np.zeros(shape_)
    np.add.at(counts, (yi, wi, ui), 1)
    np.add.at(frp, (yi, wi, ui), df.frp.fillna(0).to_numpy())
    np.add.at(known, (yi, wi, ui), df.frp.notna().to_numpy())
    missing = [
        e["date"]
        for e in availability["missing_data_table"]["suomi_npp_entries"]
        if e["processing"] == "SP"
    ]
    valid = valid_weeks(years, missing)
    z = robust_scores(counts, valid, years)
    country_counts = counts.sum(axis=2, keepdims=True)
    zc = robust_scores(country_counts, valid, years)[:, :, 0]
    region_counts = np.stack(
        [counts[:, :, unit_region == r].sum(axis=2) for r in range(len(names))], axis=2
    )
    zr = robust_scores(region_counts, valid, years)
    nz = counts[counts > 0]
    count_ref = float(np.percentile(nz, 99.9))
    fz = frp[frp > 0]
    frp_ref = float(np.percentile(fz, 99.9))

    def metrics(n, f, k, zv):
        finite = bool(np.isfinite(zv))
        d = float(dissonance(zv)) if finite else 0.0
        return {
            "count": int(n),
            "frp": round(float(f), 1) if k or not n else None,
            "frp_unknown_count": int(n - k),
            "z": round(float(zv), 2) if finite else None,
            "level": level_for(float(zv)) if finite else "no_data",
            "dissonance": round(d, 3),
        }

    entries = []
    output.mkdir(parents=True, exist_ok=True)
    provenance = {
        "manifest_sha256": hashlib.sha256(
            (root / "data/manifests/firms-downloads.json").read_bytes()
        ).hexdigest(),
        "geometry_sha256": hashlib.sha256(geo_path.read_bytes()).hexdigest(),
        "algorithm_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "manifest_url": "/data/provenance/firms-downloads.json",
        "quality_url": "/data/provenance/science-qa.json",
        "pipeline_version": VERSION,
        "numpy": np.__version__,
        "pandas": pd.__version__,
        "shapely": shapely.__version__,
    }
    for i, year in enumerate(years):
        weeks = []
        for wk in range(52):
            n = counts[i, wk].sum()
            f = frp[i, wk].sum()
            k = known[i, wk].sum()
            m = metrics(n, f, k, zc[i, wk])
            gap = not np.isfinite(zc[i, wk])
            m["chord"] = [] if gap else chord_for(m["dissonance"])
            cells = []
            if not gap:
                for u in np.flatnonzero(counts[i, wk] > 0):
                    lat, lon = coords[u]
                    v = _voice(
                        counts[i, wk, u],
                        frp[i, wk, u],
                        z[i, wk, u],
                        lat,
                        lon,
                        grid,
                        count_ref,
                        frp_ref,
                        bool(u % 2),
                    )
                    v.update(
                        metrics(
                            counts[i, wk, u],
                            frp[i, wk, u],
                            known[i, wk, u],
                            z[i, wk, u],
                        )
                    )
                    v["region"] = names[unit_region[u]]
                    cells.append(v)
            regions = []
            for r, name in enumerate(names):
                mask = unit_region == r
                rm = metrics(
                    counts[i, wk, mask].sum(),
                    frp[i, wk, mask].sum(),
                    known[i, wk, mask].sum(),
                    zr[i, wk, r],
                )
                rm.update(
                    {
                        "name": name,
                        "alert": bool(
                            rm["z"] is not None and rm["z"] >= 2.5 and rm["count"] >= 5
                        ),
                    }
                )
                regions.append(rm)
            a, b = bin_dates(int(year), wk)
            weeks.append(
                {
                    "week": wk,
                    "start_date": a.isoformat(),
                    "end_date": b.isoformat(),
                    "data_gap": gap,
                    "coverage_status": (
                        "reported_product_gap"
                        if gap
                        else "no_reported_product_gap_cloud_coverage_unknown"
                    ),
                    "country": m,
                    "regions": regions,
                    "cells": cells,
                }
            )
        doc = {
            "meta": {
                "project": "TerraEcho",
                "schema_version": "2.0.0",
                "source": "NASA FIRMS VIIRS Suomi NPP 375 m Collection 2 standard processing; Peru country archive",
                "year": int(year),
                "baseline_years": [
                    int(y) for y in years if y in REFERENCE_YEARS and y != year
                ],
                "grid": {
                    "west": grid.west,
                    "south": grid.south,
                    "east": grid.east,
                    "north": grid.north,
                    "res_deg": grid.res,
                },
                "weeks_per_year": 52,
                "anomaly": "Retrospective fixed reference 2012–2024, target year excluded; robust z of 3-bin-smoothed log1p counts, median/MAD with scale floor 0.35; known missing-product weeks masked before smoothing",
                "mapping": MAPPING_DOC,
                "geographic_scope": "peru-admin1-point-clipped",
                "coverage_status": "NASA reported SP gaps masked; cloud and overpass coverage not independently certified",
                "forest_classification": "vegetation-fire category; no forest land-cover mask",
                "provenance": provenance,
            },
            "weeks": weeks,
        }
        path = output / f"terraecho_{year}.json"
        if path.exists() and not json.loads(path.read_text()).get("meta", {}).get(
            "schema_version"
        ):
            legacy = output / "legacy"
            legacy.mkdir(exist_ok=True)
            (legacy / path.name).write_bytes(path.read_bytes())
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(doc, separators=(",", ":"), allow_nan=False))
        tmp.replace(path)
        path.with_suffix(".json.gz").write_bytes(
            gzip.compress(path.read_bytes(), mtime=0)
        )
        entries.append(
            {
                "year": int(year),
                "weeks": 52,
                "source": "NASA FIRMS SP",
                "scope": "peru-admin1-point-clipped",
                "quality": "reprocessed-source-archive",
                "storage": "gzip",
                "coverage": "reported gaps checked; cloud coverage unknown",
                "lastObservation": df.loc[df.source_year == year, "acq_date"]
                .max()
                .date()
                .isoformat(),
                "scoreSha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            }
        )
    legacy2026 = root / "data/scores/terraecho_2026.json"
    if legacy2026.exists():
        entries.append(
            {
                "year": 2026,
                "weeks": len(json.loads(legacy2026.read_text())["weeks"]),
                "source": "Team legacy export; raw source unavailable",
                "scope": "bounding-box",
                "quality": "legacy-unreproduced",
                "coverage": "Unverified heuristically flagged gaps",
                "lastObservation": "2026-10-29",
                "scoreSha256": hashlib.sha256(legacy2026.read_bytes()).hexdigest(),
            }
        )
    catalog = {"schema_version": "1.0.0", "defaultYear": 2025, "entries": entries}
    (root / "data/scores/catalog.json").write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2)
    )
    report = {
        "schema_version": "1.0.0",
        "pipeline": VERSION,
        "raw_rows": sum(x["source_rows"] for x in qa),
        "retained_rows": int(len(df)),
        "ambiguous_border_assignments": ambiguous,
        "border_policy": "smallest covering ADM1 polygon; one assignment per source record",
        "duplicate_policy": "remove only identical whole rows; preserve nonidentical same-coordinate/time records",
        "years": qa,
        "count_reconciliation": "country counts equal summed department counts by construction from assigned raw points",
        "missing_dates_source": availability["missing_data_table"]["source_url"],
        "limits": [
            "simplified geoBoundaries ADM1 geometry",
            "no forest land-cover classification",
            "no cloud/overpass coverage certificate",
            "descriptive retrospective anomaly, not a forecast",
            "2026 remains a separately labeled unreproduced legacy score",
        ],
    }
    (root / "data/scores/science-qa.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2)
    )
    return catalog, report
