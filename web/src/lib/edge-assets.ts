/** Bundled bytes stay compressed at rest; return decoded bodies to the hosting proxy. */
export interface BundledAsset {
  body: string;
  zipped: boolean;
  type: string;
  hash: string;
}

export function createAssetHandler(assets: Record<string, BundledAsset>) {
  const decoded = new Map<string, Uint8Array<ArrayBuffer>>();
  let cachedBytes = 0;
  return async (path: string, request: Request): Promise<Response | null> => {
    const key = path === "/" ? "/index.html" : assets[path] ? path :
      path.replace(/\/$/, "") + "/index.html";
    const asset = assets[key];
    if (!asset) return null;
    const headers = {
      "Content-Type": asset.type,
      ETag: `"${asset.hash}"`,
      "Cache-Control": key.startsWith("/_next/") ?
        "public, max-age=31536000, immutable" : "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    };
    if (request.headers.get("If-None-Match") === headers.ETag)
      return new Response(null, { status: 304, headers });
    if (request.method === "HEAD") return new Response(null, { headers });
    let bytes = decoded.get(key);
    if (!bytes) {
      bytes = Uint8Array.from(atob(asset.body), (char) => char.charCodeAt(0));
      if (cachedBytes + bytes.length <= 12_000_000) {
        decoded.set(key, bytes);
        cachedBytes += bytes.length;
      }
    }
    // Return original bytes; the publication gateway owns transport compression.
    const body = asset.zipped ? new Response(bytes).body!
      .pipeThrough(new DecompressionStream("gzip")) : bytes;
    return new Response(body, { headers });
  };
}
