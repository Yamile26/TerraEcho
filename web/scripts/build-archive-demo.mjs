/** Build an archive/EIC-only Next export without changing the full Node app. */
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const stage = path.join(root, ".sites-build/web");
let result = spawnSync(
  process.execPath,
  [path.join(root, "web/scripts/prepare-data.mjs")],
  { cwd: root, stdio: "inherit" },
);
if (result.status !== 0) process.exit(result.status ?? 1);
await rm(stage, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
await cp(path.join(root, "web"), stage, {
  recursive: true,
  filter: (src) => {
    const rel = path.relative(path.join(root, "web"), src).split(path.sep);
    return (
      !src.endsWith(".test.ts") && !rel.includes("tests") &&
      !rel.some((v) =>
        [
          "node_modules",
          ".next",
          "out",
          "qa",
          "qa-accessibility.html",
        ].includes(v),
      ) &&
      !rel.some((v) => v.startsWith(".env")) &&
      !(rel[0] === "src" && rel[1] === "app" && rel[2] === "api")
    );
  },
});
await writeFile(
  path.join(stage, "next.config.ts"),
  'export default { output: "export", poweredByHeader: false, devIndicators: false, images: { unoptimized: true }, trailingSlash: true };\n',
);
result = spawnSync(
  process.execPath,
  [path.join(root, "node_modules/next/dist/bin/next"), "build", stage],
  {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_PUBLIC_ARCHIVE_ONLY: "true",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
);
if (result.status !== 0) process.exit(result.status ?? 1);
await rm(path.join(root, "dist"), { recursive: true, force: true });
await cp(path.join(stage, "out"), path.join(root, "dist"), { recursive: true });
console.log(
  "Archive demo built in dist/. EIC/audio/history included; recent server API deliberately excluded.",
);
