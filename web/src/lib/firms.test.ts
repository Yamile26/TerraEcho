import { test } from "node:test";
import assert from "node:assert/strict";
import { liveQuery, parseFirmsCsv } from "./firms";
test("FIRMS UTC acquisition time and missing FRP survive parsing", () => {
  const rows = parseFirmsCsv(
    "latitude,longitude,acq_date,acq_time,frp,confidence,satellite\r\n-12.5,-74.5,2026-10-01,0055,8.4,n,N\r\n-10,-75,2026-10-01,1330,,h,N\r\n",
  );
  assert.equal(rows[0].acquiredAt, "2026-10-01T00:55:00Z");
  assert.equal(rows[0].frp, 8.4);
  assert.equal(rows[1].frp, null);
});
test("invalid upstream responses cannot masquerade as zero detections", () => {
  assert.throws(
    () => parseFirmsCsv("Invalid MAP_KEY."),
    /INVALID_FIRMS_RESPONSE/,
  );
  assert.throws(
    () =>
      parseFirmsCsv(
        "latitude,longitude,acq_date,acq_time\n,-74,2026-01-01,1200",
      ),
    /INVALID_FIRMS_ROW/,
  );
  assert.throws(
    () =>
      parseFirmsCsv(
        "latitude,longitude,acq_date,acq_time\n-5,-74,2026-01-01,2960",
      ),
    /INVALID_FIRMS_ROW/,
  );
  assert.deepEqual(parseFirmsCsv("latitude,longitude,acq_date,acq_time\n"), []);
});
test("the public query is bounded and validates real calendar dates", () => {
  assert.equal(
    liveQuery(new URLSearchParams("days=5&date=2026-10-01")).days,
    5,
  );
  for (const query of [
    "days=6",
    "days=1e0",
    "date=2026-02-30",
    "date=2099-01-01",
    "days=0",
  ])
    assert.throws(() => liveQuery(new URLSearchParams(query)));
});
