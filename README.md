# TerraEcho

**Hear when the forest burns out of tune.** TerraEcho maps and sonifies wildfires in Peru (2012–2026) with NASA FIRMS data. A normal fire season sounds consonant. A region burning more than usual turns dissonant.

Team AstraCom, NASA Space Apps Challenge 2026, challenge: The Earth Information Jukebox.

## Data core (this folder)

The data core turns NASA fire hotspots into musical parameters. It does not depend on the web app.

```
FIRMS CSV files -> weekly grid -> anomaly (z-score) -> musical parameters -> JSON (+ WAV)
```

### Quick start

```bash
pip install -r requirements.txt

# 1. Get the data (see the script header if a download fails)
python scripts/download_firms.py --years 2012 2025
python scripts/download_firms.py --api-year 2026 --map-key YOUR_FIRMS_MAP_KEY

# 2. Build the score for the web app, plus a WAV to listen to
python run.py --raw data/raw --years 2026 --out out --wav

# 3. Optional: per-department values (needs a GeoJSON of Peru's departments)
python run.py --raw data/raw --years 2026 --regions data/peru_departments.geojson
```

Run the tests with `python tests/test_pipeline.py`. They use synthetic data from `tests/make_synthetic.py`, which is random and must never be shown as a result.

### How the anomaly is computed

1. Keep vegetation fires from one satellite (Suomi NPP) and drop low-confidence detections.
2. Count hotspots per week in 0.5° cells.
3. For each cell and week of the year, compare `log1p(count)` with the same week in every other year, using the median and the MAD. The result is a robust z-score.
4. The same calculation runs for the whole country and, optionally, per department.

### How the anomaly becomes sound

| Data | Sound |
|---|---|
| Anomaly z | Dissonance: 0 up to z = 1, full at z = 4 |
| Latitude | Pitch on a pentatonic scale (south low, north high) |
| Fire radiative power | Loudness |
| Hotspot count | Rhythm: 1 to 4 pulses per week |
| Longitude | Stereo pan (west left, east right) |

Dissonance changes three things: the note is detuned (up to 45 cents), a second voice moves from a perfect fifth to a tritone to a minor second, and that second voice gets louder.

### Output contract for the web app

`out/terraecho_<year>.json`:

```jsonc
{
  "meta": { "year": 2026, "baseline_years": [...], "grid": {...}, "mapping": {...} },
  "weeks": [
    {
      "week": 35,
      "start_date": "2026-09-03",
      "country": { "count": 584, "frp": 4790.0, "z": 1.45, "level": "elevated",
                   "dissonance": 0.151, "chord": [36, 43, 52] },
      "regions": [ { "name": "Ucayali", "count": 0, "frp": 0, "z": 0, "level": "normal",
                     "dissonance": 0, "alert": false } ],   // only with --regions
      "cells": [
        { "lat": -7.25, "lon": -74.25, "count": 10, "frp": 86.1, "z": 4.68,
          "level": "critical", "dissonance": 1.0, "midi": 69, "detune_cents": 45.0,
          "interval": 1, "partner_gain": 0.8, "gain": 0.97, "density": 4,
          "pan": 0.115, "alert": true }
      ]
    }
  ]
}
```

- `cells` lists only the cells that had fire that week. Silence means no fire.
- `midi` plus `detune_cents` gives the main note. The second voice is `midi + interval`, at `partner_gain`.
- `level` is `normal`, `elevated` (z ≥ 1) or `critical` (z ≥ 2.5).
- The numbers in this example come from synthetic test data.

`out/terraecho_<year>.wav` is a reference render at 0.5 s per week, so a full year lasts 26 seconds.

## References

- NASA FIRMS, Fire Information for Resource Management System: https://firms.modaps.eosdis.nasa.gov/
- VIIRS 375 m active fire product (Suomi NPP)
