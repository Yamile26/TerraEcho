# TerraEcho

**Turn an Earth image into an explorable soundscape.** TerraEcho pairs a real NASA GEOS Aerosols frame with original interactive sonification and a separate thermal-activity archive for Peru. Team AstraCom · NASA Space Apps 2026 · [The Earth Information Jukebox](https://www.spaceappschallenge.org/2026/challenges/the-earth-information-jukebox/).

Visual identity: navy surfaces, turquoise controls and blue globe glow, matching the [approved reference](docs/THEME.md).

[Open the complete public TerraEcho app](https://terraecho-earth-jukebox.dotingchime4.chatgpt.site): EIC, archive and recent NASA queries. The server keeps the FIRMS key private and enforces a shared request budget. [Published verification](docs/evaluation/public-https-check.json) · [Real recent-data browser check](docs/evaluation/recent-browser-check.json).

## Run

Node.js 22+ and npm in Linux/WSL. Docker and Python are unnecessary to explore the shipped data.

```bash
npm ci
npm run dev
# Open the URL printed by Next.js
```

Use `npm`, not `npm.cmd`, in Ubuntu. For recent observations, copy `web/.env.example` to `web/.env.local`, set **server-only** `FIRMS_MAP_KEY`, and restart. Never paste the key into chat, commit it or add `NEXT_PUBLIC_`. Leave the optional Python API URL empty unless that service exists.

## Actual scope

| Mode | Source and behavior | Limits |
| --- | --- | --- |
| Jukebox EIC | Three readings of one genuine NASA frame: global, smoke voice, South America crop; layer isolation, 104 segments, feature table, A/B, mono, WAV with source metadata | Model frame **2025-08-19 20:00 UTC**, published 2026-08-10. Visual color/height features are not atmospheric concentrations. Crop is image space, not an exact Peru boundary. |
| Rebuilt archive | Navigable **2012–2025**; 1,047,074 genuine Suomi NPP SP records, 960,333 retained after filters and raw-point ADM1 assignment | Simplified boundaries; vegetation-fire category, no forest mask. Cloud/overpass coverage unknown. Retrospective anomaly, not prediction. |
| Legacy 2026 | Original team export, 44 bins, explicitly labeled | Raw source unavailable here. Bbox totals and heuristic gaps unreproduced. Excluded from the rebuilt baseline. |
| Recent FIRMS | Hosted Worker / Node option: NOAA-20 default, NOAA-21 and historical SNPP explicit; department clipping, map, descriptive audio and observations | Key required. No historical anomaly or forest classification. SNPP ceased new data **2026-11-02**. Zero returned detections never prove absence of fire. |

EIC is the challenge response; FIRMS adds regional exploration. Different dates and instruments do not establish a smoke–fire causal link. “Habitual” is statistically typical recorded activity, never a healthy forest. Pause, no selected detections and insufficient data are distinct labeled states.

## Reproduce

Python 3.12; public country archives require no key. Exact dependencies, URLs, retrieval times, product gaps and source hashes are recorded.

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-science.lock.txt
python scripts/reproduce_release.py --download
python scripts/evaluate_release.py
python -m unittest discover -s tests -p 'test_science.py' -v
```

Changed download bytes fail the checksum gate. Raw CSVs stay ignored; gzip scores are versioned and expanded by `prepare-data.mjs` without Python. Original `run.py`, `terraecho/pipeline.py`, `run_eic.py` and earlier scores remain **legacy research tools**, not this release's generator. Their gap heuristic/baseline must not be attributed to the new pipeline.

The new reference fixes 2012–2024, excludes the target, masks reported SP gaps before three-bin smoothing, and uses robust z on log1p counts, median/MAD and floor 0.35. The final bin has 8/9 days. No-detection days never infer outages. Unknown FRP stays unknown. Only identical whole records are deduplicated. Country and department totals reconcile from the same assigned raw points.

## Technology with a purpose

| Choice | Function |
| --- | --- |
| Next.js, React, TypeScript | Shared selection, runtime-validated contracts, assets and private-key proxy |
| Three.js, compatible sphere, 2D and table | Geographic exploration and equivalent data access without GPU/pointer |
| Web Audio + AudioContext clock | Interactive synthesis and scheduled EIC sound; React renders the transport |
| Web Worker | Original WAV export without blocking interaction |
| Python, NumPy/Pandas, Shapely, Pillow | Reproducible clipping, quality checks, baseline and explainable visual features |
| Versioned JSON/gzip/manifests | Independent workstreams and offline data without an extra service/database |

[Technical decisions](docs/DECISIONES_TECNICAS.md) explain when another service, Docker, Redis or ML would become necessary.

## Verify and deliver

```bash
npm run test:web
npm run typecheck
npm run build
# Alternative Node deployment: npm run build:node && npm start
node --import tsx web/scripts/export-reference.mts
```

The last command writes original WAVs into ignored `out/reference/` and measured metadata into `docs/evaluation/`. Synthetic fixtures are tests only, never observations. The separate static demo build is `node web/scripts/build-archive-demo.mjs`: EIC/audio/archive are included, the recent Node API is explicitly excluded. [Full deployment](docs/DEPLOYMENT.md) · [API](docs/API_CONTRACT.md).

[53-task status](docs/ESTADO_53_TAREAS.md) · [Validation](docs/VALIDATION.md) · [Participant protocol](docs/evaluation/PROTOCOL.md) · [Demo](docs/DEMO_GUIDE.md) · [Credits](docs/ASSETS.md) · [Submission](docs/ENTREGA_SPACE_APPS.md).

[Recovered session and verified commits](docs/RECUPERACION_2026-11-15.md) · [Incremental development rules](AGENTS.md).

Participant sessions, independent mask labels, real GPU/screen-reader checks, final license approval and official submission remain evidence gates. Local and public NOAA-20 queries are recorded separately; their success does not establish full observation coverage. Automated checks do not establish comfort, comprehension or universal accessibility. No participant results or award guarantee is fabricated.
