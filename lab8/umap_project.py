"""Task 8 - project the embeddings to 2D with UMAP.

UMAP has no native Windows-ARM64 build, so it runs from an x64 (emulated)
virtual environment (.venv_x64). Settings follow the lab: cosine metric,
n_neighbors=15, min_dist=0.15, random_state=401 for a reproducible layout.
Only proximity is meaningful - nearby passages are semantically similar and
the two axes are not independent variables.
"""

import numpy as np
import pandas as pd
import umap

df = pd.read_csv("../data/bulletin_passages_clean.csv")
emb = np.load("../data/lab8_embeddings.npy")

reducer = umap.UMAP(
    n_components=2,
    n_neighbors=15,
    min_dist=0.15,
    metric="cosine",
    random_state=401,
)
coords = reducer.fit_transform(emb)

df["x"] = coords[:, 0]
df["y"] = coords[:, 1]
df[["passage_id", "x", "y"]].to_csv("../data/lab8_coords.csv", index=False)

print("projected:", coords.shape)
print("x range:", round(float(df.x.min()), 2), "to", round(float(df.x.max()), 2))
print("y range:", round(float(df.y.min()), 2), "to", round(float(df.y.max()), 2))
