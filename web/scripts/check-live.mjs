/** Records validated server evidence; never reads, prints or writes a MAP_KEY. */
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const PRODUCT = "VIIRS_NOAA20_NRT";
const DAYS = 3;
const BBOX = [-81.5, -18.5, -68.5, 0];
const ORIGIN_MESSAGE = "Use the HTTP(S) application origin without credentials, path, query or fragment.";
const NOTE = "A valid server response does not establish absence of fire or complete observation coverage. NASA source availability and participant validation remain separate checks.";
const PUBLIC_ERRORS = new Set([
  "FIRMS_NOT_CONFIGURED", "FIRMS_KEY_REJECTED", "FIRMS_UNAVAILABLE",
  "INVALID_MODE", "INVALID_QUERY", "UPSTREAM_RATE_LIMIT", "PRODUCT_OUTSIDE_COVERAGE",
]);
const dateOnly = (value) => typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const timestamp = (value) => typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value.slice(0, 10);
const count = (value) => Number.isSafeInteger(value) && value >= 0;

function validResponse(data) {
  const m = data?.meta, rows = data?.observations, a = m?.availability;
  if (!m || data.error || !Array.isArray(rows) ||
      m.provider !== "NASA FIRMS" || m.mode !== "live" ||
      m.source !== PRODUCT || m.days !== DAYS || m.anomalyComputed !== false ||
      !timestamp(m.retrievedAt) || !dateOnly(m.startDate) || !dateOnly(m.endDate) ||
      Date.parse(m.endDate) - Date.parse(m.startDate) !== (DAYS - 1) * 86400000 ||
      m.geographicScope !== "peru-simplified-adm1-point-clipped" ||
      !Array.isArray(m.bbox) || m.bbox.length !== 4 ||
      m.bbox.some((value, i) => value !== BBOX[i]) ||
      !count(m.rawCount) || !count(m.excludedOutsideCount) || !count(m.frpUnknownCount) ||
      m.rawCount - m.excludedOutsideCount !== rows.length || a?.source !== PRODUCT) return false;
  if (a.status === "unknown") {
    if (a.start !== null || a.end !== null ||
        m.coverageStatus !== "product availability unverified; cloud coverage unknown") return false;
  } else if (a.status === "reported-range") {
    if (!dateOnly(a.start) || !dateOnly(a.end) || a.start > a.end ||
        m.startDate > a.end || m.endDate < a.start ||
        m.coverageStatus !== "reported product range only; cloud coverage unknown") return false;
  } else return false;
  return rows.every((row) => row &&
    Number.isFinite(row.latitude) && row.latitude >= BBOX[1] && row.latitude <= BBOX[3] &&
    Number.isFinite(row.longitude) && row.longitude >= BBOX[0] && row.longitude <= BBOX[2] &&
    (row.frp === null || (Number.isFinite(row.frp) && row.frp >= 0)) &&
    timestamp(row.acquiredAt) && row.acquiredAt.slice(0, 10) >= m.startDate &&
    row.acquiredAt.slice(0, 10) <= m.endDate &&
    typeof row.region === "string" && row.region.trim().length > 0 &&
    typeof row.confidence === "string" && typeof row.satellite === "string") &&
    rows.filter((row) => row.frp === null).length === m.frpUnknownCount;
}

export async function checkLive(origin, { fetcher = fetch, now = () => new Date() } = {}) {
  let base;
  try { base = new URL(origin); } catch { throw new Error(ORIGIN_MESSAGE); }
  if (!["http:", "https:"].includes(base.protocol) || base.username || base.password ||
      base.pathname !== "/" || base.search || base.hash) throw new Error(ORIGIN_MESSAGE);
  const evidence = {
    checkedAt: now().toISOString(), http: null, responseValid: false,
    product: null, start: null, end: null, serverRetrievedAt: null, detections: null,
    anomalyComputed: null, coverageStatus: null, errorCode: null, note: NOTE,
  };
  let response;
  try {
    response = await fetcher(new URL(`/api/fires?mode=live&source=${PRODUCT}&days=${DAYS}`, base), {
      signal: AbortSignal.timeout(25000),
    });
  } catch {
    return { ...evidence, errorCode: "CONNECTION_OR_RESPONSE_FAILED" };
  }
  evidence.http = response.status;
  let data;
  try { data = await response.json(); } catch {
    return { ...evidence, errorCode: response.ok ? "INVALID_LIVE_RESPONSE" : "HTTP_ERROR" };
  }
  if (!response.ok) {
    return { ...evidence, errorCode: PUBLIC_ERRORS.has(data?.error?.code) ? data.error.code : "HTTP_ERROR" };
  }
  if (!validResponse(data)) return { ...evidence, errorCode: "INVALID_LIVE_RESPONSE" };
  return {
    ...evidence, responseValid: true, product: data.meta.source,
    start: data.meta.startDate, end: data.meta.endDate, serverRetrievedAt: data.meta.retrievedAt,
    detections: data.observations.length, anomalyComputed: false, coverageStatus: data.meta.coverageStatus,
  };
}

async function main() {
  let evidence;
  try { evidence = await checkLive(process.argv[2] ?? "http://localhost:3000"); }
  catch { console.error(ORIGIN_MESSAGE); process.exitCode = 1; return; }
  const out = new URL("../../out/", import.meta.url);
  await mkdir(out, { recursive: true });
  await writeFile(new URL("firms-connection.json", out), JSON.stringify(evidence, null, 2) + "\n");
  console.log(JSON.stringify(evidence, null, 2));
  if (!evidence.responseValid) process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main().catch(() => { console.error("Could not write connection evidence."); process.exitCode = 1; });
}
