import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET as fires } from "../app/api/fires/route";
import { GET as health } from "../app/api/health/route";
test("score API serves both exports and distinguishes missing years from invalid input", async () => {
  for (const [query, expected, year] of [
    ["year=2026", 200, 2026],
    ["year=2025", 200, 2025],
    ["year=2012", 404, null],
    ["year=../../etc/passwd", 400, null],
    ["mode=other", 400, null],
  ] as const) {
    const response = await fires(
      new NextRequest(`http://terraecho.test/api/fires?${query}`),
    );
    assert.equal(response.status, expected);
    const body = await response.json();
    if (year) {
      assert.equal(body.meta.year, year);
      assert.equal(
        response.headers.get("X-TerraEcho-Source"),
        "repository-snapshot",
      );
    } else assert.ok(body.error.code);
  }
});
test("missing FIRMS credentials fail explicitly without leaking environment contents", async () => {
  const previous = process.env.FIRMS_MAP_KEY;
  delete process.env.FIRMS_MAP_KEY;
  try {
    const response = await fires(
      new NextRequest("http://terraecho.test/api/fires?mode=live&days=1"),
    );
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, "FIRMS_NOT_CONFIGURED");
    const status = await health().json();
    assert.equal(status.firmsConfigured, false);
    assert.deepEqual(Object.keys(status).sort(), [
      "firmsConfigured",
      "scoreProvider",
      "service",
      "status",
    ]);
  } finally {
    if (previous !== undefined) process.env.FIRMS_MAP_KEY = previous;
  }
});
test("bad live queries are rejected before any upstream request", async () => {
  for (const query of ["days=6", "date=2026-02-30", "date=2099-01-01"]) {
    const response = await fires(
      new NextRequest(`http://terraecho.test/api/fires?mode=live&${query}`),
    );
    assert.equal(response.status, 400);
  }
});
