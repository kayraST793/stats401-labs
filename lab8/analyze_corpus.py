"""Task 4 - basic corpus analysis of the cleaned bulletin.

Prints the passage-length summary and passages-by-section counts, and writes
two small term tables for the page: the most frequent meaningful terms and
the most distinctive terms by TF-IDF. Contrasting the two previews Task 5
(frequency describes; TF-IDF distinguishes).
"""

import pandas as pd
from sklearn.feature_extraction.text import CountVectorizer, TfidfVectorizer

SRC = "../data/bulletin_passages_clean.csv"

df = pd.read_csv(SRC)
texts = df["text_clean"].tolist()

print("PASSAGE LENGTH (words):")
print(df["word_count"].describe().round(1).to_string())

print("\nPASSAGES BY SECTION (top 15):")
print(df["section"].value_counts().head(15).to_string())

# Extra stop words: ubiquitous bulletin vocabulary that is not discriminating.
extra = {"students", "student", "course", "courses", "credit", "credits",
         "duke", "kunshan", "university", "dku", "will", "may", "also",
         "including", "including", "required", "requirements"}
stop = list(CountVectorizer(stop_words="english").get_stop_words() | extra)

count_vec = CountVectorizer(stop_words=stop, ngram_range=(1, 2), min_df=5)
counts = count_vec.fit_transform(texts)
totals = counts.sum(axis=0).A1
vocab = count_vec.get_feature_names_out()
freq = (
    pd.DataFrame({"term": vocab, "count": totals})
    .sort_values("count", ascending=False)
    .head(20)
    .reset_index(drop=True)
)

tfidf_vec = TfidfVectorizer(stop_words=stop, ngram_range=(1, 2), min_df=5)
tfidf = tfidf_vec.fit_transform(texts)
mean_tfidf = tfidf.mean(axis=0).A1
tvocab = tfidf_vec.get_feature_names_out()
tf = (
    pd.DataFrame({"term": tvocab, "score": mean_tfidf})
    .sort_values("score", ascending=False)
    .head(20)
    .reset_index(drop=True)
)

freq.to_csv("../data/lab8_terms_freq.csv", index=False)
tf["score"] = tf["score"].round(5)
tf.to_csv("../data/lab8_terms_tfidf.csv", index=False)

print("\nTOP FREQUENT TERMS:")
print(", ".join(freq["term"].head(12)))
print("\nTOP TF-IDF TERMS:")
print(", ".join(tf["term"].head(12)))
