"""Render a TerraEcho score to a stereo WAV file with plain numpy.

This is an offline reference synth: it lets us listen to a season, build the
listening-test clips and the short alert audio without the web app. The web
app plays the same parameters live with the Web Audio API.
"""
from __future__ import annotations

import wave

import numpy as np

SR = 22050
ROUGH_HZ = 30.0                     # tremolo rate that the ear hears as roughness


def midi_to_hz(m, cents=0.0):
    return 440.0 * 2 ** ((m - 69) / 12 + cents / 1200)


def _tone(freq, n, harmonics=(1.0, 0.35, 0.15)):
    t = np.arange(n) / SR
    out = np.zeros(n)
    for k, a in enumerate(harmonics, start=1):
        if freq * k < SR / 2:
            out += a * np.sin(2 * np.pi * freq * k * t)
    return out


def _pulses(n, density):
    """Decaying pluck envelope repeated `density` times across n samples."""
    env = np.zeros(n)
    step = n // density
    for k in range(density):
        seg = np.arange(n - k * step)
        env[k * step:] = np.maximum(env[k * step:], np.exp(-seg / (0.12 * SR)))
    return env


def render(score: dict, path: str, seconds_per_week: float = 0.5, max_voices: int = 12) -> float:
    """Write the WAV and return its duration in seconds."""
    n = int(SR * seconds_per_week)
    weeks = score["weeks"]
    left = np.zeros(n * len(weeks))
    right = np.zeros(n * len(weeks))
    fade = np.minimum(1.0, np.minimum(np.arange(n), np.arange(n)[::-1]) / (0.02 * SR))

    t = np.arange(n) / SR
    for i, wk in enumerate(weeks):
        a, b = i * n, (i + 1) * n
        if wk.get("data_gap"):
            continue                                            # no data: silence
        dc = wk["country"]["dissonance"]
        # country layer: a quiet consonant chord when the week is normal; it grows
        # louder and rough (fast tremolo) as the country departs from normal
        rough = 1.0 - 0.7 * dc * (0.5 + 0.5 * np.sin(2 * np.pi * ROUGH_HZ * t))
        drone = sum(_tone(midi_to_hz(m), n, harmonics=(1.0, 0.3 + 0.5 * dc, 0.4 * dc))
                    for m in wk["country"]["chord"])
        drone *= (0.05 + 0.22 * dc) * rough * fade
        left[a:b] += drone
        right[a:b] += drone

        # abnormal cells are heard first, then the strongest fires
        voices = sorted(wk["cells"], key=lambda v: v["gain"] * (0.4 + v["dissonance"]),
                        reverse=True)[:max_voices]
        for v in voices:
            d = v["dissonance"]
            f = midi_to_hz(v["midi"], v["detune_cents"])
            sig = _tone(f, n)
            sig += v["partner_gain"] * _tone(midi_to_hz(v["midi"] + v["interval"], -v["detune_cents"]), n)
            sig *= 1.0 - 0.6 * d * (0.5 + 0.5 * np.sin(2 * np.pi * ROUGH_HZ * t))
            sig *= _pulses(n, v["density"]) * fade * (0.04 + 0.14 * v["gain"]) * (0.6 + 0.8 * d)
            ang = (v["pan"] + 1) * np.pi / 4                   # equal-power pan
            left[a:b] += np.cos(ang) * sig
            right[a:b] += np.sin(ang) * sig

    stereo = np.tanh(np.stack([left, right], axis=1) * 1.1)     # soft limiter
    pcm = (stereo * 32767 * 0.9).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    return len(left) / SR
