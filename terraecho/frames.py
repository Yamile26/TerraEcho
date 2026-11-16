"""Turn an EIC visual frame into sound, layer by layer.

Follows the idea of NASA's "Data Sonification: Caldwell 73" (SVS 13786): a
scan line sweeps the image, colour picks the instrument, and position picks
the pitch. Here the frame is the GEOS Aerosols still (SVS 5669), whose four
colours are four aerosol types.

  colour (aerosol type) -> instrument
  amount of that colour under the scan line -> loudness
  vertical position (north = up) -> pitch
  horizontal position of the scan line -> time and stereo pan

The colour windows below are read from the visualization's own colour bar.
They classify what the picture shows; they are not a measurement of aerosol
concentration.
"""

from __future__ import annotations

import colorsys
import wave

import numpy as np

from .render import SR, midi_to_hz

# hue windows in degrees, from the GEOS Aerosols colour bar
LAYERS = {
    "black_carbon": {
        "label": "Black carbon (fire smoke)",
        "hue": [(345, 360), (0, 45)],
        "min_sat": 0.35,
        "base_midi": 48,
        "harmonics": (1.0, 0.35, 0.15),
    },  # same voice as the fire track
    "dust": {
        "label": "Dust",
        "hue": [(245, 300)],
        "min_sat": 0.15,
        "base_midi": 36,
        "harmonics": (1.0, 0.6, 0.4, 0.25),
    },  # low and rough
    "sea_salt": {
        "label": "Sea salt",
        "hue": [(160, 230)],
        "min_sat": 0.15,
        "base_midi": 72,
        "harmonics": (1.0,),
    },  # high and pure
    "sulfate": {
        "label": "Sulfate",
        "hue": [(80, 150)],
        "min_sat": 0.35,
        "base_midi": 60,
        "harmonics": (1.0, 0.0, 0.3, 0.0, 0.15),
    },  # hollow, bell-like
}
PENTATONIC = [0, 2, 4, 7, 9]
# Version 2 rejects muted base-map colors more conservatively. These thresholds
# describe the rendered picture, not a calibrated atmospheric retrieval.
MIN_SAT, MIN_VAL = 0.15, 0.20


