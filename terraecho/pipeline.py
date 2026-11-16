"""Load FIRMS hotspots, grid them by week, and score how abnormal each week is.

The anomaly is the heart of TerraEcho: we do not sonify the raw fire count,
we sonify how far a week departs from what is normal for that place and
that time of year.
"""
from __future__ import annotations

import glob
import json
import os
from dataclasses import dataclass

import numpy as np
import pandas as pd

# Peru bounding box (west, south, east, north)
PERU_BBOX = (-81.5, -18.5, -68.5, 0.0)
N_WEEKS = 52
MAX_EMPTY_DAYS = 2          # a week with more empty days than this is treated as a data gap
STATIC_RES = 0.02          # degrees (~2 km): neighbourhood of a known non-fire heat source


@dataclass
class Grid:
    west: float
    south: float
    east: float
    north: float
    res: float

    @property
    def n_lat(self) -> int:
        return int(np.ceil((self.north - self.south) / self.res))

    @property
    def n_lon(self) -> int:
        return int(np.ceil((self.east - self.west) / self.res))

    @property
    def n_cells(self) -> int:
        return self.n_lat * self.n_lon

    def cell_of(self, lat, lon):
        i = np.floor((np.asarray(lat) - self.south) / self.res).astype(int)
        j = np.floor((np.asarray(lon) - self.west) / self.res).astype(int)
        return i * self.n_lon + j

    def centers(self):
        """Return (lat, lon) arrays of cell centres, indexed by cell id."""
        i, j = np.divmod(np.arange(self.n_cells), self.n_lon)
        return self.south + (i + 0.5) * self.res, self.west + (j + 0.5) * self.res


def clip_to_country(df: pd.DataFrame, geojson_path: str, buffer_deg: float = 0.02) -> pd.DataFrame:
    """Keep only detections inside the country outline (union of the polygons in the file).

    Yearly FIRMS country files are already clipped, but API and area downloads
    cover a rectangle and bring in fires from neighbouring countries. Clipping
    every year with the same outline keeps all years comparable.
    """
    import shapely
    from shapely.geometry import shape
    from shapely.ops import unary_union

    with open(geojson_path, encoding="utf-8") as f:
        gj = json.load(f)
    outline = unary_union([shape(ft["geometry"]) for ft in gj["features"]]).buffer(buffer_deg)
    shapely.prepare(outline)
    inside = shapely.contains_xy(outline, df.longitude.to_numpy(), df.latitude.to_numpy())
    if (~inside).any():
        lost = df.loc[~inside, "acq_date"].dt.year.value_counts().sort_index()
        detail = ", ".join(f"{y}: {n:,}" for y, n in lost.items() if n >= 100)
        print(f"note: dropped {int((~inside).sum()):,} detections outside the country outline ({detail})")
    return df[inside]


