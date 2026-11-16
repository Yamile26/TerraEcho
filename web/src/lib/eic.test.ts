import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseEicCatalog, parseEicScore } from "./eic";
import { AudioTimeline } from "./transport";
import { eicWave } from "./wav";
import { readSelection, shareUrl } from "./navigation";
const catalog = () =>
  parseEicCatalog(
    JSON.parse(readFileSync("public/eic/pieces/catalog.json", "utf8")),
  );
const score = () =>
  parseEicScore(
    JSON.parse(readFileSync("public/eic/pieces/aerosols-global.json", "utf8")),
  );
test("every curated piece matches the real frame fingerprint and bounded feature contract", () => {
  const c = catalog();
  assert.equal(c.pieces.length, 3);
  for (const p of c.pieces) {
    const d = parseEicScore(
      JSON.parse(readFileSync(`public${p.score}`, "utf8")),
    );
    assert.equal(d.meta.image_sha256, c.source.sha256);
    assert.equal(d.meta.piece_id, p.id);
    assert.equal(d.steps.length, 104);
  }
});
test("malformed EIC audio parameters and arbitrary asset URLs are rejected", () => {
  for (const mutation of [
    (d: ReturnType<typeof score>) => {
      d.steps[0].layers.dust.gain = NaN;
    },
    (d: ReturnType<typeof score>) => {
      d.steps[0].layers.dust.midi = 300;
    },
    (d: ReturnType<typeof score>) => {
      delete (d.steps[0].layers as Record<string, unknown>).sulfate;
    },
    (d: ReturnType<typeof score>) => {
      d.steps[1].x = d.steps[0].x;
    },
  ]) {
    const d = score();
    mutation(d);
    assert.throws(() => parseEicScore(d));
  }
  const c = catalog();
  c.pieces[0].image = "https://unknown.example/image.png";
  assert.throws(() => parseEicCatalog(c));
});
test("audio clock scheduling skips expired notes and is independent of UI tick count", () => {
  let now = 10;
  const t = new AudioTimeline(104, 0.25, () => now),
    scheduled: number[] = [];
  t.start(4);
  t.tick((i) => scheduled.push(i));
  assert.deepEqual(scheduled, [4]);
  now = 11.1;
  t.tick((i) => scheduled.push(i));
  assert.equal(t.position(), 8);
  assert.ok(!scheduled.includes(5) && !scheduled.includes(6));
  assert.ok(scheduled.includes(8));
  assert.equal(t.pause(), 8);
});
test("offline export is a bounded stereo PCM WAV; mono channels agree", () => {
  const s = score();
  s.steps = s.steps.slice(0, 2);
  const wave = eicWave(s, ["dust", "sulfate"], true, 0.1, 8000),
    v = new DataView(wave);
  assert.equal(v.getUint32(24, true), 8000);
  assert.equal(v.getUint16(22, true), 2);
  let peak = 0;
  for (let at = 44; at < 44 + v.getUint32(40, true); at += 4) {
    const a = v.getInt16(at, true),
      b = v.getInt16(at + 2, true);
    assert.equal(a, b);
    peak = Math.max(peak, Math.abs(a));
  }
  assert.ok(peak > 0 && peak < 32767);
  assert.equal(v.getUint32(40, true), 6400);
  assert.ok(
    new TextDecoder().decode(wave.slice(44 + 6400)).includes("imageSha256"),
  );
});
test("share URLs reproduce only selection fields and reject secret parameters", () => {
  const url = shareUrl("https://terraecho.example", "/", {
    view: "eic",
    piece: "aerosols-smoke",
    FIRMS_MAP_KEY: "test-secret",
  });
  assert.ok(!url.includes("secret") && !url.includes("FIRMS_MAP_KEY"));
  assert.equal(readSelection("?view=invalid&year=99999&week=-3").year, 2025);
});
