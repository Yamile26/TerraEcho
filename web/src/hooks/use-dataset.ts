"use client";
import { useEffect, useState } from "react";
import { parseScore } from "@/lib/data";
import type { FireScore, GeoCollection } from "@/lib/types";
export function useDataset(year: number) {
  const [score, setScore] = useState<FireScore | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setScore(null);
    fetch(`/api/fires?year=${year}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok)
          throw new Error("No se pudo cargar el archivo de observaciones.");
        return r.json();
      })
      .then(parseScore)
      .then(setScore)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [year, retry]);
  return { score, error, loading, retry: () => setRetry((n) => n + 1) };
}
export function useGeography() {
  const [geo, setGeo] = useState<GeoCollection | null>(null);
  useEffect(() => {
    const c = new AbortController();
    fetch("/data/peru_departments.geojson", { signal: c.signal })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setGeo)
      .catch(() => {});
    return () => c.abort();
  }, []);
  return geo;
}
