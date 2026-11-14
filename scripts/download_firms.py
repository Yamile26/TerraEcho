"""Download NASA FIRMS VIIRS hotspots for Peru into data/raw/.

Past years come from the public FIRMS country archive (no key needed):
  python scripts/download_firms.py --years 2012 2025

The current year is not in that archive yet. Get it from the FIRMS API with a
free MAP_KEY (https://firms.modaps.eosdis.nasa.gov/api/map_key/):
  python scripts/download_firms.py --api-year 2026 --map-key YOUR_KEY

If a URL fails, download the files by hand from
https://firms.modaps.eosdis.nasa.gov/country/ (archive) and
https://firms.modaps.eosdis.nasa.gov/download/ (custom request) and drop
them in data/raw/. The pipeline reads any FIRMS CSV it finds there.
"""
import argparse
import datetime as dt
import os
import time
import urllib.request

ARCHIVE = "https://firms.modaps.eosdis.nasa.gov/data/country/viirs-snpp/{y}/viirs-snpp_{y}_Peru.csv"
API = "https://firms.modaps.eosdis.nasa.gov/api/area/csv/{key}/{source}/{bbox}/{days}/{date}"
PERU_BBOX = "-81.5,-18.5,-68.5,0"
CHUNK_DAYS = 5


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "TerraEcho/1.0"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--years", type=int, nargs=2, metavar=("FIRST", "LAST"))
    ap.add_argument("--api-year", type=int)
    ap.add_argument("--map-key")
    ap.add_argument("--source", default="VIIRS_SNPP_NRT",
                    help="FIRMS API source, e.g. VIIRS_SNPP_NRT or VIIRS_SNPP_SP")
    ap.add_argument("--out", default="data/raw")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)

    if a.years:
        for y in range(a.years[0], a.years[1] + 1):
            path = os.path.join(a.out, f"viirs-snpp_{y}_Peru.csv")
            if os.path.exists(path):
                print("have", path)
                continue
            try:
                data = fetch(ARCHIVE.format(y=y))
                with open(path, "wb") as f:
                    f.write(data)
                print(f"ok   {path}  {len(data) / 1e6:.1f} MB")
            except Exception as e:                      # keep going, report at the end
                print(f"FAIL {y}: {e}")

    if a.api_year:
        if not a.map_key:
            raise SystemExit("--api-year needs --map-key")
        path = os.path.join(a.out, f"api_{a.source}_{a.api_year}_Peru.csv")
        day = dt.date(a.api_year, 1, 1)
        end = min(dt.date(a.api_year, 12, 31), dt.date.today())
        header, rows = None, []
        while day <= end:
            url = API.format(key=a.map_key, source=a.source, bbox=PERU_BBOX,
                             days=CHUNK_DAYS, date=day.isoformat())
            try:
                lines = fetch(url).decode("utf-8").strip().splitlines()
                if lines and lines[0].lower().startswith("latitude"):
                    header = header or lines[0]
                    rows += lines[1:]
                elif lines:
                    print(f"{day}: unexpected reply: {lines[0][:120]}")
            except Exception as e:
                print(f"FAIL {day}: {e}")
            day += dt.timedelta(days=CHUNK_DAYS)
            time.sleep(0.3)
        if header:
            with open(path, "w", encoding="utf-8") as f:
                f.write("\n".join([header] + rows) + "\n")
            print(f"ok   {path}  {len(rows):,} hotspots")
        else:
            print("No data returned. Try --source VIIRS_SNPP_SP or check the key.")


if __name__ == "__main__":
    main()
