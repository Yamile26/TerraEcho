export interface FireObservation {
  latitude: number;
  longitude: number;
  frp: number | null;
  acquiredAt: string;
  confidence: string;
  satellite: string;
}
/** Handles CSV quoting; rejects malformed rows rather than turning missing values into zero. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (quoted) throw new Error("INVALID_CSV");
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
export function parseFirmsCsv(csv: string): FireObservation[] {
  const rows = parseCsv(csv),
    header = rows.shift()?.map((v) =>
      v
        .trim()
        .toLowerCase()
        .replace(/^\uFEFF/, ""),
    );
  if (
    !header ||
    !["latitude", "longitude", "acq_date", "acq_time"].every((k) =>
      header.includes(k),
    )
  )
    throw new Error("INVALID_FIRMS_RESPONSE");
  return rows.map((row) => {
    const get = (key: string) => row[header.indexOf(key)]?.trim() ?? "";
    const latitude = Number(get("latitude")),
      longitude = Number(get("longitude")),
      frp = get("frp");
    const date = get("acq_date"),
      time = get("acq_time").padStart(4, "0");
    if (
      !get("latitude") ||
      !get("longitude") ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !/^\d{4}$/.test(time) ||
      +time.slice(0, 2) > 23 ||
      +time.slice(2) > 59 ||
      (frp !== "" && (!Number.isFinite(Number(frp)) || Number(frp) < 0))
    )
      throw new Error("INVALID_FIRMS_ROW");
    return {
      latitude,
      longitude,
      frp: frp === "" ? null : Number(frp),
      acquiredAt: `${date}T${time.slice(0, 2)}:${time.slice(2)}:00Z`,
      confidence: get("confidence"),
      satellite: get("satellite") || "Suomi NPP",
    };
  });
}
export function liveQuery(params: URLSearchParams) {
  const raw = params.get("days") ?? "1";
  if (!/^[1-5]$/.test(raw)) throw new Error("INVALID_DAYS");
  const date = params.get("date");
  if (date) {
    const parsed = new Date(`${date}T00:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== date ||
      date > new Date().toISOString().slice(0, 10)
    )
      throw new Error("INVALID_DATE");
  }
  return { days: Number(raw), date };
}
