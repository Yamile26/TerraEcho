import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parseEicCatalog, parseEicScore } from "../src/lib/eic";
import { eicWave } from "../src/lib/wav";
const root = new URL("../../", import.meta.url);
const catalog = parseEicCatalog(
  JSON.parse(
    await readFile(new URL("data/eic/pieces/catalog.json", root), "utf8"),
  ),
);
await mkdir(new URL("out/reference/", root), { recursive: true });
const report = [];
for (const p of catalog.pieces) {
  const score = parseEicScore(
    JSON.parse(
      await readFile(new URL(`data/eic/pieces/${p.id}.json`, root), "utf8"),
    ),
  );
  const buffer = Buffer.from(eicWave(score, p.enabled));
  await writeFile(new URL(`out/reference/${p.id}.wav`, root), buffer);
  const bytes = buffer.readUInt32LE(40),
    samples = bytes / 2;
  let peak = 0,
    clipped = 0;
  for (let i = 0; i < samples; i++) {
    const n = Math.abs(buffer.readInt16LE(44 + i * 2));
    peak = Math.max(peak, n);
    if (n >= 32767) clipped++;
  }
  report.push({
    piece: p.id,
    sampleRate: 22050,
    channels: 2,
    seconds: bytes / (22050 * 4),
    peakPCM: peak,
    clippedSamples: clipped,
    sha256: createHash("sha256").update(buffer).digest("hex"),
  });
}
await writeFile(
  new URL("docs/evaluation/reference-audio-check.json", root),
  JSON.stringify(
    {
      sourceImageSha256: catalog.source.sha256,
      renderer:
        "Shared CLI/browser-worker offline synthesis; live Web Audio uses a different master chain",
      pieces: report,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "Exported three original reference WAVs into out/reference; no human listening results asserted.",
);
