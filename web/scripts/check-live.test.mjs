import { test } from "node:test";
import assert from "node:assert/strict";
import { checkLive } from "./check-live.mjs";

// Synthetic server fixtures only; never written as NASA connection evidence.
const fixture = () => ({
  meta: {
    provider: "NASA FIRMS", source: "VIIRS_NOAA20_NRT", mode: "live",
    retrievedAt: "2026-11-15T12:00:00.000Z", days: 3,
    startDate: "2026-11-13", endDate: "2026-11-15", bbox: [-81.5, -18.5, -68.5, 0],
    geographicScope: "peru-simplified-adm1-point-clipped", anomalyComputed: false,
    coverageStatus: "reported product range only; cloud coverage unknown",
    availability: { source: "VIIRS_NOAA20_NRT", start: "2026-11-01", end: "2026-11-15", status: "reported-range" },
    rawCount: 0, excludedOutsideCount: 0, frpUnknownCount: 0,
  },
  observations: [],
});
const check = (data, status = 200) => checkLive("http://localhost:3000", {
  fetcher: async () => Response.json(data, { status }),
  now: () => new Date("2026-11-15T12:01:00Z"),
});

test("live check accepts a valid empty response without claiming complete coverage", async () => {
  const evidence = await check(fixture());
  assert.equal(evidence.responseValid, true);
  assert.equal(evidence.detections, 0);
  assert.equal(evidence.product, "VIIRS_NOAA20_NRT");
  assert.equal(evidence.serverRetrievedAt, "2026-11-15T12:00:00.000Z");
  assert.equal(evidence.errorCode, null);
  assert.match(evidence.note, /does not establish absence/);
});

test("live check rejects HTTP 200 with incomplete, snapshot or mismatched product data", async () => {
  for (const data of [null, {}, { observations: [] },
    { ...fixture(), meta: { ...fixture().meta, mode: "snapshot" } },
    { ...fixture(), meta: { ...fixture().meta, source: "VIIRS_SNPP_NRT" } },
    { ...fixture(), meta: { ...fixture().meta, anomalyComputed: true } }]) {
    const evidence = await check(data);
    assert.equal(evidence.http, 200);
    assert.equal(evidence.responseValid, false);
    assert.equal(evidence.errorCode, "INVALID_LIVE_RESPONSE");
    assert.equal(evidence.detections, null);
  }
});

test("live check verifies dates, requested window, territorial scope and count reconciliation", async () => {
  for (const patch of [{ startDate: "2026-02-30" }, { days: 1 },
    { endDate: "2026-11-16" }, { rawCount: 1 }, { frpUnknownCount: 1 },
    { excludedOutsideCount: -1 }, { bbox: [-180, -90, 180, 90] },
    { geographicScope: "bbox" }, { retrievedAt: "not-a-date" },
    { availability: { ...fixture().meta.availability, end: "2026-10-31" } }]) {
    assert.equal((await check({ ...fixture(), meta: { ...fixture().meta, ...patch } })).responseValid, false);
  }
});

test("live check preserves unknown FRP and rejects invalid or out-of-window observations", async () => {
  const data = fixture();
  data.meta.rawCount = 2;
  data.meta.excludedOutsideCount = 1;
  data.meta.frpUnknownCount = 1;
  data.observations = [{ latitude: -10, longitude: -75, frp: null,
    acquiredAt: "2026-11-15T12:30:00Z", region: "Test region", confidence: "n", satellite: "N20" }];
  assert.equal((await check(data)).responseValid, true);
  for (const patch of [{ latitude: 40 }, { frp: -1 }, { acquiredAt: "2026-11-10T12:30:00Z" }, { region: "" }]) {
    assert.equal((await check({ ...data, observations: [{ ...data.observations[0], ...patch }] })).responseValid, false);
  }
});

test("live check keeps unknown product availability explicit", async () => {
  const data = fixture();
  data.meta.availability = { source: "VIIRS_NOAA20_NRT", start: null, end: null, status: "unknown" };
  data.meta.coverageStatus = "product availability unverified; cloud coverage unknown";
  assert.equal((await check(data)).responseValid, true);
  data.meta.availability.start = "2026-11-01";
  assert.equal((await check(data)).responseValid, false);
});

test("live check sanitizes upstream errors and untrusted metadata", async () => {
  const marker = "explicit-test-secret-never-report";
  for (const code of [marker, "FIRMS_NOT_CONFIGURED"]) {
    const evidence = await check({ error: { code, message: marker } }, 503);
    assert.equal(evidence.responseValid, false);
    assert.equal(evidence.errorCode, code === marker ? "HTTP_ERROR" : code);
    assert.ok(!JSON.stringify(evidence).includes(marker));
  }
  const data = fixture(); data.meta.source = marker; data.meta.coverageStatus = marker;
  assert.ok(!JSON.stringify(await check(data)).includes(marker));
});

test("live check distinguishes HTTP 200 non-JSON from a network failure", async () => {
  const html = await checkLive("http://localhost:3000", { fetcher: async () => new Response("<html>static demo</html>") });
  assert.equal(html.http, 200);
  assert.equal(html.errorCode, "INVALID_LIVE_RESPONSE");
  const network = await checkLive("http://localhost:3000", { fetcher: async () => { throw new Error("private detail"); } });
  assert.equal(network.http, null);
  assert.equal(network.errorCode, "CONNECTION_OR_RESPONSE_FAILED");
  assert.ok(!JSON.stringify(network).includes("private detail"));
});

test("live check rejects credentials, parameters, paths and fragments before fetching", async () => {
  let calls = 0;
  for (const origin of ["invalid", "ftp://localhost", "https://user:secret@example.com", "https://example.com?key=secret", "https://example.com/path", "https://example.com#secret"]) {
    await assert.rejects(checkLive(origin, { fetcher: async () => { calls++; } }),
      (error) => !error.message.includes("secret"));
  }
  assert.equal(calls, 0);
});
