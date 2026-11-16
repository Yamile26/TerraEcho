import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dateLabel, parseScore, regionCells, toCsv, weekRange } from "./data";
import type { GeoCollection } from "./types";
const score = parseScore(
  JSON.parse(readFileSync("../data/scores/terraecho_2026.json", "utf8")),
);
const geo = JSON.parse(
  readFileSync("../data/peru_departments.geojson", "utf8"),
) as GeoCollection;
test("calendar labels include every day in the final Python bin", () => {
  const base = score.weeks[0];
  assert.equal(
    weekRange({ ...base, week: 39, start_date: "2026-10-01" }),
    `${dateLabel("2026-10-01")} – ${dateLabel("2026-10-07")}`,
  );
  assert.equal(
    weekRange({ ...base, week: 51, start_date: "2025-12-24" }),
    `${dateLabel("2025-12-24")} – ${dateLabel("2025-12-31")}`,
  );
  assert.equal(
    weekRange({ ...base, week: 51, start_date: "2024-12-23" }),
    `${dateLabel("2024-12-23")} – ${dateLabel("2024-12-31")}`,
  );
});
test("all shipped scores satisfy the frontend contract", () => {
  assert.equal(score.weeks.length, 44);
  const other = parseScore(
    JSON.parse(readFileSync("public/data/terraecho_2025.json", "utf8")),
  );
  assert.equal(other.weeks.length, 52);
  assert.equal(score.weeks[39].country.count, 9058);
});
test("gap weeks never produce playable voices, including a region selection", () => {
  for (const week of score.weeks.filter((w) => w.data_gap)) {
    assert.equal(week.country.z, null);
    assert.deepEqual(regionCells(week, "Perú", geo), []);
    assert.deepEqual(regionCells(week, "Puno", geo), []);
  }
  const invalid = structuredClone(score);
  invalid.weeks[27].country.z = 0;
  assert.throws(() => parseScore(invalid), /silencio/);
});
test("department filtering agrees with existing Python regional counts", () => {
  const week = score.weeks[39];
  for (const region of week.regions) {
    const total = regionCells(week, region.name, geo).reduce(
      (s, c) => s + c.count,
      0,
    );
    assert.equal(total, region.count, region.name);
  }
});
test("CSV keeps unknown anomalies blank and labels gaps", () => {
  const gap = score.weeks[27],
    csv = toCsv([gap], "Perú");
  assert.match(csv, /,no_data,true/);
  assert.match(csv, /,\d+(?:\.\d+)?,,no_data/);
});
test("malformed geospatial/audio input is rejected", () => {
  const invalid = structuredClone(score);
  invalid.weeks[0].cells[0].pan = 5;
  assert.throws(() => parseScore(invalid), /inválida/);
  const unbounded = structuredClone(score);
  unbounded.weeks[0].cells[0].density = 1000000;
  assert.throws(() => parseScore(unbounded), /inválida/);
});
