export const VIEWS = ["explorer", "history", "eic", "recent"] as const;
export type TerraView = (typeof VIEWS)[number];
export function readSelection(search: string) {
  const p = new URLSearchParams(search);
  const view = VIEWS.includes(p.get("view") as TerraView)
    ? (p.get("view") as TerraView)
    : "explorer";
  const year = Number(p.get("year") ?? 2025),
    week = Number(p.get("week") ?? 39);
  return {
    view,
    year: Number.isInteger(year) && year >= 2012 && year <= 2026 ? year : 2025,
    week: Number.isInteger(week) && week >= 0 && week < 52 ? week : 39,
    region: (p.get("region") ?? "Perú").slice(0, 80),
  };
}
export function shareUrl(
  origin: string,
  pathname: string,
  values: Record<string, string | number | boolean>,
) {
  const url = new URL(pathname, origin);
  for (const [key, value] of Object.entries(values))
    if (
      [
        "view",
        "year",
        "week",
        "region",
        "piece",
        "step",
        "layers",
        "mono",
      ].includes(key)
    )
      url.searchParams.set(key, String(value));
  return url.href;
}
export function downloadFile(data: BlobPart, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
