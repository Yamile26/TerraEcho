"""Build the blind listening test: three unlabeled clips from three real years.

  python scripts/listening_test.py --raw data/raw --out data/listening_test

Picks the year with the most hotspots, a typical year and the quietest year,
renders each one, and names the clips A, B, C in random order. The answer is
written to key.txt. Do not share key.txt with listeners.
Question to ask: "Which clip sounds like the worst fire year?"
"""
import argparse
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from terraecho import pipeline as P          # noqa: E402
from terraecho.render import render          # noqa: E402
from terraecho.sonify import build_score     # noqa: E402


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--raw", default="data/raw")
    ap.add_argument("--out", default="data/listening_test")
    ap.add_argument("--satellite", default="N")
    ap.add_argument("--seconds-per-week", type=float, default=0.3)
    ap.add_argument("--seed", type=int, default=7)
    a = ap.parse_args()

    os.makedirs(a.out, exist_ok=True)
    grid = P.Grid(*P.PERU_BBOX, res=0.5)
    df = P.load_firms(a.raw, satellite=None if a.satellite == "all" else a.satellite)
    years, counts, frp, last_week = P.aggregate(df, grid)
    z_cell = P.anomaly(counts, last_week)
    z_country = P.anomaly(counts.sum(axis=2, keepdims=True), last_week)[:, :, 0]

    # only complete years, ranked by total hotspots
    full = [(counts[i].sum(), int(y)) for i, y in enumerate(years) if last_week[i] == P.N_WEEKS - 1]
    full.sort()
    picks = {"quietest": full[0], "typical": full[len(full) // 2], "worst": full[-1]}

    order = list(picks.items())
    random.Random(a.seed).shuffle(order)
    lines = []
    for label, (kind, (total, year)) in zip("ABC", order):
        score = build_score(year, years, grid, counts, frp, z_cell, last_week, z_country)
        secs = render(score, os.path.join(a.out, f"clip_{label}.wav"), a.seconds_per_week)
        lines.append(f"clip_{label}.wav = {year} ({kind}, {int(total):,} hotspots, {secs:.0f} s)")
    with open(os.path.join(a.out, "key.txt"), "w", encoding="utf-8") as f:
        f.write("ANSWER KEY - do not share with listeners\n" + "\n".join(lines) + "\n")
    print("\n".join(lines))
    print(f"Clips and key.txt written to {a.out}")


if __name__ == "__main__":
    main()
