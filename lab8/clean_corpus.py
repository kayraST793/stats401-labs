"""Task 3 - clean the bulletin corpus.

Reads the raw extracted passages, repairs the font quirk that renders
apostrophes as the replacement character, normalises whitespace, merges
paragraphs that were split across a page break, and drops empty or
duplicate passages. A `text_clean` column is added for the downstream
semantic tasks; the original `text` is kept for display.

Stop words are deliberately NOT removed and no lemmatising is done - that
would strip meaning the sentence embeddings rely on at Task 6.
"""

import re
import pandas as pd

SRC = "../data/bulletin_passages.csv"
OUT = "../data/bulletin_passages_clean.csv"


def fix_chars(s):
    if not isinstance(s, str):
        return s
    return s.replace("\ufffd", "'")


def norm_ws(s):
    return re.sub(r"\s+", " ", s).strip()


def main():
    df = pd.read_csv(SRC)
    raw = len(df)

    # Repair the apostrophe/quote font quirk in every text field.
    for col in ["chapter", "section", "subsection", "text"]:
        df[col] = df[col].map(fix_chars)

    # Drop empty passages and normalise whitespace.
    df = df.dropna(subset=["text"])
    df["text"] = df["text"].map(norm_ws)
    df = df[df["text"].str.len() > 0]
    after_empty = len(df)

    # Merge continuations: a passage that begins lower-case is the tail of
    # the previous paragraph split by a page break. Fold it back in.
    merged = []
    for row in df.to_dict("records"):
        if (
            merged
            and row["text"][:1].islower()
            and row["chapter"] == merged[-1]["chapter"]
            and row["section"] == merged[-1]["section"]
        ):
            merged[-1]["text"] = norm_ws(merged[-1]["text"] + " " + row["text"])
        else:
            merged.append(row)
    df = pd.DataFrame(merged)
    after_merge = len(df)

    # Drop duplicate passages (recurring boilerplate).
    df = df.drop_duplicates(subset=["text"]).reset_index(drop=True)
    after_dedup = len(df)

    # Re-number passage ids so they stay contiguous, add clean text + length.
    df["passage_id"] = [f"p{i + 1:04d}" for i in range(len(df))]
    df["text_clean"] = df["text"].map(norm_ws)
    df["word_count"] = df["text_clean"].str.split().str.len()

    df = df[["passage_id", "chapter", "section", "subsection", "page",
             "text", "text_clean", "word_count"]]
    df.to_csv(OUT, index=False)

    print("raw passages        :", raw)
    print("after drop-empty    :", after_empty)
    print("after merge-splits  :", after_merge, f"(merged {after_empty - after_merge})")
    print("after drop-duplicate:", after_dedup, f"(removed {after_merge - after_dedup})")
    print("final passages      :", len(df))
    print("avg words / passage :", round(df["word_count"].mean(), 1))
    print("median words        :", int(df["word_count"].median()))
    print("replacement chars    :", int(df["text_clean"].str.contains("\ufffd").sum()))


if __name__ == "__main__":
    main()
