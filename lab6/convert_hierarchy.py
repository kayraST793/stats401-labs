import json
from pathlib import Path

import pandas as pd

# paths are relative to this script so it runs from anywhere
here = Path(__file__).resolve().parent
data = here.parent / "data"

csv_in = data / "lab6_assignment_gdp.csv"
json_out = data / "lab6_assignment_gdp.json"


def build_hierarchy(frame, levels):
    # last level -> country leaves that keep gdp and status
    if len(levels) == 1:
        return [
            {
                "name": row[levels[0]],
                "gdp": int(row["gdp_billion_usd"]),
                "status": row["gdp_status"],
            }
            for _, row in frame.iterrows()
        ]

    level = levels[0]
    children = []

    for value, group in frame.groupby(level, sort=True):
        children.append(
            {
                "name": value,
                "children": build_hierarchy(group, levels[1:]),
            }
        )

    return children


df = pd.read_csv(csv_in)

hierarchy = {
    "name": "World",
    "children": build_hierarchy(df, ["continent", "area", "country"]),
}

with open(json_out, "w", encoding="utf-8") as f:
    json.dump(hierarchy, f, indent=2, ensure_ascii=False)

print(f"{len(df)} countries -> {json_out.name}")
