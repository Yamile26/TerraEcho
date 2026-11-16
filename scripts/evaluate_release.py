"""Reproducible sensitivity and contextual checks; not human or event accuracy."""

import gzip
import hashlib
import json
from pathlib import Path
import sys
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from terraecho.science import load_archives, assign_regions, valid_weeks, robust_scores
from terraecho.pipeline import Grid, PERU_BBOX, week_of_year


def main():
    manifest = json.loads((ROOT / "data/manifests/firms-downloads.json").read_text())
    availability = json.loads(
        (ROOT / "data/manifests/firms-product-availability.json").read_text()
    )
    df, _ = load_archives(ROOT, manifest)
    geo = json.loads((ROOT / "data/peru_departments.geojson").read_text())
    regions, _, _ = assign_regions(df, geo["features"])
    df["region_index"] = regions
    df = df.loc[regions >= 0].copy()
    years = np.array(sorted(df.source_year.unique()))
    yi, wi = np.searchsorted(years, df.source_year), week_of_year(df.acq_date)
    missing = [
        e["date"]
        for e in availability["missing_data_table"]["suomi_npp_entries"]
        if e["processing"] == "SP"
    ]
    valid = valid_weeks(years, missing)
    counts = np.zeros((len(years), 52, 1))
    np.add.at(counts, (yi, wi, np.zeros(len(df), dtype=int)), 1)
    base = robust_scores(counts, valid, years)
    sensitivity = []
    for half in (0, 1, 2):
        for floor in (0.25, 0.35, 0.5):
            z = robust_scores(counts, valid, years, half=half, min_scale=floor)
            mask = np.isfinite(z) & np.isfinite(base)
            sensitivity.append(
                {
                    "half_window": half,
                    "scale_floor": floor,
                    "critical_bins": int(((z >= 2.5) & mask).sum()),
                    "critical_changes_vs_shipped": int(
                        (((z >= 2.5) != (base >= 2.5)) & mask).sum()
                    ),
                    "finite_bins": int(mask.sum()),
                    "threshold_bins": {
                        str(t): int(((z >= t) & mask).sum()) for t in (1, 2.5, 4)
                    },
                }
            )
    spatial = []
    classifications = {}
    for res in (0.25, 0.5, 1):
        grid = Grid(*PERU_BBOX, res=res)
        c = grid.cell_of(df.latitude, df.longitude)
        keys = np.stack([yi, wi, c], axis=1)
        _, n = np.unique(keys, axis=0, return_counts=True)
        # Use department ownership exactly as in the shipped pipeline.
        units, ui = np.unique(
            c * len(geo["features"]) + df.region_index.to_numpy(), return_inverse=True
        )
        cell_counts = np.zeros((len(years), 52, len(units)))
        np.add.at(cell_counts, (yi, wi, ui), 1)
        cell_z = robust_scores(cell_counts, valid, years)
        finite = np.isfinite(cell_z[yi, wi, ui])
        critical = (cell_z[yi, wi, ui] >= 2.5) & (cell_counts[yi, wi, ui] >= 5)
        classifications[res] = (critical, finite)
        spatial.append(
            {
                "cell_degrees": res,
                "occupied_cell_bins": len(n),
                "retained_detections": int(n.sum()),
                "median_detections_per_occupied_cell_bin": float(np.median(n)),
                "department_cell_units": len(units),
                "critical_department_cell_bins": int(
                    ((cell_z >= 2.5) & (cell_counts >= 5)).sum()
                ),
                "detection_weighted_critical_fraction": float(critical[finite].mean()),
            }
        )
    for entry in spatial:
        flags, finite = classifications[entry["cell_degrees"]]
        original, original_finite = classifications[0.5]
        mask = finite & original_finite
        entry["comparable_detection_records"] = int(mask.sum())
        entry["changed_detection_labels_vs_half_degree"] = int(
            (flags[mask] != original[mask]).sum()
        )
        entry["interpretation"] = (
            "Sensitivity of cell anomaly on the same retained source records, not accuracy against fire-event truth"
        )
    score = json.loads(
        gzip.decompress(
            (ROOT / "data/scores/verified/terraecho_2024.json.gz").read_bytes()
        )
    )
    # September 18 falls in the Jan-1-based bin starting September 16.
    week = next(
        w for w in score["weeks"] if w["start_date"] <= "2024-09-18" <= w["end_date"]
    )
    case = {
        "source_url": "https://www.gob.pe/institucion/indeci/noticias/1024642-jefe-del-indeci-destaca-declaratoria-de-estado-de-emergencia-en-zonas-mas-afectadas-por-incendios-forestales",
        "source_date": "2024-09-18",
        "statement": "Emergency declaration includes Amazonas, San Martín and Ucayali",
        "bin_start": week["start_date"],
        "bin_end": week["end_date"],
        "data_gap": week["data_gap"],
        "regions": [
            r
            for r in week["regions"]
            if r["name"] in ("Amazonas", "San Martín", "Ucayali")
        ],
        "interpretation": "Contextual comparison only. Administrative emergency areas and satellite detections have different definitions. No event-level labels or accuracy estimate.",
    }
    mixes = []
    for path in sorted((ROOT / "data/scores/verified").glob("*.json.gz")):
        archive = json.loads(gzip.decompress(path.read_bytes()))
        for w in archive["weeks"]:
            cells = w["cells"]
            if w["data_gap"] or not cells:
                continue
            selected = sorted(cells, key=lambda c: c["frp"] or 0, reverse=True)[:18]
            total = sum(c["count"] for c in cells)
            power = sum(c["frp"] or 0 for c in cells)
            mixes.append(
                {
                    "year": archive["meta"]["year"],
                    "week": w["week"],
                    "count_share": sum(c["count"] for c in selected) / total,
                    "known_frp_share": (
                        sum(c["frp"] or 0 for c in selected) / power if power else None
                    ),
                    "omitted_critical_cells": sum(
                        c["z"] >= 2.5 and c["count"] >= 5
                        for c in cells
                        if c not in selected
                    ),
                }
            )
    mix_report = {
        "valid_nonempty_bins": len(mixes),
        "selection": "18 highest known summed FRP cells, stable source-order ties",
        "count_share_percentiles_10_50_90": np.percentile(
            [m["count_share"] for m in mixes], [10, 50, 90]
        ).tolist(),
        "known_frp_share_percentiles_10_50_90": np.percentile(
            [m["known_frp_share"] for m in mixes if m["known_frp_share"] is not None],
            [10, 50, 90],
        ).tolist(),
        "bins_with_omitted_critical_cells": sum(
            m["omitted_critical_cells"] > 0 for m in mixes
        ),
        "omitted_critical_cell_bins": sum(m["omitted_critical_cells"] for m in mixes),
        "example_2025_week40": next(
            m for m in mixes if m["year"] == 2025 and m["week"] == 39
        ),
        "interpretation": "The mix is a lossy subset, not a complete anomaly detector. All cells remain inspectable and individually playable. No perceptual optimality claim.",
    }
    result = {
        "method": "Full retained 2012–2025 cohort; national anomaly parameter sensitivity; cell occupancy sensitivity",
        "input_manifest_sha256": hashlib.sha256(
            (ROOT / "data/manifests/firms-downloads.json").read_bytes()
        ).hexdigest(),
        "anomaly_sensitivity": sensitivity,
        "spatial_sensitivity": spatial,
        "voice_selection": mix_report,
        "peru_case": case,
        "limits": [
            "No parameter selected to maximize agreement with the contextual report",
            "Spatial test compares occupancy and cell anomaly labels on the same source records, not independently labeled fire events",
            "Human interpretation and comfort unmeasured",
        ],
    }
    target = ROOT / "docs/evaluation/release-sensitivity.json"
    target.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
