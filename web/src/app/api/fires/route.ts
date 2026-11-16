import { NextRequest, NextResponse } from "next/server";
import { liveQuery } from "@/lib/firms";
import { createFirmsProvider, FirmsError } from "@/lib/firms-provider";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { GeoCollection } from "@/lib/types";
import { loadScore } from "@/lib/server-data";
export const runtime = "nodejs";
const provider = createFirmsProvider();
const error = (status: number, code: string, message: string) =>
  NextResponse.json(
    { error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
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
  try {
    const geo = JSON.parse(
      await readFile(
        path.join(process.cwd(), "public/data/peru_departments.geojson"),
        "utf8",
      ),
    ) as GeoCollection;
    const data = await provider.recent(query, key, geo);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, max-age=120" },
    });
  } catch (e) {
    if (e instanceof FirmsError)
      return error(e.status, e.code, e.publicMessage);
    return error(
      502,
      "FIRMS_UNAVAILABLE",
      "No fue posible cargar datos recientes válidos. El archivo sigue disponible.",
    );
  }
}
