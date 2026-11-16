import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseScore } from "./data";
import type { FireScore } from "./types";

export async function loadScore(
  year: number,
): Promise<{ score: FireScore; provider: string }> {
  const api = process.env.TERRAECHO_PYTHON_API_URL;
  if (api) {
    const url = new URL(
      `v1/scores/${year}`,
      api.endsWith("/") ? api : `${api}/`,
    );
    if (!["http:", "https:"].includes(url.protocol))
      throw new Error("INVALID_PYTHON_URL");
    const r = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
    if (r.status === 404) throw new Error("DATA_NOT_EXPORTED");
    if (!r.ok) throw new Error("PYTHON_UNAVAILABLE");
    const score = parseScore(await r.json());
    if (score.meta.year !== year) throw new Error("YEAR_MISMATCH");
    return { score, provider: "python" };
  }
  try {
    const score = parseScore(
      JSON.parse(
        await readFile(
          path.join(process.cwd(), `public/data/terraecho_${year}.json`),
          "utf8",
        ),
      ),
    );
    if (score.meta.year !== year) throw new Error("YEAR_MISMATCH");
    return { score, provider: "repository-snapshot" };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT")
      throw new Error("DATA_NOT_EXPORTED");
    throw e;
  }
}
