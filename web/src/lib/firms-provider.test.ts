import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createFirmsProvider,
  parseAvailability,
  FirmsError,
} from "./firms-provider";
import { recentCells, representation } from "./recent";
import type { GeoCollection } from "./types";
const geo: GeoCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { shapeName: "Test polygon" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-80, -15],
            [-70, -15],
            [-70, -5],
            [-80, -5],
            [-80, -15],
          ],
        ],
      },
    },
  ],
};
test("recent provider clips source records and keeps unknown FRP without inventing anomaly", async () => {
  let calls = 0;
  const provider = createFirmsProvider((async (url) => {
    calls++;
    return new Response(
      String(url).includes("data_availability")
        ? "source,data_start,data_end\nVIIRS_NOAA20_NRT,2026-11-01,2026-11-16"
        : "latitude,longitude,frp,acq_date,acq_time,confidence,satellite\n-10,-75,,2026-11-15,1230,n,N20\n-3,-75,5,2026-11-15,1230,h,N20",
    );
  }) as typeof fetch);
  const q = {
    source: "VIIRS_NOAA20_NRT" as const,
    days: 1,
    date: "2026-11-15",
  };
  const d = await provider.recent(q, "explicit-test-fixture-key", geo);
  assert.equal(d.meta.rawCount, 2);
  assert.equal(d.meta.excludedOutsideCount, 1);
  assert.equal(d.observations[0].frp, null);
  assert.equal(d.meta.anomalyComputed, false);
  assert.equal(d.meta.frpUnknownCount, 1);
  await provider.recent(q, "explicit-test-fixture-key", geo);
  assert.equal(calls, 2);
  assert.ok(!JSON.stringify(d).includes("fixture-key"));
  const cells = recentCells(d.observations);
  assert.equal(cells[0].z, null);
  assert.equal(cells[0].alert, false);
  assert.equal(representation(cells, "count").countShare, 1);
});
test("retired Suomi NPP is not silently reported as a zero-fire present window", async () => {
  const provider = createFirmsProvider((async () => {
    throw new Error("No network expected");
  }) as typeof fetch);
  await assert.rejects(
    provider.recent(
      { source: "VIIRS_SNPP_NRT", days: 1, date: "2026-11-15" },
      "fixture",
      geo,
    ),
    (e: unknown) =>
      e instanceof FirmsError && e.code === "PRODUCT_OUTSIDE_COVERAGE",
  );
});
test("availability parser distinguishes unknown from a documented date range", () => {
  assert.equal(
    parseAvailability("bad data", "VIIRS_NOAA20_NRT").status,
    "unknown",
  );
  assert.equal(
    parseAvailability(
      "source,data_start,data_end\nVIIRS_NOAA20_NRT,2026-11-01,2026-11-16",
      "VIIRS_NOAA20_NRT",
    ).end,
    "2026-11-16",
  );
});
