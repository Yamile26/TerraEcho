# Web and Python data contract

## Historical score

`GET /api/fires?year=2026` returns the **existing Python score object directly**, including `meta` and `weeks`. The response header `X-TerraEcho-Source` identifies `repository-snapshot` or `python`.

Default local provider reads the prepared `web/public/data/terraecho_<year>.json`. Only 2025 and 2026 are shipped. Requests for unexported years return `404 DATA_NOT_EXPORTED`; they never return made-up data. Input years are bounded to 2012–2026.

Set the server-only environment variable `TERRAECHO_PYTHON_API_URL=https://your-service.example/` to switch to a separately deployed Python HTTP service. It must implement `GET /v1/scores/{year}` and return the same JSON shape. It must validate and return 404 for absent years. The web adapter checks the returned year and contract and fails visibly on provider errors. This Python HTTP service is **not implemented or deployed by this web change**; the existing Python batch pipeline is preserved.

| Field | Meaning |
| --- | --- |
| `meta.year` | Selected exported year |
| `meta.baseline_years` | Actual comparison years used by Python |
| `weeks[].week` | Zero-based seven-day bin starting January 1; not ISO week number |
| `weeks[].start_date` | Calendar start date of that bin |
| `weeks[].data_gap` | Insufficient coverage, must be silent |
| `weeks[].country` | Existing bounding-box aggregate; not a strictly national boundary cut |
| `weeks[].regions` | Aggregates by department, using grid-center assignment |
| `weeks[].cells` | Locations and audio parameters for occupied grid cells |
| `z` | Robust anomaly vs. the same period in other years; `null` for a gap |
| `frp` | Sum of per-detection fire radiative power in MW, not simultaneous power |
| `midi`, `detune_cents`, `interval`, `partner_gain` | Tone and dissonance parameters |
| `gain`, `density`, `pan` | Loudness, pulse count and stereo pan |

No observations, no fire and no data coverage are different states. A data-gap week keeps `z: null`, `level: no_data`, empty `cells`, and no synthesized sound. Exported CSVs keep unknown values empty.

## Recent detections

`GET /api/fires?mode=live&days=1` uses a server-only `FIRMS_MAP_KEY`. Optional `date=YYYY-MM-DD` sets a start date; days is an integer from 1 to 5, following the official [FIRMS Area API](https://firms.modaps.eosdis.nasa.gov/api/area/). The source is fixed to `VIIRS_SNPP_NRT` and bounds to `-81.5,-18.5,-68.5,0`.

```json
{
  "meta": {
    "provider": "NASA FIRMS",
    "source": "VIIRS_SNPP_NRT",
    "mode": "live",
    "days": 1,
    "startDate": null,
    "retrievedAt": "ISO-8601 UTC timestamp",
    "bbox": [-81.5, -18.5, -68.5, 0],
    "geographicScope": "bounding-box-includes-neighboring-territory",
    "anomalyComputed": false
  },
  "observations": []
}
```

Each observation has `latitude`, `longitude`, `frp` (nullable), `acquiredAt` (UTC), `confidence` and `satellite`. These recent detections do not receive a baseline z-score in the browser and do not replace historical scores. The source dialog can check the connection and report the response count. There is no continuous monitoring or push alert delivery.

Protection: 15-second upstream timeout, 8 MB response cap, CSV schema checks, a two-minute in-memory cache, in-flight request deduplication and a ten-upstream-requests/minute/process limit. For a multi-instance public deployment use a shared rate limiter/cache; the current limiter is per process. Key contents and upstream URLs containing the key are never returned or logged by application code.

| HTTP | Error code | Meaning |
| --- | --- | --- |
| 400 | `INVALID_MODE`, `INVALID_YEAR`, `INVALID_QUERY` | Invalid input |
| 404 | `DATA_NOT_EXPORTED` | Year has no exported score |
| 429 | `UPSTREAM_RATE_LIMIT` | Per-process upstream budget exhausted |
| 503 | `FIRMS_NOT_CONFIGURED` | Server key missing; archives remain usable |
| 502 | `SCORE_UNAVAILABLE`, `FIRMS_UNAVAILABLE` | Invalid/unavailable upstream; no synthetic fallback |

`GET /api/health` returns service status, selected score provider and whether FIRMS is configured. It returns no key or internal service URL.
