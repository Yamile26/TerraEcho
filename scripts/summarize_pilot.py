"""Summarize actual anonymous pilot records; refuses to invent missing data."""

import argparse
import csv
import json
import statistics


def summarize(rows):
    if not rows:
        raise ValueError("No participant records. Evaluation remains pending.")
    groups = {}
    for row in rows:
        if not row.get("participant_id") or row.get("consent") != "yes":
            raise ValueError("Missing anonymous ID or documented consent")
        if row["completed"] not in ("yes", "no") or row["correct"] not in (
            "yes",
            "no",
            "na",
        ):
            raise ValueError("Invalid outcome")
        seconds, comfort = float(row["seconds"]), int(row["comfort_1_5"])
        if seconds < 0 or not 1 <= comfort <= 5:
            raise ValueError("Invalid time or comfort rating")
        groups.setdefault(row["mode"], []).append((row, seconds, comfort))
    result = {}
    for mode, values in groups.items():
        scored = [r for r, _, _ in values if r["correct"] != "na"]
        result[mode] = {
            "participants": len({r["participant_id"] for r, _, _ in values}),
            "task_attempts": len(values),
            "completed": sum(r["completed"] == "yes" for r, _, _ in values),
            "correct": sum(r["correct"] == "yes" for r in scored),
            "scored_attempts": len(scored),
            "median_seconds": statistics.median(t for _, t, _ in values),
            "median_comfort_1_5": statistics.median(c for _, _, c in values),
        }
    return {
        "by_mode": result,
        "note": "Descriptive formative pilot; no population efficacy claim.",
    }


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("csv")
    args = p.parse_args()
    try:
        with open(args.csv, newline="") as f:
            print(json.dumps(summarize(list(csv.DictReader(f))), indent=2))
    except (ValueError, KeyError) as error:
        raise SystemExit(str(error))
