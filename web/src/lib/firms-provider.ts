import {
  parseFirmsCsv,
  parseCsv,
  type FirmsSource,
  type FireObservation,
} from "./firms";
import { covers, planarArea } from "./geography";
import type { GeoCollection } from "./types";
export interface Availability {
  source: string;
  start: string | null;
  end: string | null;
  status: "reported-range" | "unknown";
}
export interface RecentData {
  meta: {
    provider: string;
    source: FirmsSource;
    mode: "live";
    retrievedAt: string;
    days: number;
    startDate: string;
    endDate: string;
    bbox: number[];
    geographicScope: string;
    anomalyComputed: false;
    coverageStatus: string;
    availability: Availability;
    rawCount: number;
    excludedOutsideCount: number;
    frpUnknownCount: number;
    warning: string;
  };
  observations: FireObservation[];
}
export class FirmsError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly publicMessage: string,
  ) {
    super(code);
  }
}
const message = () =>
  new FirmsError(
    "FIRMS_UNAVAILABLE",
    502,
    "NASA FIRMS no devolvió una respuesta válida. Revisa disponibilidad, conexión y ventana; no se generaron datos de reemplazo.",
  );
export function parseAvailability(csv: string, source: string): Availability {
  try {
    const [header, ...rows] = parseCsv(csv),
      h = header.map((v) => v.trim().toLowerCase());
    const si = h.findIndex((v) => ["source", "sensor"].includes(v)),
      a = h.findIndex((v) => ["data_start", "start_date", "start"].includes(v)),
      b = h.findIndex((v) => ["data_end", "end_date", "end"].includes(v));
    const row = rows.find((r) => r[si] === source);
    if (
      row &&
      a >= 0 &&
      b >= 0 &&
      /^\d{4}-\d{2}-\d{2}/.test(row[a]) &&
      /^\d{4}-\d{2}-\d{2}/.test(row[b])
    )
      return {
        source,
        start: row[a].slice(0, 10),
        end: row[b].slice(0, 10),
        status: "reported-range",
      };
  } catch {}
  return { source, start: null, end: null, status: "unknown" };
}
export function clipObservations(rows: FireObservation[], geo: GeoCollection) {
  // Same ownership policy as the SP pipeline: smallest covering polygon,
  // then stable feature order. Legacy center filtering remains separate.
  const sorted = geo.features
    .map((f, index) => ({ f, index, area: planarArea(f) }))
    .sort((a, b) => a.area - b.area || a.index - b.index);
  return rows.flatMap((row) => {
    const match = sorted.find(({ f }) =>
      covers(f, row.longitude, row.latitude),
    );
    return match ? [{ ...row, region: match.f.properties.shapeName }] : [];
  });
}
export function createFirmsProvider(fetcher: typeof fetch = fetch) {
  const cache = new Map<string, { expires: number; data: RecentData }>(),
    inflight = new Map<string, Promise<RecentData>>();
  let windowStart = 0,
    requests = 0;
  async function csv(url: string, timeout = 15000) {
    let response: Response;
    try {
      response = await fetcher(url, {
        signal: AbortSignal.timeout(timeout),
        cache: "no-store",
        headers: { Accept: "text/csv" },
      });
    } catch {
      throw message();
    }
    if (!response.ok) throw message();
    const reader = response.body?.getReader();
    if (!reader) throw message();
    let size = 0,
      text = "";
    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8_000_000) {
        await reader.cancel();
        throw message();
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    if (
      /invalid\s+(map[_ ]?key|key)|map[_ ]?key\s+(is\s+)?(invalid|not\s+valid)/i.test(
        text,
      )
    )
      throw new FirmsError(
        "FIRMS_KEY_REJECTED",
        503,
        "FIRMS rechazó la MAP_KEY. Comprueba el valor privado del servidor.",
      );
    return text;
  }
  async function availability(
    source: FirmsSource,
    key: string,
  ): Promise<Availability> {
    if (source === "VIIRS_SNPP_NRT")
      return {
        source,
        start: "2012-01-20",
        end: "2026-11-02",
        status: "reported-range",
      };
    try {
      return parseAvailability(
        await csv(
          `https://firms.modaps.eosdis.nasa.gov/api/data_availability/csv/${encodeURIComponent(key)}/${source}`,
          5000,
        ),
        source,
      );
    } catch (e) {
      if (e instanceof FirmsError && e.code === "FIRMS_KEY_REJECTED") throw e;
      return { source, start: null, end: null, status: "unknown" };
    }
  }
  async function recent(
    query: { days: number; date: string | null; source: FirmsSource },
    key: string,
    geo: GeoCollection,
  ): Promise<RecentData> {
    const cacheKey = `${query.source}:${query.days}:${query.date ?? "latest"}`,
      hit = cache.get(cacheKey);
    if (hit && hit.expires > Date.now()) return hit.data;
    const current = inflight.get(cacheKey);
    if (current) return current;
    const work = async () => {
      if (Date.now() - windowStart > 60000) {
        windowStart = Date.now();
        requests = 0;
      }
      if (requests >= 10)
        throw new FirmsError(
          "UPSTREAM_RATE_LIMIT",
          429,
          "Espera un minuto antes de consultar otra ventana.",
        );
      requests++;
      const end = new Date(
          `${query.date ?? new Date().toISOString().slice(0, 10)}T00:00:00Z`,
        ),
        start = new Date(end);
      if (query.date) end.setUTCDate(end.getUTCDate() + query.days - 1);
      else start.setUTCDate(start.getUTCDate() - query.days + 1);
      const a = start.toISOString().slice(0, 10),
        b = end.toISOString().slice(0, 10),
        available = await availability(query.source, key);
      if (
        (available.end && a > available.end) ||
        (available.start && b < available.start)
      )
        throw new FirmsError(
          "PRODUCT_OUTSIDE_COVERAGE",
          422,
          `${query.source} no dispone de observaciones para esa ventana. Rango informado: ${available.start} a ${available.end}. Selecciona otra fecha o producto; Suomi NPP termina el 2 de noviembre de 2026.`,
        );
      let rows: FireObservation[];
      try {
        rows = parseFirmsCsv(
          await csv(
            `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(key)}/${query.source}/-81.5,-18.5,-68.5,0/${query.days}${query.date ? `/${query.date}` : ""}`,
          ),
        );
      } catch (e) {
        if (e instanceof FirmsError) throw e;
        throw message();
      }
      const observations = clipObservations(rows, geo);
      const data: RecentData = {
        meta: {
          provider: "NASA FIRMS",
          source: query.source,
          mode: "live",
          retrievedAt: new Date().toISOString(),
          days: query.days,
          startDate: a,
          endDate: b,
          bbox: [-81.5, -18.5, -68.5, 0],
          geographicScope: "peru-simplified-adm1-point-clipped",
          anomalyComputed: false,
          coverageStatus:
            available.status === "unknown"
              ? "product availability unverified; cloud coverage unknown"
              : "reported product range only; cloud coverage unknown",
          availability: available,
          rawCount: rows.length,
          excludedOutsideCount: rows.length - observations.length,
          frpUnknownCount: observations.filter((r) => r.frp === null).length,
          warning:
            "Detecciones térmicas recientes; no son incendios individuales, superficie quemada, clasificación forestal ni anomalías históricas.",
        },
        observations,
      };
      if (cache.size >= 20) cache.delete(cache.keys().next().value!);
      cache.set(cacheKey, { expires: Date.now() + 120000, data });
      return data;
    };
    const pending = work();
    inflight.set(cacheKey, pending);
    try {
      return await pending;
    } finally {
      inflight.delete(cacheKey);
    }
  }
  return { recent, availability };
}