def load_firms(raw_dir: str, bbox=PERU_BBOX, satellite: str | None = "N",
               drop_low_confidence: bool = True,
               clip_geojson: str | None = "data/peru_departments.geojson") -> pd.DataFrame:
    """Read every FIRMS CSV in raw_dir into one clean table.

    satellite: keep one platform so the record is consistent across years
    ("N" = Suomi NPP in FIRMS VIIRS files). Pass None to keep everything.
    """
    files = sorted(glob.glob(os.path.join(raw_dir, "*.csv")))
    if not files:
        raise FileNotFoundError(f"No FIRMS CSV files found in {raw_dir}")
    frames = []
    for f in files:
        d = pd.read_csv(f, dtype={"confidence": str, "satellite": str, "acq_time": str})
        d.columns = [c.strip().lower() for c in d.columns]
        frames.append(d)
    df = pd.concat(frames, ignore_index=True)

    missing = {"latitude", "longitude", "acq_date", "frp"} - set(df.columns)
    if missing:
        raise ValueError(f"FIRMS files are missing columns: {sorted(missing)}")

    df["acq_date"] = pd.to_datetime(df["acq_date"])
    df["frp"] = pd.to_numeric(df["frp"], errors="coerce").fillna(0.0).clip(lower=0)

    w, s, e, n = bbox
    df = df[(df.longitude >= w) & (df.longitude < e) & (df.latitude >= s) & (df.latitude < n)]

    if clip_geojson and os.path.exists(clip_geojson):
        df = clip_to_country(df, clip_geojson)
    elif clip_geojson:
        print(f"WARNING: {clip_geojson} not found; data is NOT clipped to the country outline")

    # Near real-time (NRT) rows are provisional. Where science-quality (SP) rows
    # exist for the same dates, keep SP only, so no day is counted twice.
    if "version" in df.columns:
        nrt = df["version"].astype(str).str.upper().str.contains("NRT")
        if nrt.any() and (~nrt).any():
            last_sp = df.loc[~nrt, "acq_date"].max()
            overlap = nrt & (df["acq_date"] <= last_sp)
            if overlap.any():
                print(f"note: dropped {int(overlap.sum()):,} NRT rows up to {last_sp.date()} (SP data covers those dates)")
            df = df[~overlap]

    # type exists only in SP files: 0 = vegetation fire, 1 = volcano, 2 = other
    # static land source, 3 = offshore. NRT rows have no type, so we also drop
    # any detection sitting on a spot that SP has flagged as a non-fire source.
    if "type" in df.columns:
        t = pd.to_numeric(df["type"], errors="coerce")
        key = (df.latitude / STATIC_RES).round().astype(int) * 100000 + (df.longitude / STATIC_RES).round().astype(int)
        static_spots = set(key[t.isin([1, 2, 3])])
        on_static = key.isin(static_spots) & t.isna()
        if on_static.any():
            print(f"note: dropped {int(on_static.sum()):,} untyped detections on known non-fire heat sources (volcanoes, industry)")
        df = df[(t.isna() | (t == 0)) & ~on_static]

    if satellite is not None and "satellite" in df.columns:
        df = df[df["satellite"].str.strip() == satellite]

    if drop_low_confidence and "confidence" in df.columns:
        c = df["confidence"].str.strip().str.lower()
        numeric = pd.to_numeric(c, errors="coerce")           # MODIS style 0-100
        low = c.isin(["l", "low"]) | (numeric < 30)
        df = df[~low]

    keys = [k for k in ["latitude", "longitude", "acq_date", "acq_time"] if k in df.columns]
    df = df.drop_duplicates(subset=keys)
    if df.empty:
        raise ValueError("No hotspots left after filtering. Check satellite/bbox settings.")
    return df.reset_index(drop=True)


