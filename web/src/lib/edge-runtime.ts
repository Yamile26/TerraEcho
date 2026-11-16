import { liveQuery } from "./firms";
import { createFirmsProvider, FirmsError } from "./firms-provider";
import type { GeoCollection } from "./types";

export interface BudgetDatabase {
  prepare(sql: string): {
    bind(...values: (string | number)[]): { first(): Promise<unknown> };
  };
}
export const BUDGET_SQL = `INSERT INTO firms_request_budget (id, minute, used)
VALUES ('public-live', ?, 1)
ON CONFLICT(id) DO UPDATE SET
  minute = excluded.minute,
  used = CASE WHEN firms_request_budget.minute <> excluded.minute
    THEN 1 ELSE firms_request_budget.used + 1 END
WHERE firms_request_budget.minute <> excluded.minute OR firms_request_budget.used < 10
RETURNING used`;

export async function acquireBudget(db: BudgetDatabase, now = Date.now()) {
  return Boolean(await db.prepare(BUDGET_SQL).bind(Math.floor(now / 60000)).first());
}

const headers = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};
const json = (data: unknown, status = 200, extra = {}) => Response.json(data, {
  status, headers: { ...headers, "Cache-Control": "no-store", ...extra },
});
const error = (status: number, code: string, message: string, extra = {}) =>
  json({ error: { code, message } }, status, extra);

export function createEdgeApp({
  geo, asset, fetcher = fetch,
}: {
  geo: GeoCollection;
  asset: (path: string, request: Request) => Promise<Response | null>;
  fetcher?: typeof fetch;
}) {
  const provider = createFirmsProvider(fetcher);
  return {
    async fetch(request: Request, env: { FIRMS_MAP_KEY?: string; DB?: BudgetDatabase }) {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/") && request.method !== "GET")
        return error(405, "METHOD_NOT_ALLOWED", "Usa GET para consultar.", { Allow: "GET" });
      if (url.pathname === "/api/health")
        return json({ status: "ok", service: "terraecho-web", runtime: "cloudflare-worker",
          firmsConfigured: Boolean(env.FIRMS_MAP_KEY), sharedBudgetConfigured: Boolean(env.DB),
          scoreProvider: "repository-snapshot" });
      if (url.pathname === "/api/fires") {
        const p = url.searchParams, mode = p.get("mode") ?? "snapshot";
        if ([...p.keys()].some((k) => !["mode", "year", "source", "days", "date"].includes(k)))
          return error(400, "INVALID_QUERY", "La consulta contiene parámetros no admitidos.");
        if (mode === "snapshot") {
          const year = p.get("year") ?? "2026";
          if (!/^\d{4}$/.test(year) || +year < 2012 || +year > 2026)
            return error(400, "INVALID_YEAR", "El año debe estar entre 2012 y 2026.");
          return await asset(`/data/terraecho_${year}.json`, request) ??
            error(404, "DATA_NOT_EXPORTED", "No hay una partitura exportada para ese año.");
        }
        if (mode !== "live") return error(400, "INVALID_MODE", "Usa snapshot o live.");
        let query;
        try { query = liveQuery(p); }
        catch { return error(400, "INVALID_QUERY", "Producto, fecha o ventana no válidos."); }
        if (!env.FIRMS_MAP_KEY)
          return error(503, "FIRMS_NOT_CONFIGURED", "La clave FIRMS debe configurarse en el servidor.");
        if (!env.DB)
          return error(503, "BUDGET_UNAVAILABLE", "La consulta espera la configuración del presupuesto compartido.");
        try {
          if (!await acquireBudget(env.DB))
            return error(429, "UPSTREAM_RATE_LIMIT", "Se alcanzó el límite global de consultas. Reintenta en un minuto.", { "Retry-After": "60" });
          const data = await provider.recent(query, env.FIRMS_MAP_KEY, geo);
          return json(data, 200, { "Cache-Control": "private, max-age=120" });
        } catch (e) {
          if (e instanceof FirmsError) return error(e.status, e.code, e.publicMessage);
          return error(503, "FIRMS_UNAVAILABLE", "No se pudo completar una consulta reciente válida.");
        }
      }
      if (url.pathname.startsWith("/api/")) return error(404, "NOT_FOUND", "Ruta no disponible.");
      if (!["GET", "HEAD"].includes(request.method))
        return error(405, "METHOD_NOT_ALLOWED", "Usa GET o HEAD.", { Allow: "GET, HEAD" });
      return await asset(url.pathname, request) ??
        new Response("Not found", { status: 404, headers });
    },
  };
}
