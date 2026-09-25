"""Extract the DKU Undergraduate Bulletin into structured passages.

Task 1 - unit of analysis: one paragraph / short policy block = one passage.
Task 2 - preserve structure: chapter (Part), section, subsection, page.

The PDF ships a 4-level embedded table of contents. Each heading is located
on its start page by matching the outline title to a text block, giving an
ordered list of (page, y) boundaries. Walking the body blocks in reading
order and crossing those boundaries assigns every paragraph the correct
chapter / section / subsection.
"""

import re
import csv
import pymupdf

PDF = "../data/V2021-22_DKU_UG_Bulletin.pdf"
OUT = "../data/bulletin_passages.csv"

BODY_MIN, BODY_MAX = 10.8, 12.6   # point size window for body text
HEADING_MIN = 13.3                # size at/above which a block is a heading
MIN_WORDS = 12                    # a passage must carry enough context


def norm(s):
    s = s.replace("\ufffd", "'")
    return re.sub(r"\s+", " ", s).strip().lower()


def block_info(block):
    """Return (text, dominant_size) for a text block."""
    parts, sizes = [], {}
    for line in block.get("lines", []):
        for span in line["spans"]:
            t = span["text"]
            parts.append(t)
            sizes[round(span["size"], 1)] = sizes.get(round(span["size"], 1), 0) + len(t.strip())
    text = re.sub(r"\s+", " ", "".join(parts)).strip()
    size = max(sizes, key=sizes.get) if sizes else 0.0
    return text, size


def locate(page, title):
    """y-position of the heading on its page, or 0.0 (top) if not found."""
    target = norm(title)[:24]
    best = None
    for block in page.get_text("dict")["blocks"]:
        text, _ = block_info(block)
        if text and norm(text).startswith(target):
            y = block["bbox"][1]
            if best is None or y < best:
                best = y
    return best if best is not None else 0.0


def main():
    doc = pymupdf.open(PDF)
    toc = doc.get_toc()  # [level, title, page(1-based)]

    # Ordered heading boundaries with in-page position.
    boundaries = []
    for lvl, title, page1 in toc:
        pidx = page1 - 1
        if 0 <= pidx < doc.page_count:
            y = locate(doc[pidx], title)
            boundaries.append((pidx, y, lvl, title.strip()))
    boundaries.sort(key=lambda b: (b[0], b[1]))

    toc_titles = {norm(t) for _, t, _ in toc}

    state = {1: "", 2: "", 3: "", 4: ""}
    bi = 0
    rows = []
    pid = 0

    for pidx in range(doc.page_count):
        blocks = doc[pidx].get_text("dict")["blocks"]
        blocks = [b for b in blocks if b.get("lines")]
        blocks.sort(key=lambda b: b["bbox"][1])

        for block in blocks:
            text, size = block_info(block)
            y0 = block["bbox"][1]

            # Cross any boundaries at/above this block.
            while bi < len(boundaries) and (
                boundaries[bi][0] < pidx
                or (boundaries[bi][0] == pidx and boundaries[bi][1] <= y0 + 1)
            ):
                _, _, lvl, title = boundaries[bi]
                state[lvl] = title
                for deeper in range(lvl + 1, 5):
                    state[deeper] = ""
                bi += 1

            if not text:
                continue
            # Skip front matter before Part 1 (cover, contents pages).
            if not state[1]:
                continue
            # Skip headings, page numbers, and outline artifacts.
            if size >= HEADING_MIN:
                continue
            if norm(text) in toc_titles:
                continue
            if re.fullmatch(r"\d{1,4}", text):
                continue
            # Skip table-of-contents / index lines (dotted leaders).
            if re.search(r"\.{6,}", text):
                continue
            if not (BODY_MIN <= size <= BODY_MAX):
                continue
            if len(text.split()) < MIN_WORDS:
                continue

            subsection = state[4] or state[3]
            pid += 1
            rows.append({
                "passage_id": f"p{pid:04d}",
                "chapter": state[1],
                "section": state[2],
                "subsection": subsection,
                "page": pidx + 1,
                "text": text,
            })

    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["passage_id", "chapter", "section", "subsection", "page", "text"])
        w.writeheader()
        w.writerows(rows)

    print("passages:", len(rows))
    print("chapters :", len({r["chapter"] for r in rows if r["chapter"]}))
    print("sections :", len({r["section"] for r in rows if r["section"]}))
    print("pages    :", len({r["page"] for r in rows}))


if __name__ == "__main__":
    main()
