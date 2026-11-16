import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
await mkdir(new URL("../public/qa/", import.meta.url), { recursive: true });
await copyFile(
  new URL("../tests/accessibility.html", import.meta.url),
  new URL("../public/qa-accessibility.html", import.meta.url),
);
await copyFile(
  require.resolve("axe-core/axe.min.js"),
  new URL("../public/qa/axe.min.js", import.meta.url),
);
console.log(
  "Open /qa-accessibility.html in the development browser; this harness is excluded from production packaging.",
);
