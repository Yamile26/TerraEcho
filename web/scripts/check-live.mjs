/** Records public connection evidence; never reads, prints or writes a MAP_KEY. */
import { mkdir, writeFile } from "node:fs/promises";
const origin = new URL(process.argv[2] ?? "http://localhost:3000");
if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password || origin.search) throw new Error('Use the application origin without credentials or query parameters.');
const url = new URL('/api/fires?mode=live&source=VIIRS_NOAA20_NRT&days=3', origin);
let evidence;
try {
  const r = await fetch(url, { signal: AbortSignal.timeout(25000) });
  const d = await r.json();
  evidence = { checkedAt: new Date().toISOString(), http: r.status, product: d.meta?.source ?? null, start: d.meta?.startDate ?? null, end: d.meta?.endDate ?? null, detections: Array.isArray(d.observations) ? d.observations.length : null, anomalyComputed: d.meta?.anomalyComputed ?? null, coverageStatus: d.meta?.coverageStatus ?? null, errorCode: d.error?.code ?? null, note: 'Zero detections do not establish absence of fire or complete observation coverage.' };
  if (!r.ok) process.exitCode = 1;
} catch {
  evidence = { checkedAt: new Date().toISOString(), http: null, errorCode: 'CONNECTION_OR_RESPONSE_FAILED', note: 'Check that the full Node app is running; the archive-only demo has no recent API.' };
  process.exitCode = 1;
}
const out = new URL('../../out/', import.meta.url);
await mkdir(out, { recursive: true });
await writeFile(new URL('firms-connection.json', out), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence, null, 2));
