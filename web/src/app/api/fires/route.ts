import { NextRequest, NextResponse } from "next/server";
import { liveQuery, parseFirmsCsv } from "@/lib/firms";
import { loadScore } from "@/lib/server-data";
export const runtime = "nodejs";
const cache = new Map<string, { expires: number; data: unknown }>();
const inflight = new Map<string, Promise<unknown>>();
let windowStart = Date.now(),
  upstreamRequests = 0;
const error = (status: number, code: string, message: string) =>
  NextResponse.json(
    { error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
async function recent(days: number, date: string | null, key: string) {
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(key)}/VIIRS_SNPP_NRT/-81.5,-18.5,-68.5,0/${days}${date ? `/${date}` : ""}`;
  const r = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
    headers: { Accept: "text/csv" },
  });
  if (!r.ok) throw new Error("FIRMS_UNAVAILABLE");
  const reader = r.body?.getReader();
  if (!reader) throw new Error("FIRMS_UNAVAILABLE");
  let size = 0,
    text = "";
  const decoder = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 8_000_000) {
      await reader.cancel();
      throw new Error("FIRMS_TOO_LARGE");
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  const observations = parseFirmsCsv(text);
  return {
    meta: {
      provider: "NASA FIRMS",
      source: "VIIRS_SNPP_NRT",
      mode: "live",
      retrievedAt: new Date().toISOString(),
      days,
      startDate: date,
      bbox: [-81.5, -18.5, -68.5, 0],
      geographicScope: "bounding-box-includes-neighboring-territory",
      anomalyComputed: false,
    },
    observations,
  };
}
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams,
    mode = p.get("mode") ?? "snapshot";
  if (!["snapshot", "live"].includes(mode))
    return error(400, "INVALID_MODE", "Usa mode=snapshot o mode=live.");
  if (mode === "snapshot") {
    const raw = p.get("year") ?? "2026";
    if (!/^\d{4}$/.test(raw) || +raw < 2012 || +raw > 2026)
      return error(400, "INVALID_YEAR", "El año debe estar entre 2012 y 2026.");
    try {
      const { score, provider } = await loadScore(+raw);
      return NextResponse.json(score, {
        headers: {
          "Cache-Control": "public, max-age=60, s-maxage=300",
          "X-TerraEcho-Source": provider,
        },
      });
    } catch (e) {
      if ((e as Error).message === "DATA_NOT_EXPORTED")
        return error(
          404,
          "DATA_NOT_EXPORTED",
          "Este año forma parte del alcance histórico, pero aún no tiene una partitura exportada.",
        );
      return error(
        502,
        "SCORE_UNAVAILABLE",
        "No se pudo cargar una partitura válida del proveedor configurado.",
      );
    }
  }
  let query;
  try {
    query = liveQuery(p);
  } catch {
    return error(
      400,
      "INVALID_QUERY",
      "Consulta de 1 a 5 días. La fecha opcional debe ser válida, no futura, con formato YYYY-MM-DD.",
    );
  }
  const key = process.env.FIRMS_MAP_KEY;
  if (!key)
    return error(
      503,
      "FIRMS_NOT_CONFIGURED",
      "Configura FIRMS_MAP_KEY en el servidor para habilitar detecciones recientes. El archivo histórico funciona sin esta clave.",
    );
  const cacheKey = `${query.days}:${query.date ?? "latest"}`,
    hit = cache.get(cacheKey);
  if (hit && hit.expires > Date.now())
    return NextResponse.json(hit.data, {
      headers: { "Cache-Control": "private, max-age=120" },
    });
  try {
    let pending = inflight.get(cacheKey);
    if (!pending) {
      if (Date.now() - windowStart > 60_000) {
        windowStart = Date.now();
        upstreamRequests = 0;
      }
      if (upstreamRequests >= 10)
        return error(
          429,
          "UPSTREAM_RATE_LIMIT",
          "Espera un minuto antes de solicitar otra ventana de datos.",
        );
      upstreamRequests++;
      pending = recent(query.days, query.date, key);
      inflight.set(cacheKey, pending);
    }
    const data = await pending;
    if (cache.size >= 20) cache.delete(cache.keys().next().value!);
    cache.set(cacheKey, { expires: Date.now() + 120000, data });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, max-age=120" },
    });
  } catch {
    return error(
      502,
      "FIRMS_UNAVAILABLE",
      "FIRMS no devolvió datos válidos dentro del tiempo permitido. No se generaron observaciones de reemplazo.",
    );
  } finally {
    inflight.delete(cacheKey);
  }
}
