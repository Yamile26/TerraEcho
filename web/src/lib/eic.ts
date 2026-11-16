import type { EicCatalog, EicScore } from "./types";

export const EIC_LAYERS = [
  {
    id: "black_carbon",
    name: "Humo · carbono negro",
    detail: "Naranja y rojo",
    color: "#f59a67",
    instrument: "Voz cálida",
  },
  {
    id: "dust",
    name: "Polvo",
    detail: "Rosa y magenta",
    color: "#bd9be6",
    instrument: "Voz grave",
  },
  {
    id: "sea_salt",
    name: "Sal marina",
    detail: "Azul y cian",
    color: "#7fc7e2",
    instrument: "Voz aguda",
  },
  {
    id: "sulfate",
    name: "Sulfatos",
    detail: "Verde",
    color: "#a9dd9e",
    instrument: "Voz de campana",
  },
] as const;
const keys = EIC_LAYERS.map((l) => l.id);
const finiteRange = (n: unknown, a: number, b: number): n is number =>
  typeof n === "number" && Number.isFinite(n) && n >= a && n <= b;
export function parseEicScore(value: unknown): EicScore {
  const d = value as EicScore;
  if (
    !d?.meta ||
    d.meta.schema_version !== "2.0.0" ||
    typeof d.meta.source !== "string" ||
    !d.meta.source.includes("https://svs.gsfc.nasa.gov/5669/") ||
    !Number.isFinite(Date.parse(d.meta.observed_at)) ||
    !finiteRange(d.meta.thresholds?.min_saturation, 0, 1) ||
    !finiteRange(d.meta.thresholds?.min_value, 0, 1) ||
    !/^[a-f0-9]{64}$/.test(d.meta.image_sha256) ||
    !/^aerosols-[a-z-]+$/.test(d.meta.piece_id) ||
    !Array.isArray(d.steps) ||
    d.steps.length < 8 ||
    d.steps.length > 512 ||
    d.meta.n_steps !== d.steps.length
  )
    throw new Error("Partitura EIC incompleta o incompatible.");
  for (const id of keys) {
    const h = d.meta.layers?.[id]?.harmonics;
    if (
      !Array.isArray(h) ||
      h.length < 1 ||
      h.length > 16 ||
      h.some((n) => !finiteRange(n, 0, 1)) ||
      !finiteRange(d.meta.thresholds.saturation_per_layer?.[id], 0, 1)
    )
      throw new Error("Timbre EIC inválido.");
  }
  if (
    !Array.isArray(d.meta.crop_pixels) ||
    d.meta.crop_pixels.length !== 4 ||
    d.meta.crop_pixels.some(
      (n) => !Number.isInteger(n) || !finiteRange(n, 0, 100000),
    ) ||
    d.meta.crop_pixels[2] <= d.meta.crop_pixels[0] ||
    d.meta.crop_pixels[3] <= d.meta.crop_pixels[1]
  )
    throw new Error("Encuadre EIC inválido.");
  for (const [i, st] of d.steps.entries()) {
    if (
      st.step !== i ||
      !finiteRange(st.x, 0, 1) ||
      !finiteRange(st.pan, -1, 1) ||
      (i && st.x <= d.steps[i - 1].x)
    )
      throw new Error("Orden del barrido EIC inválido.");
    for (const id of keys) {
      const l = st.layers?.[id];
      if (
        !l ||
        !Number.isInteger(l.midi) ||
        !finiteRange(l.midi, 24, 108) ||
        !finiteRange(l.gain, 0, 1) ||
        !finiteRange(l.height, 0, 1) ||
        !finiteRange(l.presence, 0, 1) ||
        !finiteRange(l.weight, 0, 1) ||
        !finiteRange(l.normalizer, 0, 1)
      )
        throw new Error("Parámetros de audio EIC inválidos.");
    }
  }
  return d;
}
export function parseEicCatalog(value: unknown): EicCatalog {
  const d = value as EicCatalog;
  if (
    d?.schema_version !== "1.0.0" ||
    d.source?.url !== "https://svs.gsfc.nasa.gov/5669/" ||
    !/^[a-f0-9]{64}$/.test(d.source.sha256) ||
    !Array.isArray(d.pieces) ||
    !d.pieces.length ||
    d.pieces.length > 12
  )
    throw new Error("Catálogo EIC inválido.");
  const seen = new Set<string>();
  for (const p of d.pieces) {
    if (
      !/^aerosols-[a-z-]+$/.test(p.id) ||
      seen.has(p.id) ||
      typeof p.title !== "string" ||
      typeof p.question !== "string" ||
      !Array.isArray(p.enabled) ||
      !p.enabled.length ||
      p.enabled.some((k) => !keys.includes(k as (typeof keys)[number])) ||
      p.score !== `/eic/pieces/${p.id}.json` ||
      !["/eic/aerosols.png", `/eic/pieces/${p.id}.png`].includes(p.image) ||
      ![
        `/eic/pieces/${p.id}-mask.png`,
        "/eic/pieces/aerosols-global-mask.png",
      ].includes(p.mask)
    )
      throw new Error("Pieza del catálogo EIC inválida.");
    seen.add(p.id);
  }
  return d;
}
export function midiName(midi: number) {
  return `${["Do", "Do♯", "Re", "Re♯", "Mi", "Fa", "Fa♯", "Sol", "Sol♯", "La", "La♯", "Si"][midi % 12]}${Math.floor(midi / 12) - 1}`;
}
export function midiHz(midi: number) {
  return 440 * 2 ** ((midi - 69) / 12);
}
export function describeEicStep(
  score: EicScore,
  index: number,
  enabled: ReadonlySet<string>,
) {
  const step = score.steps[index];
  return EIC_LAYERS.filter((l) => enabled.has(l.id))
    .map((l) => {
      const v = step.layers[l.id];
      return `${l.name}: ${(v.presence * 100).toFixed(1)} por ciento de píxeles seleccionados en la franja; ${midiName(v.midi)}, ganancia relativa ${Math.round(v.gain * 100)} por ciento`;
    })
    .join(". ");
}
