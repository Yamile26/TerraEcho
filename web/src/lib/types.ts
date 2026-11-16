export type Level = "normal" | "elevated" | "critical" | "no_data";
export interface Metrics {
  count: number;
  frp: number | null;
  frp_unknown_count?: number;
  z: number | null;
  level: Level;
  dissonance: number;
}
export interface CellVoice extends Metrics {
  region?: string;
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
    schema_version?: string;
    geographic_scope?: string;
    coverage_status?: string;
    provenance?: Record<string, unknown>;
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
    schema_version: string;
    piece_id: string;
    image_sha256: string;
    observed_at: string;
    n_steps: number;
    thresholds: {
      min_saturation: number;
      min_value: number;
      saturation_per_layer: Record<string, number>;
    };
    normalization: string;
    crop_pixels: number[];
    layers: Record<string, { label: string; harmonics: number[] }>;
  };
  steps: {
    step: number;
    x: number;
    pan: number;
    layers: Record<
      string,
      {
        gain: number;
        midi: number;
        height: number;
        presence: number;
        weight: number;
        normalizer: number;
      }
    >;
  }[];
}

export interface EicPiece {
  id: string;
  title: string;
  question: string;
  description: string;
  crop: number[] | null;
  enabled: string[];
  score: string;
  image: string;
  mask: string;
  steps: number;
  durationSeconds: number;
  cropPixels: number[];
}
export interface EicCatalog {
  schema_version: string;
  source: {
    id: string;
    url: string;
    observedAt: string;
    publishedAt: string;
    credit: string;
    sha256: string;
    originalDownloadedAt: string | null;
    method: string;
    limitations: string;
  };
  pieces: EicPiece[];
}
