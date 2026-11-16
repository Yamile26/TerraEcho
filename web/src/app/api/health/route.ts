import { NextResponse } from "next/server";
export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "terraecho-web",
      firmsConfigured: Boolean(process.env.FIRMS_MAP_KEY),
      scoreProvider: process.env.TERRAECHO_PYTHON_API_URL
        ? "python"
        : "repository-snapshot",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
