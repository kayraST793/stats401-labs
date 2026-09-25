"""Task 9 - cluster the embeddings, inspect topics, then label them.

k-means is run on the original 384-dim vectors (not the 2D projection). A short
silhouette scan justifies the number of clusters. For each cluster we compute
and PRINT the evidence first - its size, the sections it draws from, its most
characteristic terms (class-based TF-IDF), and the passages nearest the
centroid. Only AFTER that evidence exists are labels assigned, and each label
is anchored to distinctive terms the cluster must actually contain rather than
to k-means' arbitrary cluster index. If a future run reshuffles the clusters,
the anchoring either relabels them correctly or fails loudly - it can never
silently attach a name to the wrong cluster.
"""

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.feature_extraction.text import TfidfVectorizer, CountVectorizer

df = pd.read_csv("../data/bulletin_passages_clean.csv")
emb = np.load("../data/lab8_embeddings.npy")

print("SILHOUETTE SCAN (cosine on unit vectors):")
for k in (6, 8, 10, 12):
    km = KMeans(n_clusters=k, random_state=401, n_init="auto").fit(emb)
    s = silhouette_score(emb, km.labels_, metric="cosine")
    print(f"  k={k:2d}  silhouette={s:.4f}")

K = 8
km = KMeans(n_clusters=K, random_state=401, n_init="auto").fit(emb)
df["cluster"] = km.labels_

extra = {"students", "student", "course", "courses", "credit", "credits",
         "duke", "kunshan", "university", "dku", "will", "may", "also",
         "including", "required", "requirements", "students'"}
stop = list(CountVectorizer(stop_words="english").get_stop_words() | extra)

# Class-based TF-IDF: one document per cluster.
grouped = df.groupby("cluster")["text_clean"].apply(lambda s: " ".join(s))
vec = TfidfVectorizer(stop_words=stop, ngram_range=(1, 2), min_df=1, sublinear_tf=True)
mat = vec.fit_transform(grouped.values)
vocab = np.array(vec.get_feature_names_out())

# --- Step 1: compute and PRINT the evidence for every cluster (no labels yet).
top_terms = {}
for c in range(K):
    sub = df[df["cluster"] == c]
    row = mat[c].toarray().ravel()
    ranked = vocab[np.argsort(row)[::-1][:15]]
    top_terms[c] = list(ranked)

    centroid = emb[sub.index].mean(axis=0)
    d = emb[sub.index] @ centroid
    reps = sub.iloc[np.argsort(d)[::-1][:3]]

    print(f"\n===== CLUSTER {c}  (n={len(sub)}) =====")
    print("terms   :", ", ".join(ranked[:10]))
    print("sections:", ", ".join(f"{s} ({n})" for s, n in
                                  sub["section"].value_counts().head(4).items()))
    for _, r in reps.iterrows():
        print("  -", r["text"][:150])

# --- Step 2: assign labels from the evidence above. Each label is anchored to
# distinctive terms the cluster must contain; matching is by terms, not index.
RULES = {
    "Natural & Life Sciences":
        ["molecular", "cellular", "organisms", "metabolism", "bioscience", "genome"],
    "Quantitative & Computing Sciences":
        ["algorithms", "programming", "data science", "theorem", "software"],
    "Arts, Humanities & Media":
        ["fiction", "new media", "contemporary china", "urban", "asia"],
    "Politics, Society & Ethics":
        ["democracy", "democratic", "justice", "moral"],
    "Academic Standing & Withdrawal":
        ["probation", "withdrawal", "leave absence", "registrar", "probationary"],
    "Transfer Credit & Study Away":
        ["prior matriculation", "precollege", "transferred", "ipc", "matriculation"],
    "Advanced Placement & Grading":
        ["advanced placement", "college board", "board examination", "cum laude"],
    "Curriculum & Degree Structure":
        ["recommended major", "electives recommended", "target language", "updated periodically"],
}


def match_label(terms):
    window = terms[:12]
    hits = [name for name, anchors in RULES.items()
            if any(a in window for a in anchors)]
    if len(hits) != 1:
        raise ValueError(
            f"cluster terms matched {hits or 'no'} labels; expected exactly one. "
            f"Top terms: {window}"
        )
    return hits[0]


assignment = {c: match_label(top_terms[c]) for c in range(K)}
if len(set(assignment.values())) != K:
    raise ValueError(f"label assignment is not one-to-one: {assignment}")

df["cluster_name"] = df["cluster"].map(assignment)

print("\nLABELS (term-anchored, derived from the evidence above):")
for c in range(K):
    print(f"  cluster {c} -> {assignment[c]}")

# --- Step 3: write outputs.
topic_rows = [{
    "cluster": c,
    "cluster_name": assignment[c],
    "size": int((df["cluster"] == c).sum()),
    "terms": ", ".join(top_terms[c][:8]),
} for c in range(K)]

df[["passage_id", "cluster", "cluster_name"]].to_csv("../data/lab8_clusters.csv", index=False)
pd.DataFrame(topic_rows).to_csv("../data/lab8_topics.csv", index=False)
print("\nwrote lab8_clusters.csv and lab8_topics.csv")