def week_of_year(dates: pd.Series) -> np.ndarray:
    """Calendar-aligned week index 0..51 (the last week absorbs the extra days)."""
    return np.minimum((dates.dt.dayofyear.to_numpy() - 1) // 7, N_WEEKS - 1)


def aggregate(df: pd.DataFrame, grid: Grid):
    """Return years, counts[year, week, cell], frp[year, week, cell], last_week per year."""
    years = np.arange(df.acq_date.dt.year.min(), df.acq_date.dt.year.max() + 1)
    y = df.acq_date.dt.year.to_numpy() - years[0]
    wk = week_of_year(df.acq_date)
    cell = grid.cell_of(df.latitude.to_numpy(), df.longitude.to_numpy())

    shape = (len(years), N_WEEKS, grid.n_cells)
    counts = np.zeros(shape)
    frp = np.zeros(shape)
    np.add.at(counts, (y, wk, cell), 1.0)
    np.add.at(frp, (y, wk, cell), df.frp.to_numpy())

    # days with at least one detection, per (year, week): a week with several
    # empty days is a hole in the record (satellite outage or failed download)
    days = df.assign(y=y, wk=wk).drop_duplicates(subset=["y", "wk", "acq_date"])
    observed = np.zeros((len(years), N_WEEKS))
    np.add.at(observed, (days.y.to_numpy(), days.wk.to_numpy()), 1.0)
    week_len = np.full(N_WEEKS, 7.0)
    week_len[-1] = 8.0
    # only where that week of the year is normally observed almost every day;
    # in the wet season, empty days are ordinary and are not treated as gaps
    usually_full = np.median(observed, axis=0) >= week_len - 1
    gap = (observed < (week_len[None, :] - MAX_EMPTY_DAYS)) & usually_full[None, :]

    # last week that has data in each year (the current year is incomplete)
    last_week = np.full(len(years), N_WEEKS - 1)
    last_date = df.acq_date.max()
    last_week[-1] = min((last_date.dayofyear - 1) // 7, N_WEEKS - 1)
    # a year with no rows at all is a missing file, not a year without fire:
    # mask it so it never enters a baseline as zeros
    empty = counts.sum(axis=(1, 2)) == 0
    last_week[empty] = -1
    for yr in years[empty]:
        print(f"WARNING: no data for {yr}; excluded from every baseline (missing file?)")
    return years, counts, frp, last_week, gap


def _smooth_weeks(x: np.ndarray, half: int = 1) -> np.ndarray:
    """Circular moving average along the week axis (axis=1)."""
    out = np.zeros_like(x)
    for k in range(-half, half + 1):
        out += np.roll(x, k, axis=1)
    return out / (2 * half + 1)


def anomaly(counts: np.ndarray, last_week: np.ndarray, gap: np.ndarray | None = None,
            min_scale: float = 0.35) -> np.ndarray:
    """Robust z-score of every (year, week, unit) against the other years.

    Works on log1p(count). For each target year the baseline is every other
    year (leave-one-out), using the median and the MAD of the same week of
    year, lightly smoothed over neighbouring weeks. Weeks after the last
    observation of a year, and weeks flagged as data gaps, are NaN.

    counts: [year, week, unit] where unit is a cell, a region or the country.
    """
    x = np.log1p(counts)
    xs = _smooth_weeks(x)
    n_years = x.shape[0]
    valid = np.arange(N_WEEKS)[None, :] <= last_week[:, None]      # [year, week]
    if gap is not None:
        valid &= ~gap
    xs_masked = np.where(valid[:, :, None], xs, np.nan)

    z = np.full_like(x, np.nan)
    for yi in range(n_years):
        base = np.delete(xs_masked, yi, axis=0)
        med = np.nanmedian(base, axis=0)
        mad = np.nanmedian(np.abs(base - med), axis=0)
        scale = np.maximum(1.4826 * mad, min_scale)
        z[yi] = (x[yi] - med) / scale
    z[~valid] = np.nan
    return z


def load_regions(geojson_path: str, grid: Grid, name_key: str | None = None):
    """Assign each grid cell to a polygon (e.g. a department). Needs shapely.

    Returns (names, region_of_cell) where region_of_cell is -1 outside all polygons.
    """
    from shapely.geometry import Point, shape

    with open(geojson_path, encoding="utf-8") as f:
        gj = json.load(f)
    feats = gj["features"]
    if name_key is None:
        props = feats[0].get("properties", {})
        candidates = ["NOMBDEP", "name", "NAME_1", "shapeName", "departamento", "DEPARTAMEN"]
        name_key = next((k for k in candidates if k in props), next(iter(props)))
    names = [str(ft["properties"][name_key]) for ft in feats]
    polys = [shape(ft["geometry"]) for ft in feats]
    lat, lon = grid.centers()
    region = np.full(grid.n_cells, -1)
    for c in range(grid.n_cells):
        p = Point(lon[c], lat[c])
        for r, poly in enumerate(polys):
            if poly.contains(p):
                region[c] = r
                break
    return names, region


def sum_by_region(arr: np.ndarray, region: np.ndarray, n_regions: int) -> np.ndarray:
    out = np.zeros(arr.shape[:2] + (n_regions,))
    for r in range(n_regions):
        out[:, :, r] = arr[:, :, region == r].sum(axis=2)
    return out
