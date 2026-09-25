# Lab 8: Web Text Data and Visualization

Interactive exploration of the Duke Kunshan University Undergraduate Bulletin
(V2021-22). Each paragraph of the ~400 page PDF becomes one passage, and the
page connects the document's formal structure (parts, sections, pages) with its
semantic structure (passages grouped by meaning) through two coordinated views:
a semantic embedding map and a Topic by Section matrix.

## Files

Web (required to run the assignment):

```
lab8/index.html      the assignment page
lab8/lab8.js          its D3 code
css/style.css         shared styles (referenced as ../css/style.css)
```

Data the page reads from ../data:

```
bulletin_passages.csv     raw passage count for the corpus stats
lab8_embedding_map.csv    text, hierarchy, topic, and x/y for every passage
lab8_terms_tfidf.csv      most distinctive terms
lab8_neighbors.json       five nearest neighbours per passage
lab8_topics.csv           topic names and sizes
```

## Reproduce the data

The Python scripts rebuild everything in ../data from the source PDF. Install
the dependencies first:

```
pip install -r requirements.txt
```

Then run the scripts in order (each reads and writes files in ../data):

```
1. extract_passages.py     PDF            -> bulletin_passages.csv
2. clean_corpus.py         passages       -> bulletin_passages_clean.csv
3. embed_passages.py       clean text     -> lab8_embeddings.npy
4. umap_project.py         embeddings     -> lab8_coords.csv
5. cluster_topics.py       embeddings     -> lab8_clusters.csv, lab8_topics.csv
6. compute_neighbors.py    embeddings     -> lab8_neighbors.json
7. analyze_corpus.py       clean text     -> lab8_terms_tfidf.csv, lab8_terms_freq.csv
8. export_map.py           join step 2/4/5-> lab8_embedding_map.csv
```

findings.py is optional and prints the evidence behind the findings section
(topic sizes, cross-section pairs, and where terms such as "credit" occur).

### Method summary

- Embeddings: all-MiniLM-L6-v2 sentence transformer, 384 dimensions, L2 normalised.
- Projection: UMAP (cosine metric, 15 neighbours, min_dist 0.15, random_state 401).
- Clustering: k-means on the 384 dimensional vectors, k = 8, labelled from
  characteristic TF-IDF terms and the passages nearest each cluster centre.

### Environment note

Steps 1-3 and 5-8 use pandas, pymupdf, scikit-learn, and sentence-transformers.
Step 4 needs umap-learn. On Windows ARM64 umap-learn has no native wheel, so it
was run from a separate x64 (emulated) Python; on x86-64 or Linux it installs
directly with the other packages.

## Source

Bulletin of Duke Kunshan University Undergraduate Instruction, version V2021-22,
official DKU admissions file (V2021-22_DKU_UG_Bulletin.pdf). Accessed 25 September 2026.
