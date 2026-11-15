"""Sonify an EIC frame (GEOS Aerosols still).

  python run_eic.py
  python run_eic.py --image data/eic/Aerosols_2025-08-19T20_00_00_1920x1080.png --out data/scores
  python run_eic.py --crop 0.18 0.35 0.42 0.85 --name aerosols_south_america
"""
import argparse
import json
import os

from terraecho import frames as F

DEFAULT_IMAGE = "data/eic/Aerosols_2025-08-19T20_00_00_1920x1080.png"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--image", default=DEFAULT_IMAGE)
    ap.add_argument("--out", default="data/scores")
    ap.add_argument("--name", default="eic_aerosols")
    ap.add_argument("--steps", type=int, default=104)
    ap.add_argument("--crop", type=float, nargs=4, metavar=("X0", "Y0", "X1", "Y1"),
                    help="box as fractions of the image")
    a = ap.parse_args()

    os.makedirs(a.out, exist_ok=True)
    score = F.scan(a.image, a.steps, tuple(a.crop) if a.crop else None)
    jpath = os.path.join(a.out, f"{a.name}.json")
    with open(jpath, "w", encoding="utf-8") as f:
        json.dump(score, f, separators=(",", ":"))
    print(jpath, " share of the frame per layer:", score["meta"]["coverage"])
    print(os.path.join(a.out, f"{a.name}.wav"), f"{F.render(score, os.path.join(a.out, a.name + '.wav')):.1f} s")
    for name in F.LAYERS:                                   # one solo file per instrument
        F.render(score, os.path.join(a.out, f"{a.name}_{name}.wav"), only=[name])
    print("plus one solo WAV per layer")


if __name__ == "__main__":
    main()
