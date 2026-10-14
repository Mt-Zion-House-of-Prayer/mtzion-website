"""Delete bulletins older than 3 months (PDF + entry in data/bulletins.json).

Run weekly by .github/workflows/prune-bulletins.yml. Safe to run by hand:
    python3 scripts/prune_bulletins.py
"""
import datetime as dt
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "bulletins.json"


def three_months_ago(today):
    y, m = today.year, today.month - 3
    if m < 1:
        y, m = y - 1, m + 12
    for day in (today.day, 30, 29, 28):  # clamp e.g. May 31 -> Feb 28
        try:
            return dt.date(y, m, day)
        except ValueError:
            pass


cutoff = three_months_ago(dt.date.today())
bulletins = json.loads(DATA.read_text())
keep = [b for b in bulletins if dt.date.fromisoformat(b["date"]) >= cutoff]
for b in bulletins:
    if b not in keep:
        (ROOT / b["file"]).unlink(missing_ok=True)
        print("removed", b["file"])
DATA.write_text(json.dumps(keep, indent=1) + "\n")
print(f"kept {len(keep)} bulletins on/after {cutoff}")
