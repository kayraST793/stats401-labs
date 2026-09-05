"""
authored by Kayra Seike Tanrikulu

clean_tweets.py: Lab 4 Assignment: Clean & analyze ChatGPT tweets.
STATS 401

Pipeline (mirrors the lab tasks):
  inspect -> clean structured fields -> preprocess text ->
  RoBERTa sentiment -> tidy visualization-ready CSV + weekly aggregate.

Source data: data/lab4_raw_tweets.csv  (1,500 real tweets, see get_tweets.py)
Run from the lab4/ folder:
    python clean_tweets.py
"""

import sys
import pandas as pd

# Emoji-safe printing on the Windows console.
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

pd.set_option("display.max_columns", None)
pd.set_option("display.width", 200)

# ----------------------------------------------------------------------
# Inspect the raw data (Task 1 style)
# ----------------------------------------------------------------------
df = pd.read_csv("../data/lab4_raw_tweets.csv")

print("=== shape ===")
print(df.shape)
print("\n=== dtypes ===")
print(df.dtypes)
print("\n=== missing per column ===")
print(df.isna().sum())
print("\n=== full-row duplicates ===")
print(df.duplicated().sum())
print("\n=== duplicate tweet URLs (same tweet) ===")
print(df.duplicated(subset=["Url"]).sum())
print("\n=== head ===")
print(df.head(3).to_string())

# ----------------------------------------------------------------------
# Missing values (Task 2 logic)
# ----------------------------------------------------------------------
# Only Location is missing (~24%).
# label it "Unknown" and keep the column for now
df["Location"] = df["Location"].fillna("Unknown")

# ----------------------------------------------------------------------
# Duplicates (Task 3 logic)
# ----------------------------------------------------------------------
# Guard against exact duplicates and repeated tweet URLs (same tweet twice).
df = df.drop_duplicates()
df = df.drop_duplicates(subset=["Url"], keep="first")
print("\n=== after de-duplication, shape ===")
print(df.shape)

# ----------------------------------------------------------------------
# Parse dates (Task 5 logic)
# ----------------------------------------------------------------------
# Dates are ISO strings with a UTC offset. Parse to datetime; utc=True keeps
# them tz-aware and consistent. errors="coerce" turns anything odd into NaT.
df["created_at"] = pd.to_datetime(df["Date"], errors="coerce", utc=True)

# Drop any rows whose date failed to parse (need a valid time for the chart).
n_bad = df["created_at"].isna().sum()
print(f"\n=== unparseable dates dropped: {n_bad} ===")
df = df.dropna(subset=["created_at"])

# Derive time attributes. "week" = Monday of that week (a weekly time bucket).
df["date"] = df["created_at"].dt.date
df["weekday"] = df["created_at"].dt.day_name()
df["week"] = df["created_at"].dt.to_period("W").apply(lambda p: p.start_time.date())

# ----------------------------------------------------------------------
# Standardize the tweet text (Task 6 logic)
# ----------------------------------------------------------------------
# Fix HTML entities (&amp; -> &), collapse whitespace/newlines, trim ends.
# Keep this cleaned-but-readable version as tweet_text_raw for sentiment/display.
df["tweet_text"] = (
    df["Tweet"].astype("string")
    .str.replace("&amp;", "&", regex=False)
    .str.replace("&lt;", "<", regex=False)
    .str.replace("&gt;", ">", regex=False)
    .str.replace(r"\s+", " ", regex=True)
    .str.strip()
)
df["tweet_text_raw"] = df["tweet_text"]

# Rename engagement columns to the tidy lowercase names used in the lab (Optional)
df = df.rename(columns={"Likes": "likes", "Retweets": "retweets", "User": "username"})

# ----------------------------------------------------------------------
# Influence tiers from UserFollowers
# ----------------------------------------------------------------------
# UserFollowers is heavily skewed (median ~505, max ~14.7M). Bucketing into
# influence tiers lets us compare the sentiment mix of ordinary voices vs the
# megaphones. Ordered categorical so charts/sorts keep micro -> mid -> macro.
df["UserFollowers"] = pd.to_numeric(df["UserFollowers"], errors="coerce").fillna(0)

TIER_ORDER = ["Micro (<1k)", "Mid (1k-100k)", "Macro (>100k)"]

def follower_tier(n):
    if n < 1_000:
        return TIER_ORDER[0]
    if n < 100_000:
        return TIER_ORDER[1]
    return TIER_ORDER[2]

df["follower_tier"] = pd.Categorical(
    df["UserFollowers"].apply(follower_tier),
    categories=TIER_ORDER,
    ordered=True,
)

print("\n=== influence tier distribution ===")
print(df["follower_tier"].value_counts().reindex(TIER_ORDER).to_string())

print("\n=== cleaned sample ===")
print(df[["created_at", "week", "weekday", "tweet_text_raw", "likes", "retweets"]].head(3).to_string())

# ----------------------------------------------------------------------
# Sentiment analysis with RoBERTa (Tasks 11-12)
# ----------------------------------------------------------------------
# Fine-tuned social-media sentiment model; top_k=None returns all 3 classes.
# These are MODEL-GENERATED estimates, not ground-truth labels.
import re
from transformers import pipeline

sentiment_model = pipeline(
    "sentiment-analysis",
    model="cardiffnlp/twitter-roberta-base-sentiment-latest",
    top_k=None,
)

