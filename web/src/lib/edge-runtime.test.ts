import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { acquireBudget, createEdgeApp, type BudgetDatabase } from "./edge-runtime";
import type { GeoCollection } from "./types";

function database() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL("../../../drizzle/0000_firms_budget.sql", import.meta.url), "utf8"));
  const db: BudgetDatabase = { prepare: (sql) => ({ bind: (...values) => ({
    first: async () => sqlite.prepare(sql).get(...values) ?? null,
  }) }) };
  return { db, close: () => sqlite.close() };
}
const geo: GeoCollection = { type: "FeatureCollection", features: [{ type: "Feature",
  properties: { shapeName: "Fixture region" }, geometry: { type: "Polygon", coordinates: [
    [[-80, -15], [-70, -15], [-70, -5], [-80, -5], [-80, -15]],
  ] } }] };
const request = (query = "mode=live&source=VIIRS_NOAA20_NRT&days=3") =>
  new Request(`https://example.test/api/fires?${query}`);

test("shared budget admits at most ten concurrent requests and resets only at a new UTC minute", async () => {
  const { db, close } = database();
  try {
    const outcomes = await Promise.all(Array.from({ length: 25 }, () => acquireBudget(db, 600000)));
    assert.equal(outcomes.filter(Boolean).length, 10);
    assert.equal(await acquireBudget(db, 659999), false);
    assert.equal(await acquireBudget(db, 660000), true);
  } finally { close(); }
});

test("edge live route rejects unsafe queries and missing bindings before contacting NASA", async () => {
  let calls = 0;
  const app = createEdgeApp({ geo, asset: async () => null, fetcher: (async () => { calls++; throw Error(); }) as typeof fetch });
  assert.equal((await app.fetch(request("mode=live&days=8"), {})).status, 400);
  assert.equal((await app.fetch(request("mode=live&key=explicit-test-marker"), {})).status, 400);
  assert.equal((await app.fetch(request(), {})).status, 503);
  assert.equal((await app.fetch(request(), { FIRMS_MAP_KEY: "explicit-test-fixture" })).status, 503);
  assert.equal(calls, 0);
});

test("edge instances share a global budget and never serialize server secrets", async () => {
  const { db, close } = database();
  const key = "explicit-private-fixture-marker";
  let upstreamCalls = 0;
  const factory = () => createEdgeApp({ geo, asset: async () => null, fetcher: (async (url) => {
    upstreamCalls++;
    return new Response(String(url).includes("data_availability")
      ? "source,data_start,data_end\nVIIRS_NOAA20_NRT,2012-01-01,2099-12-31"
      : "latitude,longitude,frp,acq_date,acq_time,confidence,satellite\n-10,-75,,2026-11-15,1230,n,N20");
  }) as typeof fetch });
  const apps = [factory(), factory()];
  try {
    for (let i = 0; i < 10; i++) {
      const r = await apps[i % 2].fetch(request(), { FIRMS_MAP_KEY: key, DB: db });
      assert.equal(r.status, 200);
      const raw = await r.text();
      assert.ok(!raw.includes(key));
      assert.equal(JSON.parse(raw).meta.anomalyComputed, false);
    }
    const denied = await apps[1].fetch(request(), { FIRMS_MAP_KEY: key, DB: db });
    assert.equal(denied.status, 429);
    assert.equal(denied.headers.get("Retry-After"), "60");
    assert.equal(upstreamCalls, 4); // Two instances, two actual fixture calls each; cache then applies.
  } finally { close(); }
});

test("budget failure fails closed while EIC and archive assets remain available", async () => {
  let calls = 0;
  const db: BudgetDatabase = { prepare: () => { throw Error("private-database-detail"); } };
  const app = createEdgeApp({ geo, asset: async (p) => p === "/data/terraecho_2025.json"
    ? Response.json({ marker: "archive-fixture" }) : p === "/" ? new Response("EIC fixture") : null,
    fetcher: (async () => { calls++; throw Error(); }) as typeof fetch });
  const denied = await app.fetch(request(), { FIRMS_MAP_KEY: "fixture", DB: db });
  assert.equal(denied.status, 503);
  assert.ok(!(await denied.text()).includes("private-database-detail"));
  assert.equal((await app.fetch(request("year=2025"), {})).status, 200);
  assert.equal((await app.fetch(new Request("https://example.test/"), {})).status, 200);
  assert.equal(calls, 0);
});

test("health and methods expose configuration flags only", async () => {
  const app = createEdgeApp({ geo, asset: async () => null });
  const r = await app.fetch(new Request("https://example.test/api/health"), { FIRMS_MAP_KEY: "private-fixture" });
  const text = await r.text();
  assert.ok(!text.includes("private-fixture"));
  assert.equal(JSON.parse(text).firmsConfigured, true);
  assert.equal(JSON.parse(text).sharedBudgetConfigured, false);
  assert.equal((await app.fetch(new Request("https://example.test/api/fires", { method: "POST" }), {})).status, 405);
});
