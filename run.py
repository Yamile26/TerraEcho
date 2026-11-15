"""TerraEcho data core, command line.

  python run.py --raw data/raw --years 2026 --out out
  python run.py --raw data/raw --years 2019 2022 2026 --out out --wav
  python run.py --raw data/raw --years 2026 --regions data/peru_departments.geojson
"""
import argparse
import json
import os

import numpy as np

from terraecho import pipeline as P
from terraecho.render import render
from terraecho.sonify import build_score


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--raw", default="data/raw", help="folder with FIRMS CSV files")
    ap.add_argument("--years", type=int, nargs="+", required=True, help="years to export")
    ap.add_argument("--out", default="out")
    ap.add_argument("--res", type=float, default=0.5, help="grid cell size in degrees")
    ap.add_argument("--satellite", default="N", help='FIRMS satellite code to keep, or "all"')
    ap.add_argument("--regions", default="data/peru_departments.geojson",
                    help='GeoJSON of regions (default: Peru departments). Use "none" to skip')
    ap.add_argument("--wav", action="store_true", help="also render a WAV per year")
    ap.add_argument("--seconds-per-week", type=float, default=0.5)
    a = ap.parse_args()

    os.makedirs(a.out, exist_ok=True)
    grid = P.Grid(*P.PERU_BBOX, res=a.res)
    df = P.load_firms(a.raw, satellite=None if a.satellite == "all" else a.satellite)
    years, counts, frp, last_week = P.aggregate(df, grid)
    print(f"{len(df):,} hotspots, {years[0]}-{years[-1]}, {grid.n_cells} cells")

    z_cell = P.anomaly(counts, last_week)
    z_country = P.anomaly(counts.sum(axis=2, keepdims=True), last_week)[:, :, 0]

    regions = None
    if a.regions and a.regions != "none" and os.path.exists(a.regions):
        names, region = P.load_regions(a.regions, grid)
        rc = P.sum_by_region(counts, region, len(names))
        regions = {"names": names, "region_of_cell": region, "counts": rc,
                   "frp": P.sum_by_region(frp, region, len(names)),
                   "z": P.anomaly(rc, last_week)}

    for year in a.years:
        if year not in years or last_week[list(years).index(year)] < 0:
            print(f"skip {year}: no data")
            continue
        score = build_score(year, years, grid, counts, frp, z_cell, last_week, z_country, regions)
        jpath = os.path.join(a.out, f"terraecho_{year}.json")
        with open(jpath, "w", encoding="utf-8") as f:
            json.dump(score, f, separators=(",", ":"))
        peak = max(score["weeks"], key=lambda w: w["country"]["z"])
        print(f"{year}: {jpath}  peak anomaly z={peak['country']['z']} in week of {peak['start_date']}")
        # weekly country table: the evidence behind the sound, for checking and for slides
        yi = list(years).index(year)
        others = [i for i, lw in enumerate(last_week) if i != yi and lw >= 0]
        ctot = counts.sum(axis=2)
        cpath = os.path.join(a.out, f"terraecho_{year}_weekly.csv")
        with open(cpath, "w", encoding="utf-8") as f:
            f.write("week,start_date,hotspots,baseline_median,baseline_min,baseline_max,z,level\n")
            for w in score["weeks"]:
                k = w["week"]
                base = ctot[others, k]
                f.write(f"{k},{w['start_date']},{w['country']['count']},{np.median(base):.0f},"
                        f"{base.min():.0f},{base.max():.0f},{w['country']['z']},{w['country']['level']}\n")
        top = sorted(score["weeks"], key=lambda w: w["country"]["count"], reverse=True)[0]
        print(f"       {cpath}  busiest week {top['start_date']}: "
              f"{top['country']['count']} hotspots, z={top['country']['z']}")
        if regions is not None:
            apath = os.path.join(a.out, f"terraecho_{year}_alerts.csv")
            rows = [(r["z"], w["start_date"], r["name"], r["count"])
                    for w in score["weeks"] for r in w["regions"] if r["alert"]]
            with open(apath, "w", encoding="utf-8") as f:
                f.write("start_date,department,hotspots,z\n")
                for z, d, n, c in sorted(rows, key=lambda t: (t[1], -t[0])):
                    f.write(f"{d},{n},{c},{z}\n")
            worst = ", ".join(f"{n} ({d}, z={z})" for z, d, n, c in sorted(rows, reverse=True)[:3])
            print(f"       {apath}  {len(rows)} department alerts. Strongest: {worst or 'none'}")
        if a.wav:
            wpath = os.path.join(a.out, f"terraecho_{year}.wav")
            print(f"       {wpath}  {render(score, wpath, a.seconds_per_week):.1f} s")


if __name__ == "__main__":
    main()