# Light normalization: keep punctuation/emoji/case; only mask @users and URLs.
def prepare_for_roberta(text):
    text = str(text)
    text = re.sub(r"@\w+", "@user", text)
    text = re.sub(r"https?://\S+|www\.\S+", "http", text)
    return text.strip()

df["sentiment_text"] = df["tweet_text_raw"].fillna("").apply(prepare_for_roberta)

print("\nRunning RoBERTa on", len(df), "tweets (a few minutes on CPU)...")
results = sentiment_model(
    df["sentiment_text"].tolist(),
    truncation=True,
    batch_size=16,
)

def scores_to_dict(scores):
    return {item["label"].lower(): item["score"] for item in scores}

score_dicts = [scores_to_dict(s) for s in results]
df["sentiment_negative"] = [s.get("negative", 0) for s in score_dicts]
df["sentiment_neutral"] = [s.get("neutral", 0) for s in score_dicts]
df["sentiment_positive"] = [s.get("positive", 0) for s in score_dicts]
df["sentiment"] = [max(s, key=s.get).capitalize() for s in score_dicts]
df["sentiment_score"] = df["sentiment_positive"] - df["sentiment_negative"]

# Model confidence = probability of the predicted (winning) class.
df["sentiment_confidence"] = df[
    ["sentiment_negative", "sentiment_neutral", "sentiment_positive"]
].max(axis=1)

print("\n=== sentiment distribution ===")
print(df["sentiment"].value_counts())

# ----------------------------------------------------------------------
# Tidy visualization-ready data (Task 13)
# ----------------------------------------------------------------------
vis_df = df[[
    "created_at", "date", "week", "weekday",
    "username", "UserVerified", "Location",
    "UserFollowers", "follower_tier",
    "tweet_text_raw",
    "likes", "retweets",
    "sentiment_negative", "sentiment_neutral", "sentiment_positive",
    "sentiment_score", "sentiment", "sentiment_confidence",
]].copy()

vis_df.to_csv("../data/lab4_clean_tweets.csv", index=False)
print("\nExported ../data/lab4_clean_tweets.csv  shape:", vis_df.shape)

# ----------------------------------------------------------------------
# Weekly aggregate for the D3 chart (Task 14)
# ----------------------------------------------------------------------
# One row per (week, sentiment) with a count -> stacked bar over time.
weekly = (
    vis_df.groupby(["week", "sentiment"])
    .size()
    .reset_index(name="count")
    .sort_values(["week", "sentiment"])
)
weekly.to_csv("../data/sentiment_by_week.csv", index=False)
print("Exported ../data/sentiment_by_week.csv  shape:", weekly.shape)

print("\n=== weekly sentiment counts ===")
print(weekly.to_string(index=False))

# ----------------------------------------------------------------------
# Weekly average polarity for the D3 chart (uses sentiment_score)
# ----------------------------------------------------------------------
# sentiment_score = P(positive) - P(negative). Its weekly MEAN is the net mood:
# > 0 means the average tweet leaned positive that week, < 0 leaned negative.
# Unlike the count chart, this collapses each week to a single polarity value.
polarity = (
    vis_df.groupby("week")["sentiment_score"]
    .agg(avg_score="mean", n="size")
    .reset_index()
    .sort_values("week")
)
polarity["avg_score"] = polarity["avg_score"].round(4)
polarity.to_csv("../data/polarity_by_week.csv", index=False)
print("Exported ../data/polarity_by_week.csv  shape:", polarity.shape)

# ----------------------------------------------------------------------
# Influence-tier aggregate for the D3 chart
# ----------------------------------------------------------------------
# One row per (tier, sentiment): raw count plus the within-tier share, so the
# chart can show the sentiment MIX per tier (shares comparable across tiers of
# very different sizes).
tier = (
    vis_df.groupby(["follower_tier", "sentiment"], observed=False)
    .size()
    .reset_index(name="count")
)
tier_totals = tier.groupby("follower_tier", observed=False)["count"].transform("sum")
tier["share"] = (tier["count"] / tier_totals).round(4)
tier = tier.sort_values(["follower_tier", "sentiment"])
tier.to_csv("../data/sentiment_by_tier.csv", index=False)
print("Exported ../data/sentiment_by_tier.csv  shape:", tier.shape)

print("\n=== sentiment by influence tier ===")
print(tier.to_string(index=False))

# ----------------------------------------------------------------------
# Model-confidence feed for the D3 histogram (Optional Extension)
# ----------------------------------------------------------------------
# One row per tweet: the winning-class probability plus its predicted label.
# D3 bins these into a histogram so we can see how often RoBERTa is confident
# vs. uncertain before trusting the sentiment attribute in a visualization.
confidence = vis_df[["sentiment", "sentiment_confidence"]].copy()
confidence["sentiment_confidence"] = confidence["sentiment_confidence"].round(4)
confidence.to_csv("../data/sentiment_confidence.csv", index=False)
print("Exported ../data/sentiment_confidence.csv  shape:", confidence.shape)

low = (vis_df["sentiment_confidence"] < 0.50).mean()
print(f"\n=== model confidence ===")
print(f"mean confidence: {vis_df['sentiment_confidence'].mean():.3f}")
print(f"tweets below 0.50 (low confidence): {low * 100:.1f}%")


