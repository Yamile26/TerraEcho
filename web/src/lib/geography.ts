import type { GeoFeature } from "./types";
/** Closed polygons: outer/hole edges are covered, hole interiors excluded. */
function ringState(x: number, y: number, ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [a, b] = ring[j],
      [c, d] = ring[i],
      dx = c - a,
      dy = d - b;
    if (
      Math.abs(dx) + Math.abs(dy) > 0 &&
      Math.abs((x - a) * dy - (y - b) * dx) < 1e-12 &&
      x >= Math.min(a, c) &&
      x <= Math.max(a, c) &&
      y >= Math.min(b, d) &&
      y <= Math.max(b, d)
    )
      return 0;
    if (b > y !== d > y && x < (dx * (y - b)) / (d - b) + a) inside = !inside;
  }
  return inside ? 1 : -1;
}
function polygons(f: GeoFeature) {
  return f.geometry.type === "Polygon"
    ? [f.geometry.coordinates as number[][][]]
    : (f.geometry.coordinates as number[][][][]);
}
export function covers(f: GeoFeature, x: number, y: number) {
  return polygons(f).some(
    (p) =>
      ringState(x, y, p[0]) >= 0 &&
      !p.slice(1).some((h) => ringState(x, y, h) === 1),
  );
}
export function planarArea(f: GeoFeature) {
  const area = (r: number[][]) =>
    Math.abs(
      r.reduce((s, p, i) => {
        const q = r[(i + 1) % r.length];
        return s + p[0] * q[1] - q[0] * p[1];
      }, 0),
    ) / 2;
  return polygons(f).reduce(
    (sum, p) => sum + area(p[0]) - p.slice(1).reduce((s, h) => s + area(h), 0),
    0,
  );
}
