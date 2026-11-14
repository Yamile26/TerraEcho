"""Write FAKE FIRMS-shaped CSV files for testing the pipeline only.

These are random numbers, not NASA data. Never ship them or show them as
results. Usage: python tests/make_synthetic.py some_folder
"""
import sys
import os

import numpy as np
import pandas as pd

CLUSTERS = {"ucayali": (-8.4, -74.5), "san_martin": (-7.0, -76.5),
            "madre_de_dios": (-12.5, -69.8), "cusco": (-13.0, -72.3)}


def make(out_dir, first=2012, last=2026, anomalous_year=2026, last_doy=317, seed=0):
    rng = np.random.default_rng(seed)
    os.makedirs(out_dir, exist_ok=True)
    for year in range(first, last + 1):
        rows = []
        for name, (clat, clon) in CLUSTERS.items():
            n = rng.poisson(900)
            if year == anomalous_year and name == "ucayali":
                n *= 4
            doy = np.clip(rng.normal(250, 25, n).round(), 1, 365).astype(int)
            if year == last:
                doy = doy[doy <= last_doy]
            m = len(doy)
            date = pd.Timestamp(year, 1, 1) + pd.to_timedelta(doy - 1, unit="D")
            rows.append(pd.DataFrame({
                "latitude": clat + rng.normal(0, 0.6, m),
                "longitude": clon + rng.normal(0, 0.6, m),
                "bright_ti4": rng.normal(330, 10, m).round(1),
                "acq_date": date.strftime("%Y-%m-%d"),
                "acq_time": rng.integers(0, 2359, m),
                "satellite": "N", "instrument": "VIIRS",
                "confidence": rng.choice(["l", "n", "h"], m, p=[0.1, 0.8, 0.1]),
                "frp": rng.gamma(2.0, 4.0, m).round(2),
                "daynight": "D", "type": 0,
            }))
        pd.concat(rows).to_csv(os.path.join(out_dir, f"synthetic_{year}.csv"), index=False)


if __name__ == "__main__":
    make(sys.argv[1])
