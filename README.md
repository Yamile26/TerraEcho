# TerraEcho

**Hear when the forest burns out of tune.** TerraEcho maps and sonifies wildfires in Peru (2012–2026) with NASA FIRMS data. A normal fire season sounds consonant. A region burning more than usual turns dissonant.

Team AstraCom, NASA Space Apps Challenge 2026, challenge: The Earth Information Jukebox.

## Interactive web experience

The Next.js / React / TypeScript / Three.js app lives in `web/`. It connects the existing scientific outputs to a rotating Earth explorer, satellite and wave illustrations, a regional 2D map, weekly timeline, temporal observatory, CSV export and real-time Web Audio synthesis. The EIC studio scans the existing GEOS Aerosols frame and synthesizes its four exported layers.

```bash
# Node.js 22+; run from this repository root
npm ci
npm run dev
# Open http://localhost:3000

npm run test:web
npm run typecheck
npm run build
npm start
```

The app works with the existing score exports without a FIRMS key or a running Python service. The build prepares scientific assets automatically. To enable recent FIRMS detections, set the server-only `FIRMS_MAP_KEY` in `web/.env.local` (see `web/.env.example`). A future Python HTTP service can be selected through `TERRAECHO_PYTHON_API_URL`; its adapter and contract are ready, but that service is not included in this change.

**Current data scope:** 2025 and 2026 are playable tracks. Earlier years beginning in 2012 are comparison inputs, not yet exported tracks. The existing general aggregate covers the pipeline's **bounding box**, which may include neighboring territory; the UI labels it as a study area. It must not be presented as a strictly national count. Regional filtering uses the existing department polygons and matches Python's cell-center assignment. A missing-data week stays silent and displays an unknown anomaly, rather than suggesting a healthy forest.

See [web architecture and independent workstreams](docs/WEB_ARCHITECTURE.md), [API contract](docs/API_CONTRACT.md), [run/deployment guide](docs/DEPLOYMENT.md), [asset credits](docs/ASSETS.md) and [validation notes](docs/VALIDATION.md). No production deployment has been created.

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

# Per-department values are included automatically (data/peru_departments.geojson)
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
- A week with `"data_gap": true` has a hole in the satellite record. Its `z` is `null`, its `level` is `no_data` and it plays no sound. Show it as "no data", not as a calm week.
- `midi` plus `detune_cents` gives the main note. The second voice is `midi + interval`, at `partner_gain`.
- `level` is `normal`, `elevated` (z ≥ 1) or `critical` (z ≥ 2.5).
- The numbers in this example come from synthetic test data.

`out/terraecho_<year>.wav` is a reference render at 0.5 s per week, so a full year lasts 26 seconds.

## EIC frame track

`run_eic.py` sonifies an Earth Information Center frame, the GEOS Aerosols still. A scan line sweeps the image from west to east. Each aerosol colour is one instrument, the amount of colour under the line sets the loudness, and height in the frame sets the pitch. The method follows NASA's "Data Sonification: Caldwell 73".

```bash
python run_eic.py            # writes data/scores/eic_aerosols.json and WAV files
```

The colours are read from the visualization's colour bar. They describe the picture, not measured aerosol amounts.

## Listening test

```bash
python scripts/listening_test.py --raw data/raw
```

Writes three unlabeled clips (worst, typical and quietest year) and an answer key.

## Validation

We ran TerraEcho on 2025 and 2026 without giving it any information about known events, then compared its alerts with reports from Peruvian agencies and press.

| What TerraEcho flagged | What was reported |
|---|---|
| **December 2025.** Four critical weeks in a row. The week of 3 December had 2,121 hotspots; the previous record for that week was 1,787. Strongest department alerts: Áncash, Lima, Ayacucho, La Libertad, Ica. | SENAMHI recorded 216 wildfires from 4 to 31 December 2025, under conditions that favoured fire on the western slopes of the central and southern sierra. Press reported a jump in wildfire emergencies in Áncash. |
| **Late June 2026, Arequipa.** The strongest department alert of the year (z = 7.9), concentrated in one grid cell north-west of Arequipa city. | A wildfire in Yura affected about 1,000 hectares of the Salinas y Aguada Blanca National Reserve (reported 28 June 2026). |
| **Mid-September to mid-October 2026.** Five weeks above normal. The week of 1 October had 9,058 hotspots; a normal week has about 2,660 and the previous record was 5,182. Activity returned to normal in the week of 22 October. | Serfor counted 77 simultaneous wildfires on 10 October 2026. Indeci reported 12 deaths by 19 October. Zero active wildfires were announced on 23 October. |

The busiest week of each year (late August) was not flagged as critical, because late August always burns. TerraEcho reacts to what is abnormal, not to what is large.

Sources: [SENAMHI, December 2025](https://www.senamhi.gob.pe/load/file/02259SENA-39.pdf), [La República](https://larepublica.pe/tag/incendios-forestales), [El Búho, 28 June 2026](https://elbuho.pe/?p=427829), [Actualidad Ambiental, 10 October 2026](https://actualidadambiental.pe/peru-registra-77-incendios-forestales-en-simultaneo-y-la-respuesta-no-es-suficiente), [Actualidad Ambiental, 20 October 2026](https://www.actualidadambiental.pe/se-eleva-a-12-el-numero-de-fallecidos-por-los-incendios-forestales-en-el-pais/), [El Peruano, 23 October 2026](https://elperuano.pe/noticia/307491-peru-registra-cero-incendios-forestales-activos-tras-semanas-de-emergencia).

## Limitations

- **2026 is provisional.** Recent months use near real-time data, which NASA later replaces with science-quality data. Counts may change slightly.
- **Hotspots are not fires.** A hotspot is a thermal anomaly seen by the satellite. One large fire produces many hotspots, and clouds can hide fires.
- **The satellite record has holes.** Seventeen days of 2026 have no detections, including 11 to 16 July. Weeks that lose three or more days are marked as data gaps and play no sound.
- **Non-fire heat sources.** Volcanoes and industrial sites flagged in the archive are removed, but an unflagged source could still appear as an alert.
- **Small numbers.** In departments with few fires, a handful of hotspots can trigger an alert. Alerts need at least 5 hotspots, and the ones based on fewer than about 20 should be read with care.
- **The matches above are consistency checks**, not a formal accuracy measurement.

## References

- NASA FIRMS, Fire Information for Resource Management System: https://firms.modaps.eosdis.nasa.gov/
- VIIRS 375 m active fire product (Suomi NPP)
- NASA Scientific Visualization Studio, GEOS Aerosols: https://svs.gsfc.nasa.gov/5669/
- NASA Scientific Visualization Studio, Data Sonification: Caldwell 73 (SYSTEM Sounds: M. Russo, A. Santaguida): https://svs.gsfc.nasa.gov/13786/
- Department boundaries: geoBoundaries, Peru ADM1 (simplified), https://www.geoboundaries.org/
