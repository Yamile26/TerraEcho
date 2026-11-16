/** Keep the established Next UI; bundle its exports and the existing FIRMS provider in a Worker. */
import { readdir, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const result = spawnSync(process.execPath, ["web/scripts/build-archive-demo.mjs", "--edge-api"], {
  cwd: root, stdio: "inherit",
});
if (result.status !== 0) process.exit(result.status ?? 1);
const stage = path.join(root, ".sites-build/edge");
await mkdir(stage, { recursive: true });
const mime = { ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".geojson": "application/geo+json",
  ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8", ".woff2": "font/woff2" };
const assets = {};
async function collect(dir, prefix = "") {
  for (const item of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const filename = path.join(dir, item.name), relative = `${prefix}/${item.name}`;
    if (item.isDirectory()) await collect(filename, relative);
    else {
      if (item.name.startsWith(".env") || relative.includes("/qa/")) throw Error("Private/QA artifact in export");
      const raw = await readFile(filename), compressed = gzipSync(raw, { level: 9 });
      const zipped = compressed.length + 32 < raw.length;
      assets[relative] = { body: (zipped ? compressed : raw).toString("base64"), zipped,
        type: mime[path.extname(filename)] ?? "application/octet-stream",
        hash: createHash("sha256").update(raw).digest("hex") };
    }
  }
}
await collect(path.join(root, "dist"));
const geo = JSON.parse(await readFile(path.join(root, "web/public/data/peru_departments.geojson"), "utf8"));
await writeFile(path.join(stage, "assets.mjs"), `export const assets=${JSON.stringify(assets)};\nexport const geo=${JSON.stringify(geo)};\n`);
const handlerPath = path.join(root, "web/src/lib/edge-runtime.ts");
await writeFile(path.join(stage, "entry.mjs"), `
import { createEdgeApp } from ${JSON.stringify(handlerPath)};
import { assets, geo } from './assets.mjs';
const decoded = new Map(); let decodedBytes = 0;
async function asset(path, request) {
  const key = path === '/' ? '/index.html' : assets[path] ? path : path.replace(/\\/$/, '') + '/index.html';
  const a = assets[key]; if (!a) return null;
  const headers = { 'Content-Type': a.type, 'ETag': '"' + a.hash + '"', 'Cache-Control': key.startsWith('/_next/') ? 'public, max-age=31536000, immutable' : 'public, max-age=300', 'X-Content-Type-Options': 'nosniff' };
  if (request.headers.get('If-None-Match') === headers.ETag) return new Response(null, {status:304, headers});
  let bytes = decoded.get(key);
  if (!bytes) {
    bytes = Uint8Array.from(atob(a.body), c => c.charCodeAt(0));
    if (decodedBytes + bytes.length <= 12000000) { decoded.set(key, bytes); decodedBytes += bytes.length; }
  }
  if (a.zipped) headers['Content-Encoding'] = 'gzip';
  return new Response(request.method === 'HEAD' ? null : bytes, {headers});
}
export default createEdgeApp({geo, asset});
`);
await rm(path.join(root, "dist"), { recursive: true, force: true });
await mkdir(path.join(root, "dist/server"), { recursive: true });
await mkdir(path.join(root, "dist/.openai"), { recursive: true });
await build({ entryPoints: [path.join(stage, "entry.mjs")], outfile: path.join(root, "dist/server/index.js"),
  bundle: true, platform: "browser", format: "esm", target: "es2022", minify: true });
const hosting = JSON.parse(await readFile(path.join(root, ".openai/hosting.json"), "utf8"));
if (hosting.static) throw Error("Worker hosting must omit static configuration");
await writeFile(path.join(root, "dist/.openai/hosting.json"), JSON.stringify(hosting, null, 2) + "\n");
const worker = await readFile(path.join(root, "dist/server/index.js"));
console.log(JSON.stringify({ workerBytes: worker.length, gzipBytes: gzipSync(worker).length, assets: Object.keys(assets).length,
  sha256: createHash("sha256").update(worker).digest("hex") }));
