"""Translate fire anomalies into musical parameters.

The mapping (the "audio grammar"), identical for every unit:

  anomaly z   -> dissonance 0..1   normal = consonant, abnormal = harsh
  latitude    -> pitch             south is low, north is high (pentatonic)
  fire power  -> loudness          summed FRP, log scaled
  fire count  -> rhythmic density  1..4 pulses per week
  longitude   -> stereo pan        west = left, east = right
"""
from __future__ import annotations

import datetime as dt

import numpy as np

from .pipeline import N_WEEKS, Grid

PENTATONIC = [0, 2, 4, 7, 9]
BASE_MIDI = 48                      # C3
N_OCTAVES = 3
Z_CALM, Z_MAX = 1.0, 4.0            # dissonance starts at z=1 and saturates at z=4
Z_ALERT, MIN_ALERT_COUNT = 2.5, 5

MAPPING_DOC = {
    "dissonance": f"0 when z <= {Z_CALM}, rising linearly to 1 at z >= {Z_MAX}",
    "midi": "latitude mapped onto a C major pentatonic scale over 3 octaves (south low, north high)",
    "detune_cents": "pitch offset that grows with dissonance (up to +-45 cents)",
    "interval": "semitones to a second voice: 7 perfect fifth (calm), 6 tritone (tense), 1 minor second (crisis)",
    "partner_gain": "loudness of that second voice, 0..1",
    "gain": "loudness 0..1 from summed fire radiative power (log scale)",
    "density": "pulses per week, 1..4, from hotspot count (log scale)",
    "pan": "-1 west .. +1 east",
    "data_gap": "true when the satellite record has a hole that week: no sound, level is no_data",
    "alert": f"true when z >= {Z_ALERT} and count >= {MIN_ALERT_COUNT}",
}


def dissonance(z):
    return np.clip((np.nan_to_num(np.asarray(z, dtype=float)) - Z_CALM) / (Z_MAX - Z_CALM), 0.0, 1.0)


def interval_for(d: float) -> int:
    return 7 if d < 0.33 else (6 if d < 0.66 else 1)


def level_for(z: float) -> str:
    return "critical" if z >= Z_ALERT else ("elevated" if z >= Z_CALM else "normal")


def chord_for(d: float) -> list[int]:
    """Country chord: open major when calm, tritone when tense, cluster in crisis."""
    if d < 0.33:
        return [BASE_MIDI - 12, BASE_MIDI - 5, BASE_MIDI + 4]
    if d < 0.66:
        return [BASE_MIDI - 12, BASE_MIDI - 6, BASE_MIDI + 4]
    return [BASE_MIDI - 12, BASE_MIDI - 11, BASE_MIDI - 6, BASE_MIDI + 3]


def lat_to_midi(lat: float, grid: Grid) -> int:
    n_notes = len(PENTATONIC) * N_OCTAVES
    t = (lat - grid.south) / (grid.north - grid.south)
    k = int(np.clip(t * n_notes, 0, n_notes - 1))
    return BASE_MIDI + 12 * (k // len(PENTATONIC)) + PENTATONIC[k % len(PENTATONIC)]


def _log_norm(v: float, ref: float) -> float:
    return float(np.clip(np.log1p(v) / np.log1p(max(ref, 1.0)), 0.0, 1.0))


def _voice(count, frp, z, lat, lon, grid, count_ref, frp_ref, flip):
    d = float(dissonance(z))
    return {
        "lat": round(float(lat), 3), "lon": round(float(lon), 3),
        "count": int(count), "frp": round(float(frp), 1), "z": round(float(z), 2),
        "level": level_for(z),
        "dissonance": round(d, 3),
        "midi": lat_to_midi(lat, grid),
        "detune_cents": round((-1 if flip else 1) * 45.0 * d, 1),
        "interval": interval_for(d),
        "partner_gain": round(0.15 + 0.65 * d, 3),
        "gain": round(_log_norm(frp, frp_ref), 3),
        "density": 1 + int(round(3 * _log_norm(count, count_ref))),
        "pan": round(float(np.clip(2 * (lon - grid.west) / (grid.east - grid.west) - 1, -1, 1)), 3),
        "alert": bool(z >= Z_ALERT and count >= MIN_ALERT_COUNT),
    }


def build_score(year: int, years, grid: Grid, counts, frp, z_cell, last_week,
                z_country, regions=None) -> dict:
    """Assemble the JSON document the web app plays for one year.

    regions: optional dict with names, region_of_cell, counts, frp, z (region level).
    """
    yi = int(np.where(years == year)[0][0])
    lat, lon = grid.centers()
    nz = counts[counts > 0]
    count_ref = float(np.percentile(nz, 99.9)) if nz.size else 1.0
    fz = frp[frp > 0]
    frp_ref = float(np.percentile(fz, 99.9)) if fz.size else 1.0

    c_country = counts.sum(axis=2)
    f_country = frp.sum(axis=2)

    weeks = []
    for wk in range(int(last_week[yi]) + 1):
        if np.isnan(z_country[yi, wk]):            # data gap: say so, play nothing
            weeks.append({"week": wk, "data_gap": True,
                          "start_date": (dt.date(year, 1, 1) + dt.timedelta(days=7 * wk)).isoformat(),
                          "country": {"count": int(c_country[yi, wk]), "frp": round(float(f_country[yi, wk]), 1),
                                      "z": None, "level": "no_data", "dissonance": 0.0, "chord": []},
                          "cells": [], **({"regions": []} if regions is not None else {})})
            continue
        zc = float(z_country[yi, wk])
        dc = float(dissonance(zc))
        cells = []
        for c in np.nonzero(counts[yi, wk] > 0)[0]:
            cells.append(_voice(counts[yi, wk, c], frp[yi, wk, c], z_cell[yi, wk, c],
                                lat[c], lon[c], grid, count_ref, frp_ref, flip=bool(c % 2)))
        entry = {
            "week": wk, "data_gap": False,
            "start_date": (dt.date(year, 1, 1) + dt.timedelta(days=7 * wk)).isoformat(),
            "country": {
                "count": int(c_country[yi, wk]), "frp": round(float(f_country[yi, wk]), 1),
                "z": round(zc, 2), "level": level_for(zc),
                "dissonance": round(dc, 3), "chord": chord_for(dc),
            },
            "cells": cells,
        }
        if regions is not None:
            reg = []
            for r, name in enumerate(regions["names"]):
                n = regions["counts"][yi, wk, r]
                zr = float(regions["z"][yi, wk, r])
                reg.append({"name": name, "count": int(n),
                            "frp": round(float(regions["frp"][yi, wk, r]), 1),
                            "z": round(zr, 2), "level": level_for(zr),
                            "dissonance": round(float(dissonance(zr)), 3),
                            "alert": bool(zr >= Z_ALERT and n >= MIN_ALERT_COUNT)})
            entry["regions"] = reg
        weeks.append(entry)

    return {
        "meta": {
            "project": "TerraEcho",
            "source": "NASA FIRMS active fire hotspots (VIIRS 375 m)",
            "year": int(year),
            "baseline_years": [int(v) for v, lw in zip(years, last_week) if v != year and lw >= 0],
            "grid": {"west": grid.west, "south": grid.south, "east": grid.east,
                     "north": grid.north, "res_deg": grid.res},
            "weeks_per_year": N_WEEKS,
            "anomaly": "robust z-score of log1p(weekly hotspot count) vs the same week in the other years (median/MAD)",
            "mapping": MAPPING_DOC,
        },
        "weeks": weeks,
    }
