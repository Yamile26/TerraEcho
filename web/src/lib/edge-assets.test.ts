import { test } from "node:test";
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { createAssetHandler, type BundledAsset } from "./edge-assets";

function bundled(bytes: Buffer, type: string, zipped: boolean): BundledAsset {
  return { body: (zipped ? gzipSync(bytes) : bytes).toString("base64"), type, zipped,
    hash: createHash("sha256").update(bytes).digest("hex") };
}
const request = (path: string, options?: RequestInit) =>
  new Request(`https://example.test${path}`, options);

test("compressed HTML and JSON are readable without a downstream Content-Encoding header", async () => {
  const html = Buffer.from("<!doctype html><title>TerraEcho</title><main>Imagen → sonido</main>");
  const json = Buffer.from(JSON.stringify({ observations: [], note: "cobertura desconocida" }));
  const assets = { "/index.html": bundled(html, "text/html; charset=utf-8", true),
    "/data/score.json": bundled(json, "application/json", true) };
  const serve = createAssetHandler(assets);
  for (const [path, bytes] of [["/", html], ["/data/score.json", json]] as const) {
    const response = await serve(path, request(path));
    assert.ok(response);
    assert.equal(response?.status, 200);
    assert.equal(response.headers.get("Content-Encoding"), null);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
  }
});

test("binary assets preserve their bytes, MIME type and raw-byte fingerprint", async () => {
  const bytes = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x41, 0x00, 0xff, 0xd9]);
  const asset = bundled(bytes, "image/jpeg", false);
  const serve = createAssetHandler({ "/frame.jpg": asset });
  const response = await serve("/frame.jpg", request("/frame.jpg"));
  assert.ok(response);
  assert.equal(response?.headers.get("Content-Type"), "image/jpeg");
  assert.equal(response.headers.get("ETag"), `"${asset.hash}"`);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
});

test("HEAD, conditional requests, route fallback and immutable caching keep their contracts", async () => {
  const asset = bundled(Buffer.from("export default 1"), "application/javascript", true);
  const serve = createAssetHandler({ "/_next/app.js": asset, "/about/index.html": asset });
  const head = await serve("/_next/app.js", request("/_next/app.js", { method: "HEAD" }));
  assert.equal(await head?.text(), "");
  assert.match(head!.headers.get("Cache-Control")!, /immutable/);
  const cached = await serve("/_next/app.js", request("/_next/app.js", { headers: { "If-None-Match": `"${asset.hash}"` } }));
  assert.ok(cached);
  assert.equal(cached?.status, 304);
  assert.equal(await cached.text(), "");
  assert.equal(await (await serve("/about/", request("/about/")))?.text(), "export default 1");
  assert.equal(await serve("/missing", request("/missing")), null);
});
