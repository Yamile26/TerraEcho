import type { EicScore } from "./types";
/** Deterministic offline synthesis of our own score, with bounded tanh output. */
export function eicWave(
  score: EicScore,
  enabled: string[],
  mono = false,
  secondsPerStep = 0.25,
  sampleRate = 22050,
): ArrayBuffer {
  if (
    !Number.isFinite(secondsPerStep) ||
    secondsPerStep < 0.1 ||
    secondsPerStep > 1 ||
    sampleRate < 8000 ||
    sampleRate > 48000
  )
    throw new Error("Invalid export configuration");
  const n = Math.floor(sampleRate * secondsPerStep),
    frames = n * score.steps.length;
  const comment = new TextEncoder().encode(
      JSON.stringify({
        source: score.meta.source,
        observedAt: score.meta.observed_at,
        piece: score.meta.piece_id,
        imageSha256: score.meta.image_sha256,
        extractor: score.meta.schema_version,
        enabled,
        mono,
        secondsPerStep,
        note: "Original TerraEcho synthesis of visual features; not atmospheric concentrations",
      }) + "\0",
    ),
    padded = comment.length + (comment.length % 2);
  const buffer = new ArrayBuffer(44 + frames * 4 + 20 + padded),
    view = new DataView(buffer);
  const str = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(at + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  view.setUint32(4, buffer.byteLength - 8, true);
  str(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  str(36, "data");
  view.setUint32(40, frames * 4, true);
  const fade = Math.min(0.03 * sampleRate, n / 2);
  score.steps.forEach((step, index) => {
    const voices = enabled
      .map((k) => ({ v: step.layers[k], h: score.meta.layers[k]?.harmonics }))
      .filter((x) => x.v && x.h && x.v.gain > 0.02);
    const angle = (((mono ? 0 : step.pan) + 1) * Math.PI) / 4;
    for (let j = 0; j < n; j++) {
      let v = 0;
      const t = j / sampleRate;
      for (const voice of voices) {
        const f = 440 * 2 ** ((voice.v.midi - 69) / 12);
        let tone = 0;
        voice.h.forEach((a, k) => {
          if (f * (k + 1) < sampleRate / 2)
            tone += a * Math.sin(2 * Math.PI * f * (k + 1) * t);
        });
        v += 0.22 * voice.v.gain * tone;
      }
      v *= Math.min(1, j / fade, (n - 1 - j) / fade);
      const at = 44 + (index * n + j) * 4;
      view.setInt16(
        at,
        Math.round(Math.tanh(v * Math.cos(angle)) * 0.9 * 32767),
        true,
      );
      view.setInt16(
        at + 2,
        Math.round(Math.tanh(v * Math.sin(angle)) * 0.9 * 32767),
        true,
      );
    }
  });
  const end = 44 + frames * 4;
  str(end, "LIST");
  view.setUint32(end + 4, 12 + padded, true);
  str(end + 8, "INFOICMT");
  view.setUint32(end + 16, comment.length, true);
  new Uint8Array(buffer, end + 20, comment.length).set(comment);
  return buffer;
}
