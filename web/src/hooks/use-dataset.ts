"use client";
import { useEffect, useState } from "react";
import { parseScore } from "@/lib/data";
import type { FireScore, GeoCollection } from "@/lib/types";
import { ARCHIVE_ONLY } from "@/lib/build-mode";
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
    fetch(
      ARCHIVE_ONLY ? `/data/terraecho_${year}.json` : `/api/fires?year=${year}`,
      { signal: controller.signal },
    )
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
  const [geo, setGeo] = useState<GeoCollection | null>(null),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    setError("");
    fetch("/data/peru_departments.geojson", { signal: c.signal })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => {
        if (
          d?.type !== "FeatureCollection" ||
          !Array.isArray(d.features) ||
          !d.features.length
        )
          throw new Error("Límites geográficos inválidos.");
        setGeo(d);
      })
      .catch((e) => {
        if (e.name !== "AbortError")
          setError(
            "No se pudieron cargar los límites. Reintenta para habilitar los filtros geográficos.",
          );
      });
    return () => c.abort();
  }, [attempt]);
  return { geo, error, retry: () => setAttempt((n) => n + 1) };
}

export interface DatasetCatalog {
  schema_version: string;
  defaultYear: number;
  entries: {
    year: number;
    weeks: number;
    source: string;
    scope: string;
    quality: string;
    coverage: string;
    lastObservation: string;
    scoreSha256: string;
  }[];
}
export function useCatalog() {
  const [catalog, setCatalog] = useState<DatasetCatalog | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    fetch("/data/catalog.json", { signal: c.signal })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => {
        if (
          d?.schema_version !== "1.0.0" ||
          !Array.isArray(d.entries) ||
          !d.entries.length ||
          d.entries.some(
            (e: { year: number }) =>
              !Number.isInteger(e.year) || e.year < 2012 || e.year > 2026,
          )
        )
          throw new Error();
        setCatalog(d);
      })
      .catch((e) => {
        if (e.name !== "AbortError")
          setError(
            "Catálogo no disponible. El archivo seleccionado puede seguir consultándose.",
          );
      });
    return () => c.abort();
  }, []);
  return { catalog, error };
}
