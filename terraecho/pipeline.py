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


def load_firms(raw_dir: str, bbox=PERU_BBOX, satellite: str | None = "N",
               drop_low_confidence: bool = True) -> pd.DataFrame:
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

    # type exists only in archive files: 0 = presumed vegetation fire
    if "type" in df.columns:
        t = pd.to_numeric(df["type"], errors="coerce")
        df = df[t.isna() | (t == 0)]

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
    return years, counts, frp, last_week


def _smooth_weeks(x: np.ndarray, half: int = 1) -> np.ndarray:
    """Circular moving average along the week axis (axis=1)."""
    out = np.zeros_like(x)
    for k in range(-half, half + 1):
        out += np.roll(x, k, axis=1)
    return out / (2 * half + 1)


def anomaly(counts: np.ndarray, last_week: np.ndarray, min_scale: float = 0.35) -> np.ndarray:
    """Robust z-score of every (year, week, unit) against the other years.

    Works on log1p(count). For each target year the baseline is every other
    year (leave-one-out), using the median and the MAD of the same week of
    year, lightly smoothed over neighbouring weeks. Weeks after the last
    observation of a year are NaN.

    counts: [year, week, unit] where unit is a cell, a region or the country.
    """
    x = np.log1p(counts)
    xs = _smooth_weeks(x)
    n_years = x.shape[0]
    valid = np.arange(N_WEEKS)[None, :] <= last_week[:, None]      # [year, week]
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
    names = [str(ft["properties"][name_key]).title() for ft in feats]
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
