"""
clean_tweets_tasks.py — Lab 4: Cleaning Web Data for Visualization
STATS 401 — TASK PRACTICE ARCHIVE (Tasks 1–14 on the 50-row toy dataset).

Kept for revision. The assignment uses a separate, clean script.
Run from the lab4/ folder so ../data/lab4_dirty_tweets.csv resolves.
"""

import sys
import pandas as pd

# Force UTF-8 stdout so emoji in tweets don't crash printing on the
# Windows cp1252 console (e.g. 😊 / 😡 in tweet_text_raw).
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

pd.set_option("display.max_columns", None)
pd.set_option("display.width", 200)

# ----------------------------------------------------------------------
# Task 1 — Inspect the Raw Data
# ----------------------------------------------------------------------
df = pd.read_csv("../data/lab4_dirty_tweets.csv")

print("=== head ===")
print(df.head())

print("\n=== shape ===")
print(df.shape)

print("\n=== info ===")
print(df.info())

print("\n=== describe (all) ===")
print(df.describe(include="all"))

# ----------------------------------------------------------------------
# Task 2 — Missing Values
# ----------------------------------------------------------------------
print("\n=== Task 2: missing count per column ===")
print(df.isna().sum())

print("\n=== rows with any missing value ===")
# isna() -> True/False grid; .any(axis=1) -> True for a row if ANY column is
# missing; df[...] keeps only those rows. So: show rows that have a missing value.
print(df[df.isna().any(axis=1)])

# A missing tweet cannot be text-analyzed -> drop those rows.
df = df.dropna(subset=["tweet_text"])

# A missing retweet count is meaningful as "none observed" -> fill with 0.
# (Only fill after we know the column is numeric; retweets is already int64
#  here, but we keep this to mirror the lab's intent.)
df["retweets"] = df["retweets"].fillna(0)

print("\n=== after dropping missing tweet_text, shape ===")
print(df.shape)

# ----------------------------------------------------------------------
# Task 3 — Duplicates
# ----------------------------------------------------------------------
# Step 1: exact full-row duplicates (every column identical).
print("\n=== Task 3: full-row duplicate count ===")
print(df.duplicated().sum())

print("\n=== all rows involved in a full-row duplicate (keep=False shows both) ===")
print(df[df.duplicated(keep=False)])

df = df.drop_duplicates()

# Step 2: same tweet_id even if other columns differ (a re-used ID is suspect).
print("\n=== rows sharing a duplicate tweet_id ===")
print(df[df.duplicated(subset=["tweet_id"], keep=False)])

# Keep the first occurrence of each tweet_id, drop the rest.
df = df.drop_duplicates(subset=["tweet_id"], keep="first")

print("\n=== after de-duplication, shape ===")
print(df.shape)

# ----------------------------------------------------------------------
# Task 4 — Incorrect Data Types
# ----------------------------------------------------------------------
# likes is stored as strings containing junk like "unknown" and "1,200".
# Step 1: strip thousands separators so "1,200" -> "1200".
df["likes"] = (
    df["likes"].astype(str)
    .str.replace(",", "", regex=False)  # regex=False: treat the comma as a literal character, not as a regex pattern.
)

# Step 2: coerce to numeric; anything non-numeric ("unknown") becomes NaN.
df["likes"] = pd.to_numeric(df["likes"], errors="coerce")

# retweets: coerce to numeric as well (safety), then flag impossible values.
df["retweets"] = pd.to_numeric(df["retweets"], errors="coerce")

# A negative retweet count is impossible -> mark it missing so we can decide.
df.loc[df["retweets"] < 0, "retweets"] = pd.NA

print("\n=== Task 4: NaNs introduced by coercion ===")
print(df[["likes", "retweets"]].isna().sum())

# Documented treatment choices:
#   likes    -> fill missing with the column MEDIAN (robust to outliers).
#   retweets -> fill missing with 0 ("none observed").
df["likes"] = df["likes"].fillna(df["likes"].median())
df["retweets"] = df["retweets"].fillna(0)

# Cast to clean integer types now that there are no NaNs.
# Why the columns are float here: pandas int64 cannot hold NaN, so when
# pd.to_numeric(..., errors="coerce") turned "unknown"/-5 into NaN, the whole
# column became float64. fillna() replaced the NaNs but did NOT shrink the type
# back, so likes/retweets still print as 208.0 etc. astype(int) is now safe
# (no NaN left) and gives tidy whole numbers for display and CSV export.
df["likes"] = df["likes"].astype(int)
df["retweets"] = df["retweets"].astype(int)

