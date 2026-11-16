"""Reproduce the curated EIC pieces from the original NASA frame, without downloads.

    python scripts/prepare_eic_catalog.py

These are three readings of ONE real frame, not three different dates.
Generated masks describe visible colors and do not measure concentrations.
"""

from __future__ import annotations
import datetime as dt
import hashlib
import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from terraecho.frames import scan, layer_masks, render, LAYERS

SOURCE = ROOT / "data/eic/Aerosols_2025-08-19T20_00_00_1920x1080.png"
OUT = ROOT / "data/eic/pieces"
COLORS = {
    "black_carbon": (245, 154, 103),
    "dust": (189, 155, 230),
    "sea_salt": (127, 199, 226),
    "sulfate": (169, 221, 158),
}
PIECES = [
    {
        "id": "aerosols-global",
        "title": "Un planeta, cuatro voces",
        "question": "¿Cómo se distribuyen los colores de aerosoles en esta imagen?",
        "crop": None,
        "enabled": list(LAYERS),
        "description": "Barrido completo de la imagen global. Cada color activa un timbre distinto.",
    },
    {
        "id": "aerosols-smoke",
        "title": "Escuchar el color del humo",
        "question": "¿En qué segmentos aparece más color asociado al humo?",
        "crop": None,
        "enabled": ["black_carbon"],
        "description": "La misma imagen global con la voz naranja/roja aislada. No identifica el origen exacto de cada pluma.",
    },
    {
        "id": "aerosols-south-america",
        "title": "Una escucha desde Sudamérica",
        "question": "¿Qué cambia al escuchar un encuadre de Sudamérica?",
        "crop": [0.26, 0.43, 0.42, 0.83],
        "enabled": list(LAYERS),
        "description": "Encuadre visual aproximado de Sudamérica y océano vecino. No es un recorte geográfico exacto de Perú.",
    },
]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    image = Image.open(SOURCE).convert("RGB")
    sha = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    catalog = {
        "schema_version": "1.0.0",
        "source": {
            "id": "NASA-SVS-5669",
            "url": "https://svs.gsfc.nasa.gov/5669/",
            "observedAt": "2025-08-19T20:00:00Z",
            "publishedAt": "2026-08-10",
            "credit": "NASA GMAO / NASA Scientific Visualization Studio; Joseph V. Ardizzone, Helen-Nicole Kostis; scientific consulting Lesley Ott",
            "sha256": sha,
            "originalDownloadedAt": None,
            "method": "https://svs.gsfc.nasa.gov/13786/",
            "limitations": "Visual features of a GEOS model rendering, not measured concentrations. Color overlap and base-map contamination remain possible.",
        },
        "pieces": [],
    }
    for spec in PIECES:
        score = scan(str(SOURCE.relative_to(ROOT)), n_steps=104, crop=spec["crop"])
        score["meta"]["image_sha256"] = sha
        score["meta"]["observed_at"] = catalog["source"]["observedAt"]
        score["meta"]["piece_id"] = spec["id"]
        (OUT / f"{spec['id']}.json").write_text(
            json.dumps(score, separators=(",", ":"), allow_nan=False)
        )
        bounds = score["meta"]["crop_pixels"]
        piece = image.crop(tuple(bounds))
        if spec["crop"] is not None:
            piece.save(OUT / f"{spec['id']}.png", optimize=True)
        masks = layer_masks(np.asarray(piece, dtype=float) / 255)
        rgb = np.zeros((piece.height, piece.width, 3), dtype=float)
        for name, mask in masks.items():
            rgb += (mask > 0)[..., None] * np.array(COLORS[name])[None, None, :]
        if spec["id"] != "aerosols-smoke":
            Image.fromarray(np.clip(rgb, 0, 255).astype("uint8")).save(
                OUT / f"{spec['id']}-mask.png", optimize=True
            )
        entry = {
            **spec,
            "score": f"/eic/pieces/{spec['id']}.json",
            "image": (
                f"/eic/pieces/{spec['id']}.png" if spec["crop"] else "/eic/aerosols.png"
            ),
            "mask": f"/eic/pieces/{'aerosols-global' if spec['id']=='aerosols-smoke' else spec['id']}-mask.png",
            "steps": 104,
            "durationSeconds": 26,
            "cropPixels": bounds,
        }
        catalog["pieces"].append(entry)
    (OUT / "catalog.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=2))
    print(
        "Prepared 3 curated readings of the same real NASA EIC frame, with masks and source hashes."
    )


if __name__ == "__main__":
    main()
