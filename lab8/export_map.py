"""Task 10 - export one visualization-ready table.

Joins the cleaned passages (text + hierarchy + word_count), the UMAP
coordinates, and the cluster labels into a single file keyed by passage_id.
This is the only file the D3 semantic map and topic matrix need to load.
"""

import pandas as pd

passages = pd.read_csv("../data/bulletin_passages_clean.csv")
coords = pd.read_csv("../data/lab8_coords.csv")
clusters = pd.read_csv("../data/lab8_clusters.csv")

df = (
    passages
    .merge(coords, on="passage_id", how="inner")
    .merge(clusters, on="passage_id", how="inner")
)

cols = ["passage_id", "chapter", "section", "subsection", "page",
        "text", "text_clean", "word_count", "cluster", "cluster_name", "x", "y"]
df = df[cols]

assert len(df) == len(passages), "row count changed during the joins"
assert df[["x", "y", "cluster_name"]].notna().all().all(), "missing coords or labels"

df.to_csv("../data/lab8_embedding_map.csv", index=False)

print("rows      :", len(df))
print("columns   :", ", ".join(df.columns))
print("topics    :", df["cluster_name"].nunique())
print("sections  :", df["section"].nunique())
