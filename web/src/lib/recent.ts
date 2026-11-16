import type { FireObservation } from "./firms";
import type { CellVoice } from "./types";
/** Recent descriptive mapping has no z-score, anomaly level or historic chord. */
export function recentCells(observations: FireObservation[]): CellVoice[] {
  const groups = new Map<string, FireObservation[]>();
  for (const o of observations) {
    const key = `${o.region}:${Math.floor(o.latitude * 2)}:${Math.floor(o.longitude * 2)}`;
    const a = groups.get(key) ?? [];
    a.push(o);
    groups.set(key, a);
  }
  const max = Math.max(1, ...Array.from(groups.values(), (a) => a.length));
  return Array.from(groups.values(), (a) => {
    const lat = a.reduce((s, o) => s + o.latitude, 0) / a.length,
      lon = a.reduce((s, o) => s + o.longitude, 0) / a.length,
      known = a.filter((o) => o.frp !== null),
      frp = known.length ? known.reduce((s, o) => s + o.frp!, 0) : null;
    const scale = [0, 2, 4, 7, 9],
      k = Math.max(0, Math.min(14, Math.floor(((lat + 18.5) / 18.5) * 15)));
    return {
      lat,
      lon,
      region: a[0].region,
      count: a.length,
      frp,
      frp_unknown_count: a.length - known.length,
      z: null,
      level: "normal",
      dissonance: 0,
      midi: 48 + Math.floor(k / 5) * 12 + scale[k % 5],
      detune_cents: 0,
      interval: 7,
      partner_gain: 0,
      gain: 0.15 + (0.65 * Math.log1p(a.length)) / Math.log1p(max),
      density: 1 + Math.round((3 * Math.log1p(a.length)) / Math.log1p(max)),
      pan: Math.max(-1, Math.min(1, (2 * (lon + 81.5)) / 13 - 1)),
      alert: false,
    };
  });
}
export function representation(
  cells: CellVoice[],
  by: "frp" | "count" = "frp",
) {
  const chosen = [...cells]
      .sort((a, b) =>
        by === "frp" ? (b.frp ?? 0) - (a.frp ?? 0) : b.count - a.count,
      )
      .slice(0, 18),
    total = cells.reduce((s, c) => s + c.count, 0),
    frp = cells.reduce((s, c) => s + (c.frp ?? 0), 0);
  return {
    voices: chosen.length,
    cells: cells.length,
    countShare: total ? chosen.reduce((s, c) => s + c.count, 0) / total : 0,
    frpShare: frp ? chosen.reduce((s, c) => s + (c.frp ?? 0), 0) / frp : null,
  };
}
