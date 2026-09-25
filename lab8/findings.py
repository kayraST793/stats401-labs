"""One-off analysis to ground the assignment findings (Part G).

Prints: topic sizes, how many formal sections each topic spans, the most
semantically diverse sections, high-similarity cross-section passage pairs,
and where a few key search terms occur across topics.
"""

import json
import numpy as np
import pandas as pd

df = pd.read_csv("../data/lab8_embedding_map.csv")
with open("../data/lab8_neighbors.json", encoding="utf-8") as f:
    neighbors = json.load(f)

by_id = df.set_index("passage_id")

print("TOPIC SIZES")
print(df["cluster_name"].value_counts().to_string())

print("\nSECTIONS EACH TOPIC SPANS")
print(df.groupby("cluster_name")["section"].nunique().sort_values(ascending=False).to_string())

print("\nMOST DIVERSE SECTIONS (sections with >= 10 passages)")
big = df.groupby("section").filter(lambda g: len(g) >= 10)
div = big.groupby("section")["cluster_name"].agg(["nunique", "count"])
div = div.sort_values("nunique", ascending=False).head(8)
print(div.to_string())

print("\nCROSS-SECTION SIMILAR PAIRS (different sections, highest cosine)")
seen = set()
pairs = []
for pid, nbs in neighbors.items():
    s_sec = by_id.loc[pid, "section"]
    for n in nbs:
        t_sec = by_id.loc[n["id"], "section"]
        if s_sec != t_sec:
            key = tuple(sorted([pid, n["id"]]))
            if key in seen:
                continue
            seen.add(key)
            pairs.append((n["score"], pid, s_sec, n["id"], t_sec))
pairs.sort(reverse=True)
for score, a, asec, b, bsec in pairs[:8]:
    print(f"\n  {score:.3f}  [{asec}] <-> [{bsec}]")
    print("    A:", by_id.loc[a, "text"][:110])
    print("    B:", by_id.loc[b, "text"][:110])

print("\nKEY TERM OCCURRENCE ACROSS TOPICS")
for term in ["credit", "graduation", "registration", "academic integrity"]:
    mask = df["text_clean"].str.contains(term, case=False, na=False)
    hits = df[mask]
    print(f"\n  '{term}': {len(hits)} passages across {hits['cluster_name'].nunique()} topics")
    print("   ", hits["cluster_name"].value_counts().head(4).to_dict())