print("\n=== dtypes after Task 4 ===")
print(df[["likes", "retweets"]].dtypes)
print("\n=== likes/retweets summary ===")
print(df[["likes", "retweets"]].describe())

# ----------------------------------------------------------------------
# Task 5 — Parse Dates
# ----------------------------------------------------------------------
# created_at holds several formats: "2026/8/1 08:00", "Aug 3 2026",
# "08/04/2026 12:10", and even "not-a-date". format="mixed" lets pandas infer
# each row's format; errors="coerce" turns anything unparseable into NaT.
df["created_at"] = pd.to_datetime(
    df["created_at"],
    errors="coerce",
    format="mixed",
)

print("\n=== Task 5: rows where the date could not be parsed (NaT) ===")
print(df[df["created_at"].isna()])

# We need valid timestamps for time-based visualization -> drop unparseable rows.
df = df.dropna(subset=["created_at"])

# Derive useful time attributes for later grouping/plotting.
df["date"] = df["created_at"].dt.date
df["hour"] = df["created_at"].dt.hour
df["weekday"] = df["created_at"].dt.day_name()

print("\n=== after date parsing, shape ===")
print(df.shape)
print("\n=== sample of derived date fields ===")
print(df[["created_at", "date", "hour", "weekday"]].head())

# ----------------------------------------------------------------------
# Task 6 — Standardize Categories and Strings
# ----------------------------------------------------------------------
# Platform: "Web"/"web"/"WEB" etc. are the same concept. Lower-case first,
# then map to a single canonical label.
df["platform"] = (
    df["platform"].astype("string")
    .str.strip()
    .str.lower()
)

platform_map = {
    "web": "Web",
    "mobile": "Mobile",
    "ios": "iOS",
    "android": "Android",
}
df["platform"] = df["platform"].map(platform_map)

# Country: many spellings for the same country -> one canonical name.
country_map = {
    "US": "United States", "USA": "United States",
    "United States": "United States", "us": "United States",
    "U.S.": "United States",
    "UK": "United Kingdom", "uk": "United Kingdom",
    "United Kingdom": "United Kingdom",
    "Canada": "Canada", "CA": "Canada",
}
df["country"] = df["country"].map(country_map)

# Username: strip spaces, drop a leading "@", lower-case for consistency.
df["username"] = (
    df["username"].astype("string")
    .str.strip()
    .str.replace(r"^@", "", regex=True)
    .str.lower()
)

# Tweet text: collapse runs of whitespace to a single space and trim ends.
df["tweet_text"] = (
    df["tweet_text"].astype("string")
    .str.replace(r"\s+", " ", regex=True)
    .str.strip()
)

# Keep an untouched copy of the cleaned-but-unprocessed text. TF-IDF will
# aggressively preprocess a working copy, but sentiment (Part B) wants this
# richer original (punctuation/emoji/case carry sentiment signal).
df["tweet_text_raw"] = df["tweet_text"]

# NOTE: The lab also standardizes a "sentiment_raw" column, but this dataset
# does NOT contain that column, so we skip it. We compute sentiment directly
# from the tweet text later using RoBERTa (Part B).

print("\n=== Task 6: standardized category value counts ===")
print("platform:\n", df["platform"].value_counts(dropna=False), sep="")
print("\ncountry:\n", df["country"].value_counts(dropna=False), sep="")
print("\n=== sample usernames / text ===")
print(df[["username", "tweet_text"]].head())

# ======================================================================
# Part A — TF-IDF
# ======================================================================

# ----------------------------------------------------------------------
# Task 7 — Tweet Preprocessing (normalize -> tokenize -> stopwords -> lemmatize)
# ----------------------------------------------------------------------
import re
import nltk
from nltk.tokenize import word_tokenize
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer

# Ensure required NLTK data is present (quiet=True keeps it silent when cached).
for _pkg in ["punkt", "punkt_tab", "stopwords", "wordnet", "omw-1.4"]:
    nltk.download(_pkg, quiet=True)