def _rgb_to_hsv(rgb: np.ndarray):
    """Vectorised RGB (0..1) -> hue in degrees, saturation, value."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx, mn = rgb.max(axis=-1), rgb.min(axis=-1)
    d = mx - mn
    safe = np.where(d == 0, 1, d)
    h = np.where(
        mx == r,
        ((g - b) / safe) % 6,
        np.where(mx == g, (b - r) / safe + 2, (r - g) / safe + 4),
    )
    h = np.where(d == 0, 0, h) * 60
    s = np.where(mx == 0, 0, d / np.where(mx == 0, 1, mx))
    return h, s, mx


def layer_masks(rgb: np.ndarray) -> dict:
    """Per-layer weight image (0..1): how strongly each pixel shows that aerosol colour."""
    h, s, v = _rgb_to_hsv(rgb)
    out = {}
    for name, spec in LAYERS.items():
        strong = (s >= spec["min_sat"]) & (v >= MIN_VAL)
        in_hue = np.zeros(h.shape, dtype=bool)
        for lo, hi in spec["hue"]:
            in_hue |= (h >= lo) & (h < hi)
        out[name] = np.where(in_hue & strong, s * v, 0.0)
    return out


def scan(image_path: str, n_steps: int = 104, crop=None) -> dict:
    """Sweep the frame left to right and return the score.

    crop: optional (x0, y0, x1, y1) as fractions of the image, e.g. a box
    around South America.
    """
    from PIL import Image

    if not isinstance(n_steps, int) or not 8 <= n_steps <= 512:
        raise ValueError("steps must be an integer between 8 and 512")
    if crop is not None and (
        len(crop) != 4
        or not all(np.isfinite(crop))
        or not 0 <= crop[0] < crop[2] <= 1
        or not 0 <= crop[1] < crop[3] <= 1
    ):
        raise ValueError("crop must be finite fractions x0,y0,x1,y1 in [0,1]")
    rgb = np.asarray(Image.open(image_path).convert("RGB"), dtype=float) / 255.0
    H, W, _ = rgb.shape
    x0, y0, x1, y1 = crop or (0.0, 0.0, 1.0, 1.0)
    rgb = rgb[int(y0 * H) : int(y1 * H), int(x0 * W) : int(x1 * W)]
    h, w, _ = rgb.shape
    if h < 2 or w < n_steps:
        raise ValueError("crop must have at least two rows and one column per step")
    masks = layer_masks(rgb)
    edges = np.linspace(0, w, n_steps + 1).astype(int)
    rows = np.arange(h)[:, None]

    raw = {}
    for name, m in masks.items():
        amount, height, fraction = [], [], []
        for i in range(n_steps):
            band = m[:, edges[i] : edges[i + 1]]
            tot = band.sum()
            amount.append(tot / band.size)
            fraction.append(float((band > 0).mean()))
            # 1 = top of the frame, 0 = bottom
            height.append(1 - (band * rows).sum() / tot / (h - 1) if tot > 0 else 0.5)
        raw[name] = (np.array(amount), np.array(height), np.array(fraction))

    steps = []
    for i in range(n_steps):
        layers = {}
        for name, (amount, height, fraction) in raw.items():
            ref = max(np.percentile(amount, 98), 1e-9)
            k = int(np.clip(height[i] * 10, 0, 9))  # two pentatonic octaves
            midi = LAYERS[name]["base_midi"] + 12 * (k // 5) + PENTATONIC[k % 5]
            layers[name] = {
                "gain": round(float(np.clip(amount[i] / ref, 0, 1)), 3),
                "midi": int(midi),
                "height": round(float(height[i]), 3),
                "presence": round(float(fraction[i]), 6),
                "weight": round(float(amount[i]), 6),
                "normalizer": round(float(ref), 9),
            }
        steps.append(
            {
                "step": i,
                "x": round((i + 0.5) / n_steps, 4),
                "pan": round(2 * (i + 0.5) / n_steps - 1, 3),
                "layers": layers,
            }
        )

    return {
        "meta": {
            "project": "TerraEcho",
            "schema_version": "2.0.0",
            "extractor_version": "hsv-scan-2",
            "source": "NASA SVS, GEOS Aerosols (EIC), https://svs.gsfc.nasa.gov/5669/",
            "method": "scan line left to right; colour -> instrument, amount -> gain, height -> pitch "
            "(after NASA SVS 13786, Data Sonification: Caldwell 73)",
            "image": image_path.replace("\\", "/"),
            "crop": list(crop) if crop else None,
            "n_steps": n_steps,
            "thresholds": {
                "min_saturation": MIN_SAT,
                "min_value": MIN_VAL,
                "saturation_per_layer": {k: v["min_sat"] for k, v in LAYERS.items()},
            },
            "normalization": "per-layer 98th percentile within the selected image crop; not cross-layer concentration",
            "coordinate_space": "image pixels; not a geographic projection inversion",
            "crop_pixels": [int(x0 * W), int(y0 * H), int(x1 * W), int(y1 * H)],
            "layers": {
                k: {
                    "label": v["label"],
                    "hue_windows_deg": v["hue"],
                    "harmonics": list(v["harmonics"]),
                }
                for k, v in LAYERS.items()
            },
            "coverage": {k: round(float((m > 0).mean()), 4) for k, m in masks.items()},
        },
        "steps": steps,
    }


def render(score: dict, path: str, seconds_per_step: float = 0.25, only=None) -> float:
    """Reference WAV render. only: optional list of layer names to solo."""
    n = int(SR * seconds_per_step)
    steps = score["steps"]
    left = np.zeros(n * len(steps))
    right = np.zeros(n * len(steps))
    t = np.arange(n) / SR
    fade = np.minimum(1.0, np.minimum(np.arange(n), np.arange(n)[::-1]) / (0.03 * SR))
    for i, st in enumerate(steps):
        sig = np.zeros(n)
        for name, v in st["layers"].items():
            if (only and name not in only) or v["gain"] <= 0.02:
                continue
            f = midi_to_hz(v["midi"])
            tone = sum(
                a * np.sin(2 * np.pi * f * k * t)
                for k, a in enumerate(LAYERS[name]["harmonics"], start=1)
                if a and f * k < SR / 2
            )
            sig += 0.22 * v["gain"] * tone
        sig *= fade
        ang = (st["pan"] + 1) * np.pi / 4
        left[i * n : (i + 1) * n] = np.cos(ang) * sig
        right[i * n : (i + 1) * n] = np.sin(ang) * sig
    pcm = (np.tanh(np.stack([left, right], axis=1)) * 32767 * 0.9).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    return len(left) / SR
