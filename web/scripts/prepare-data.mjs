import {
  mkdir,
  copyFile,
  readFile,
  writeFile,
  cp,
  rename,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { gunzipSync } from "node:zlib";
const web = fileURLToPath(new URL("../", import.meta.url));
const root = path.resolve(web, "..");
await mkdir(path.join(web, "public/data"), { recursive: true });
await mkdir(path.join(web, "public/eic"), { recursive: true });
const catalog = JSON.parse(
  await readFile(path.join(root, "data/scores/catalog.json"), "utf8"),
);
const hash = (raw) => createHash("sha256").update(raw).digest("hex");
const prepared = [];
for (const { year, quality, scoreSha256 } of catalog.entries) {
  const raw =
    quality === "reprocessed-source-archive"
      ? gunzipSync(
          await readFile(
            path.join(root, `data/scores/verified/terraecho_${year}.json.gz`),
          ),
        ).toString("utf8")
      : await readFile(
          path.join(root, `data/scores/terraecho_${year}.json`),
          "utf8",
        );
  if (hash(raw) !== scoreSha256)
    throw new Error(`Score checksum mismatch: ${year}`);
  const score = JSON.parse(raw);
  if (score.meta.year !== year || (score.weeks.length !== 52 && year !== 2026))
    throw new Error(`Incompatible release score: ${year}`);
  if (quality === "reprocessed-source-archive") {
    for (const [field, filename] of [
      ["algorithm_sha256", "terraecho/science.py"],
      ["geometry_sha256", "data/peru_departments.geojson"],
      ["manifest_sha256", "data/manifests/firms-downloads.json"],
    ]) {
      if (
        hash(await readFile(path.join(root, filename))) !==
        score.meta.provenance[field]
      )
        throw new Error(
          `Release provenance changed (${field}); rebuild and verify before publishing.`,
        );
    }
  }
  prepared.push({ year, raw });
}
const image = await readFile(
  path.join(root, "data/eic/Aerosols_2025-08-19T20_00_00_1920x1080.png"),
);
const eicCatalog = JSON.parse(
  await readFile(path.join(root, "data/eic/pieces/catalog.json"), "utf8"),
);
if (hash(image) !== eicCatalog.source.sha256)
  throw new Error("EIC source fingerprint mismatch");
// Validate every release input before replacing any prepared score.
for (const { year, raw } of prepared) {
  const file = path.join(web, `public/data/terraecho_${year}.json`);
  await writeFile(file + ".tmp", raw);
  await rename(file + ".tmp", file);
}
await copyFile(
  path.join(root, "data/scores/catalog.json"),
  path.join(web, "public/data/catalog.json"),
);
await cp(
  path.join(root, "data/manifests"),
  path.join(web, "public/data/provenance"),
  { recursive: true, force: true },
);
await copyFile(
  path.join(root, "data/scores/science-qa.json"),
  path.join(web, "public/data/provenance/science-qa.json"),
);
await copyFile(
  path.join(root, "data/peru_departments.geojson"),
  path.join(web, "public/data/peru_departments.geojson"),
);
await copyFile(
  path.join(root, "data/scores/eic_aerosols.json"),
  path.join(web, "public/data/eic_aerosols.json"),
);
await copyFile(
  path.join(root, "data/eic/Aerosols_2025-08-19T20_00_00_1920x1080.png"),
  path.join(web, "public/eic/aerosols.png"),
);
await cp(
  path.join(root, "data/eic/pieces"),
  path.join(web, "public/eic/pieces"),
  { recursive: true, force: true },
);
console.log(
  "Prepared existing FIRMS scores, department boundaries and EIC frame. No synthetic observations generated.",
);