# 7.1 Normalization: lower-case and replace URLs, @mentions, and numbers with
# placeholder tokens so specific values don't fragment the vocabulary.
def normalize_tweet(text):
    text = text.lower()
    text = re.sub(r"https?://\S+|www\.\S+", " URL ", text)
    text = re.sub(r"@\w+", " USER ", text)
    text = re.sub(r"\b\d+(?:\.\d+)?\b", " NUMBER ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()

df["text_normalized"] = df["tweet_text"].apply(normalize_tweet)

# 7.2 Tokenization: split each normalized tweet into word tokens.
df["tokens"] = df["text_normalized"].apply(word_tokenize)

# 7.3 Stop-word removal: drop common low-information words (the, to, my, ...).
stop_words = set(stopwords.words("english"))

def remove_stopwords(tokens):
    return [t for t in tokens if t not in stop_words]

df["tokens_no_stop"] = df["tokens"].apply(remove_stopwords)

# 7.4 Lemmatization: reduce words to base forms; keep only alphabetic tokens
# (this also drops leftover punctuation and the URL/USER/NUMBER placeholders,
# since those are upper-cased -> after lower() in normalize they are lowercase,
# but isalpha() keeps them; note they remain as words like "url"/"user"/"number").
lemmatizer = WordNetLemmatizer()

def lemmatize_tokens(tokens):
    return [lemmatizer.lemmatize(t) for t in tokens if t.isalpha()]

df["tokens_clean"] = df["tokens_no_stop"].apply(lemmatize_tokens)
df["text_clean"] = df["tokens_clean"].apply(" ".join)

print("\n=== Task 7: raw vs cleaned text ===")
print(df[["tweet_text_raw", "text_clean"]].head(8).to_string())

# ----------------------------------------------------------------------
# Task 8 — Prune the Vocabulary
# ----------------------------------------------------------------------
# Drop very rare terms (noise) and near-ubiquitous terms (no discrimination).
#   min_df=2    -> keep a term only if it appears in at least 2 tweets
#   max_df=0.90 -> drop a term if it appears in more than 90% of tweets
from sklearn.feature_extraction.text import CountVectorizer

vectorizer = CountVectorizer(min_df=2, max_df=0.90, lowercase=True)
dtm = vectorizer.fit_transform(df["text_clean"])
terms = vectorizer.get_feature_names_out()

print("\n=== Task 8: pruned vocabulary ===")
print(terms)
print("Vocabulary size:", len(terms))

# ----------------------------------------------------------------------
# Task 9 — Create a Document-Term Matrix (DTM)
# ----------------------------------------------------------------------
# The DTM from Task 8: rows = tweets, columns = terms, values = term counts.
print("\n=== Task 9: DTM shape (tweets x terms) ===")
print(dtm.shape)

# Convert the sparse matrix to a dense DataFrame just to inspect it.
# (For large corpora keep it sparse; a dense table would be huge.)
dtm_df = pd.DataFrame(
    dtm.toarray(),
    columns=vectorizer.get_feature_names_out(),
)

print("\n=== DTM preview (first 5 tweets, first 12 terms) ===")
print(dtm_df.iloc[:5, :12])

# ----------------------------------------------------------------------
# Task 10 — TF-IDF
# ----------------------------------------------------------------------
# TF-IDF = term frequency (within a tweet) x inverse document frequency
# (across all tweets). High score => term is important TO THAT tweet because
# it is frequent there but rare elsewhere.
from sklearn.feature_extraction.text import TfidfVectorizer

tfidf_vectorizer = TfidfVectorizer(min_df=2, max_df=0.90)
tfidf = tfidf_vectorizer.fit_transform(df["text_clean"])

print("\n=== Task 10: TF-IDF shape ===")
print(tfidf.shape)

tfidf_df = pd.DataFrame(
    tfidf.toarray(),
    columns=tfidf_vectorizer.get_feature_names_out(),
)

print("\n=== TF-IDF preview (first 5 tweets, first 12 terms) ===")
print(tfidf_df.iloc[:5, :12].round(3))

# Show the top-scoring term for the first few tweets (its characteristic word).
print("\n=== most characteristic term per tweet (first 8) ===")
for i in range(8):
    row = tfidf_df.iloc[i]
    top_term = row.idxmax()
    print(f"tweet {i}: '{top_term}' ({row[top_term]:.3f})  <- {df['tweet_text_raw'].iloc[i]}")

# ======================================================================
# Part B — Sentiment Analysis (RoBERTa)
# ======================================================================

# ----------------------------------------------------------------------
# Task 11 — Load the RoBERTa sentiment model and test one tweet
# ----------------------------------------------------------------------
# cardiffnlp/twitter-roberta-base-sentiment-latest is a RoBERTa model
# fine-tuned on social-media text. top_k=None returns scores for ALL three
# classes (negative/neutral/positive), not just the winner.
from transformers import pipeline

sentiment_model = pipeline(
    "sentiment-analysis",
    model="cardiffnlp/twitter-roberta-base-sentiment-latest",
    top_k=None,
)

print("\n=== Task 11: single-tweet test ===")
test_tweet = "I absolutely love this new update!"
result = sentiment_model(test_tweet)
print(result)

# ----------------------------------------------------------------------
# Task 12 — Apply RoBERTa Sentiment Analysis to the Tweets
# ----------------------------------------------------------------------
# 12.1 Light normalization: for sentiment we KEEP punctuation, emoji, case, and
# negation (they carry sentiment). We only mask @mentions and URLs, starting
# from tweet_text_raw rather than the aggressively cleaned text_clean.
def prepare_for_roberta(text):
    text = str(text)
    text = re.sub(r"@\w+", "@user", text)
    text = re.sub(r"https?://\S+|www\.\S+", "http", text)
    return text.strip()

df["sentiment_text"] = df["tweet_text_raw"].fillna("").apply(prepare_for_roberta)

# 12.2 Analyze all tweets in batches.
results = sentiment_model(
    df["sentiment_text"].tolist(),
    truncation=True,
    batch_size=16,
)

# 12.3 Turn each tweet's list of {label, score} into a dict, then columns.
def scores_to_dict(scores):
    return {item["label"].lower(): item["score"] for item in scores}

score_dicts = [scores_to_dict(s) for s in results]

df["sentiment_negative"] = [s.get("negative", 0) for s in score_dicts]
df["sentiment_neutral"] = [s.get("neutral", 0) for s in score_dicts]
df["sentiment_positive"] = [s.get("positive", 0) for s in score_dicts]

# Predicted label = the class with the highest probability.
def predicted_label(scores):
    return max(scores, key=scores.get).capitalize()  # key whose value is largest

df["sentiment"] = [predicted_label(s) for s in score_dicts]

# 12.4 Continuous score in [-1, 1]: P(positive) - P(negative).
df["sentiment_score"] = df["sentiment_positive"] - df["sentiment_negative"]

print("\n=== Task 12: sentiment per tweet (first 10) ===")
print(
    df[[
        "tweet_text_raw",
        "sentiment_negative",
        "sentiment_neutral",
        "sentiment_positive",
        "sentiment",
        "sentiment_score",
    ]].head(10).round(3).to_string()
)

print("\n=== sentiment label distribution ===")
print(df["sentiment"].value_counts())

# ----------------------------------------------------------------------
# Task 13 — Create Tidy Visualization-Ready Data
# ----------------------------------------------------------------------
# Keep useful original variables plus the derived ones D3 will need.
vis_df = df[[
    "tweet_id",
    "created_at",
    "date",
    "hour",
    "weekday",
    "username",
    "platform",
    "country",
    "tweet_text_raw",
    "text_clean",
    "likes",
    "retweets",
    "sentiment_score",
    "sentiment",
]].copy()

print("\n=== Task 13: vis_df preview ===")
print(vis_df.head())
print("\n=== vis_df info ===")
print(vis_df.info())
print("\n=== vis_df missing values ===")
print(vis_df.isna().sum())
print("\n=== sentiment counts ===")
print(vis_df["sentiment"].value_counts())

# Export the tidy dataset for D3.
vis_df.to_csv("../data/lab4_clean_tweets_tasks.csv", index=False)
print("\nExported ../data/lab4_clean_tweets_tasks.csv")

# ----------------------------------------------------------------------
# Task 14 — Aggregate Data for Visualization
# ----------------------------------------------------------------------
# Aggregates give "one row per category/group" instead of one row per tweet,
# which is what many D3 charts (bar, grouped bar, line) consume directly.

# 14.1 Overall sentiment counts.
sentiment_counts = (
    vis_df["sentiment"]
    .value_counts()
    .rename_axis("sentiment")
    .reset_index(name="count")
)
sentiment_counts.to_csv("../data/sentiment_counts_tasks.csv", index=False)

# 14.2 Sentiment counts broken down by platform (grouped-bar friendly).
sentiment_platform = (
    vis_df
    .groupby(["platform", "sentiment"])
    .size()
    .reset_index(name="count")
)
sentiment_platform.to_csv("../data/sentiment_by_platform_tasks.csv", index=False)

# 14.3 Average sentiment score by weekday (line/trend friendly).
sentiment_time = (
    vis_df
    .groupby("weekday")["sentiment_score"]
    .mean()
    .reset_index()
)
sentiment_time.to_csv("../data/sentiment_by_weekday_tasks.csv", index=False)

print("\n=== Task 14: sentiment_counts ===")
print(sentiment_counts)
print("\n=== sentiment_by_platform ===")
print(sentiment_platform)
print("\n=== sentiment_by_weekday ===")
print(sentiment_time.round(3))
print("\nExported 3 aggregate CSVs to ../data/")
