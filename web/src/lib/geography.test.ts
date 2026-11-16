import { test } from "node:test";
import assert from "node:assert/strict";
import { covers } from "./geography";
import { clipObservations } from "./firms-provider";
import type { GeoFeature } from "./types";
const f = (name: string, r: number[][][]): GeoFeature => ({
  type: "Feature",
  properties: { shapeName: name },
  geometry: { type: "Polygon", coordinates: r },
});
test("closed territorial assignment preserves edges, excludes hole interiors and resolves overlaps", () => {
  const large = f("large", [
    [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
      [0, 0],
    ],
  ]);
  const small = f("small", [
    [
      [1, 1],
      [2, 1],
      [2, 2],
      [1, 2],
      [1, 1],
    ],
  ]);
  assert.equal(covers(large, 0, 2), true);
  assert.equal(covers(large, 5, 2), false);
  const hole = f("hole", [
    large.geometry.coordinates[0] as number[][],
    [
      [1, 1],
      [2, 1],
      [2, 2],
      [1, 2],
      [1, 1],
    ],
  ]);
  assert.equal(covers(hole, 1.5, 1.5), false);
  assert.equal(covers(hole, 1, 1.5), true);
  const records = [
    {
      latitude: 1.5,
      longitude: 1.5,
      frp: null,
      acquiredAt: "2025-01-01T00:00:00Z",
      confidence: "n",
      satellite: "fixture",
    },
  ];
  const clipped = clipObservations(records, {
    type: "FeatureCollection",
    features: [large, small],
  });
  assert.equal(clipped.length, 1);
  assert.equal(clipped[0].region, "small");
});
