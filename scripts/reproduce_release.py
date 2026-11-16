"""Verify/download public source bytes, then rebuild the release. No MAP_KEY needed.

python scripts/reproduce_release.py --download
Requires requirements-science.lock.txt; source changes fail the checksum gate.
"""

import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import urllib.request

ROOT = Path(__file__).resolve().parents[1]


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--download", action="store_true")
    a = p.parse_args()
    manifest = json.loads((ROOT / "data/manifests/firms-downloads.json").read_text())
    for entry in manifest["entries"]:
        if entry.get("http_status") != 200:
            continue
        path = ROOT / f"data/raw/viirs-snpp_{entry['year']}_Peru.csv"
        path.parent.mkdir(parents=True, exist_ok=True)
        if (
            path.exists()
            and hashlib.sha256(path.read_bytes()).hexdigest() == entry["sha256"]
        ):
            continue
        if not a.download:
            raise SystemExit(
                f"Missing or changed source {entry['year']}; use --download to obtain checksum-verified public bytes"
            )
        url = entry["source_url"]
        if not url.startswith(
            "https://firms.modaps.eosdis.nasa.gov/data/country/viirs-snpp/"
        ):
            raise SystemExit("Unexpected source host/path")
        with urllib.request.urlopen(
            urllib.request.Request(
                url, headers={"User-Agent": "TerraEcho-reproduce/2.0"}
            ),
            timeout=120,
        ) as response:
            raw = response.read(50_000_000)
        if hashlib.sha256(raw).hexdigest() != entry["sha256"]:
            raise SystemExit(
                f"NASA source bytes changed for {entry['year']}; audit a new manifest before replacing this release"
            )
        temp = path.with_suffix(".tmp")
        temp.write_bytes(raw)
        temp.replace(path)
        print("Verified public source", entry["year"])
    for script in ["build_verified_archive.py", "prepare_eic_catalog.py"]:
        subprocess.run(
            [sys.executable, str(ROOT / "scripts" / script)], cwd=ROOT, check=True
        )


if __name__ == "__main__":
    main()
