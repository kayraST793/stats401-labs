"""Task 7 - semantic similarity and nearest neighbours.

Cosine similarity on the L2-normalised embeddings is a single matrix product.
For each passage the five most similar other passages are stored, which powers
the worked example on the tasks page and the nearest-neighbour interaction in
Task 13. The most useful neighbours often sit in a different formal section but
discuss a related idea.
"""

import json
import numpy as np
import pandas as pd

df = pd.read_csv("../data/bulletin_passages_clean.csv")
emb = np.load("../data/lab8_embeddings.npy")

sim = emb @ emb.T            # cosine similarity, vectors are unit length
np.fill_diagonal(sim, -1)    # exclude each passage from its own neighbours

K = 5
neighbours = {}
for i, pid in enumerate(df["passage_id"]):
    order = np.argsort(sim[i])[::-1][:K]
    neighbours[pid] = [
        {"id": df["passage_id"].iloc[j], "score": round(float(sim[i, j]), 4)}
        for j in order
    ]

with open("../data/lab8_neighbors.json", "w", encoding="utf-8") as f:
    json.dump(neighbours, f)

# Worked example in the style of the lab.
i = 0
j = int(np.argmax(sim[i]))
print("SEED   :", df["section"].iloc[i], "| p" + str(df["page"].iloc[i]))
print("        ", df["text"].iloc[i][:180])
print("NEAREST:", df["section"].iloc[j], "| p" + str(df["page"].iloc[j]))
print("        ", df["text"].iloc[j][:180])
print("SIMILARITY:", round(float(sim[i, j]), 4))
print("\nneighbours written for", len(neighbours), "passages")
