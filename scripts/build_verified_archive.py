"""Rebuild checksum-verified release snapshots from public NASA archives.

python scripts/build_verified_archive.py
Raw files are not committed. Exact acquisition links and hashes are in data/manifests/.
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from terraecho.science import build

if __name__ == "__main__":
    catalog, report = build(ROOT, ROOT / "data/scores/verified")
    print(
        json.dumps(
            {
                "years": [x["year"] for x in catalog["entries"]],
                "raw_rows": report["raw_rows"],
                "retained_rows": report["retained_rows"],
                "source": "genuine NASA archives; no synthetic observations",
            }
        )
    )
