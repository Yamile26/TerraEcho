import { mkdir, copyFile, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const web = fileURLToPath(new URL("../", import.meta.url));
const root = path.resolve(web, "..");
await mkdir(path.join(web, "public/data"), { recursive: true });
await mkdir(path.join(web, "public/eic"), { recursive: true });
for (const year of [2025, 2026]) {
  const score = JSON.parse(
    await readFile(
      path.join(root, `data/scores/terraecho_${year}.json`),
      "utf8",
    ),
  );
  await writeFile(
    path.join(web, `public/data/terraecho_${year}.json`),
    JSON.stringify(score),
  );
}
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
console.log(
  "Prepared existing FIRMS scores, department boundaries and EIC frame. No synthetic observations generated.",
);
