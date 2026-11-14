"""TerraEcho data core, command line.

  python run.py --raw data/raw --years 2026 --out out
  python run.py --raw data/raw --years 2019 2022 2026 --out out --wav
  python run.py --raw data/raw --years 2026 --regions data/peru_departments.geojson
"""
import argparse
import json
import os

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
    ap.add_argument("--regions", help="optional GeoJSON of regions (e.g. Peru departments)")
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
    if a.regions:
        names, region = P.load_regions(a.regions, grid)
        rc = P.sum_by_region(counts, region, len(names))
        regions = {"names": names, "region_of_cell": region, "counts": rc,
                   "frp": P.sum_by_region(frp, region, len(names)),
                   "z": P.anomaly(rc, last_week)}

    for year in a.years:
        if year not in years:
            print(f"skip {year}: no data")
            continue
        score = build_score(year, years, grid, counts, frp, z_cell, last_week, z_country, regions)
        jpath = os.path.join(a.out, f"terraecho_{year}.json")
        with open(jpath, "w", encoding="utf-8") as f:
            json.dump(score, f, separators=(",", ":"))
        peak = max(score["weeks"], key=lambda w: w["country"]["z"])
        print(f"{year}: {jpath}  peak anomaly z={peak['country']['z']} in week of {peak['start_date']}")
        if a.wav:
            wpath = os.path.join(a.out, f"terraecho_{year}.wav")
            print(f"       {wpath}  {render(score, wpath, a.seconds_per_week):.1f} s")


if __name__ == "__main__":
    main()
