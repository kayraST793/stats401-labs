"""Task 6 - generate semantic embeddings for every passage.

Each cleaned passage is encoded with the all-MiniLM-L6-v2 sentence model into
a 384-dimensional vector. Vectors are L2-normalised so cosine similarity is a
dot product. The matrix rows line up with bulletin_passages_clean.csv, and are
saved to lab8_embeddings.npy for the similarity, UMAP, and clustering tasks.
"""

import numpy as np
import pandas as pd
from sentence_transformers import SentenceTransformer

SRC = "../data/bulletin_passages_clean.csv"
OUT = "../data/lab8_embeddings.npy"

df = pd.read_csv(SRC)
texts = df["text_clean"].tolist()

model = SentenceTransformer("all-MiniLM-L6-v2")

embeddings = model.encode(
    texts,
    normalize_embeddings=True,
    batch_size=64,
    show_progress_bar=True,
)
embeddings = np.asarray(embeddings, dtype=np.float32)

np.save(OUT, embeddings)

print("passages :", len(texts))
print("embeddings:", embeddings.shape)
print("dtype     :", embeddings.dtype)
print("norm check:", round(float(np.linalg.norm(embeddings[0])), 4))
