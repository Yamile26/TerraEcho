import type {
  CellVoice,
  FireScore,
  FireWeek,
  GeoCollection,
  GeoFeature,
  Level,
} from "./types";

export const LEVEL_LABEL: Record<Level, string> = {
  normal: "Dentro de lo habitual",
  elevated: "Actividad elevada",
  critical: "Anomalía crítica",
  no_data: "Sin datos suficientes",
};
export const LEVEL_COLOR: Record<Level, string> = {
  normal: "#a8e9b1",
  elevated: "#efc773",
  critical: "#ff885e",
  no_data: "#87929d",
};
export const number = (v: number) =>
  new Intl.NumberFormat("es-PE", { maximumFractionDigits: 0 }).format(v);
export function dateLabel(iso: string, long = false) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: long ? "long" : "short",
    timeZone: "UTC",
  }).format(new Date(`${iso}T12:00:00Z`));
}
export function weekRange(week: FireWeek) {
  const end = new Date(`${week.start_date}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 6);
  // Python uses 52 bins; bin 51 also contains the remaining days of the year.
  if (week.week === 51) end.setUTCMonth(11, 31);
  return `${dateLabel(week.start_date)} – ${new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", timeZone: "UTC" }).format(end)}`;
}
function insideRing(lon: number, lat: number, ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i],
      [xj, yj] = ring[j];
    if (
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    )
      inside = !inside;
  }
  return inside;
}
export function contains(feature: GeoFeature, lon: number, lat: number) {
  const polys =
    feature.geometry.type === "Polygon"
      ? [feature.geometry.coordinates as number[][][]]
      : (feature.geometry.coordinates as number[][][][]);
  return polys.some(
    (poly) =>
      insideRing(lon, lat, poly[0]) &&
      !poly.slice(1).some((hole) => insideRing(lon, lat, hole)),
  );
}
export function regionCells(
  week: FireWeek,
  region: string,
  geo: GeoCollection | null,
): CellVoice[] {
  if (week.data_gap) return [];
  if (region === "Perú") return week.cells;
  const f = geo?.features.find((f) => f.properties.shapeName === region);
  return f ? week.cells.filter((c) => contains(f, c.lon, c.lat)) : [];
}
export function selectedMetrics(week: FireWeek, region: string) {
  return region === "Perú"
    ? week.country
    : (week.regions.find((r) => r.name === region) ?? null);
}
export function parseScore(input: unknown): FireScore {
  if (!input || typeof input !== "object")
    throw new Error("El archivo de datos no es válido.");
  const score = input as FireScore;
  if (
    !score.meta ||
    !Number.isInteger(score.meta.year) ||
    !Array.isArray(score.meta.baseline_years) ||
    !Array.isArray(score.weeks) ||
    !score.weeks.length
  )
    throw new Error("Contrato de datos incompleto.");
  for (const w of score.weeks) {
    if (
      !Number.isInteger(w.week) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(w.start_date) ||
      typeof w.data_gap !== "boolean" ||
      !w.country ||
      !Array.isArray(w.cells) ||
      !Array.isArray(w.regions)
    )
      throw new Error("Semana de datos inválida.");
    if (
      !(w.country.level in LEVEL_LABEL) ||
      !Number.isFinite(w.country.count) ||
      w.country.count < 0 ||
      !Number.isFinite(w.country.frp)
    )
      throw new Error("Métricas inválidas.");
    if (
      w.data_gap &&
      (w.country.level !== "no_data" ||
        w.country.z !== null ||
        w.cells.length > 0)
    )
      throw new Error("Una semana incompleta debe permanecer en silencio.");
    if (!w.data_gap && (w.country.z === null || !Number.isFinite(w.country.z)))
      throw new Error("Falta la anomalía de una semana válida.");
    for (const c of w.cells) {
      if (
        ![
          c.lat,
          c.lon,
          c.count,
          c.frp,
          c.midi,
          c.gain,
          c.pan,
          c.detune_cents,
          c.interval,
          c.partner_gain,
          c.density,
          c.dissonance,
          c.z,
        ].every(Number.isFinite) ||
        !(c.level in LEVEL_LABEL) ||
        c.lat < -90 ||
        c.lat > 90 ||
        c.lon < -180 ||
        c.lon > 180 ||
        c.gain < 0 ||
        c.gain > 1 ||
        c.pan < -1 ||
        c.pan > 1 ||
        !Number.isInteger(c.density) ||
        c.density < 1 ||
        c.density > 4 ||
        c.midi < 0 ||
        c.midi > 127 ||
        c.interval < 0 ||
        c.interval > 12 ||
        Math.abs(c.detune_cents) > 45 ||
        c.partner_gain < 0 ||
        c.partner_gain > 1 ||
        c.dissonance < 0 ||
        c.dissonance > 1 ||
        c.frp < 0 ||
        c.count < 0
      )
        throw new Error("Celda sonora inválida.");
    }
  }
  return score;
}
export function toCsv(weeks: FireWeek[], region: string) {
  return (
    "date,region,hotspots,frp_mw_sum,robust_z,level,data_gap\n" +
    weeks
      .map((w) => {
        const m = selectedMetrics(w, region);
        return [
          w.start_date,
          `"${region.replaceAll('"', '""')}"`,
          m?.count ?? "",
          m?.frp ?? "",
          m?.z ?? "",
          m?.level ?? "no_data",
          w.data_gap,
        ].join(",");
      })
      .join("\n")
  );
}
