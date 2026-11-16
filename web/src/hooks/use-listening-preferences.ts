"use client";
import { useEffect, useState } from "react";
export function useListeningPreferences() {
  const [volume, setVolume] = useState(0.35),
    [mono, setMono] = useState(false),
    [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem("terraecho-listening") ?? "{}");
      if (typeof p.volume === "number" && Number.isFinite(p.volume))
        setVolume(Math.max(0, Math.min(1, p.volume)));
      if (typeof p.mono === "boolean") setMono(p.mono);
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem(
          "terraecho-listening",
          JSON.stringify({ volume, mono }),
        );
      } catch {}
  }, [ready, volume, mono]);
  return { volume, setVolume, mono, setMono };
}
