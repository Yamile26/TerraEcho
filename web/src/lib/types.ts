export type Level = "normal" | "elevated" | "critical" | "no_data";
export interface Metrics {
  count: number;
  frp: number;
  z: number | null;
  level: Level;
  dissonance: number;
}
export interface CellVoice extends Metrics {
  lat: number;
  lon: number;
  midi: number;
  detune_cents: number;
  interval: number;
  partner_gain: number;
  gain: number;
  density: number;
  pan: number;
  alert: boolean;
}
export interface RegionScore extends Metrics {
  name: string;
  alert: boolean;
}
export interface FireWeek {
  week: number;
  start_date: string;
  data_gap: boolean;
  country: Metrics & { chord: number[] };
  cells: CellVoice[];
  regions: RegionScore[];
}
export interface FireScore {
  meta: {
    project: string;
    source: string;
    year: number;
    baseline_years: number[];
    grid: {
      west: number;
      south: number;
      east: number;
      north: number;
      res_deg: number;
    };
    weeks_per_year: number;
    anomaly: string;
    mapping: Record<string, string>;
  };
  weeks: FireWeek[];
}
export interface GeoFeature {
  type: string;
  properties: { shapeName: string };
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
}
export interface GeoCollection {
  type: "FeatureCollection";
  features: GeoFeature[];
}
export interface EicScore {
  meta: {
    source: string;
    layers: Record<string, { label: string; harmonics: number[] }>;
  };
  steps: {
    step: number;
    x: number;
    pan: number;
    layers: Record<string, { gain: number; midi: number; height: number }>;
  }[];
}
