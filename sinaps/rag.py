"""Retrieval sederhana (BM25) atas korpus rujukan berbahasa Indonesia di corpus/*.md.

Setiap berkas korpus diawali baris 'sumber: ...'. Potongan dipisah oleh judul '## '.
"""
import math
import re
from functools import lru_cache
from pathlib import Path

CORPUS = Path(__file__).resolve().parents[1] / "corpus"
TOKEN = re.compile(r"[a-z0-9]+")
STOP = set("yang dan di ke dari pada untuk dengan ini itu atau adalah sebagai dalam tidak akan bila oleh juga "
           "lebih karena dapat harus para setiap the of a an to is".split())


def tok(s):
    return [t for t in TOKEN.findall(s.lower()) if t not in STOP and len(t) > 1]


@lru_cache(maxsize=1)
def chunks():
    out = []
    for p in sorted(CORPUS.glob("*.md")):
        if p.name.lower() == "readme.md":
            continue
        text = p.read_text(encoding="utf-8")
        m = re.match(r"sumber:\s*(.+)", text)
        src = m.group(1).strip() if m else p.stem
        for part in re.split(r"\n(?=## )", text):
            if not part.startswith("## "):
                continue
            title, _, body = part[3:].partition("\n")
            out.append({"sumber": src, "judul": title.strip(), "isi": body.strip(), "tok": tok(title + " " + body)})
    return out


def search(query, k=2):
    docs = chunks()
    if not docs:
        return []
    q = tok(query)
    n = len(docs)
    avg = sum(len(d["tok"]) for d in docs) / n
    df = {}
    for d in docs:
        for t in set(d["tok"]):
            df[t] = df.get(t, 0) + 1
    scored = []
    for d in docs:
        s = 0.0
        for t in q:
            f = d["tok"].count(t)
            if not f:
                continue
            idf = math.log(1 + (n - df[t] + 0.5) / (df[t] + 0.5))
            s += idf * f * 2.2 / (f + 1.2 * (0.25 + 0.75 * len(d["tok"]) / avg))
        if s > 0:
            scored.append((s, d))
    scored.sort(key=lambda x: -x[0])
    return [{"sumber": d["sumber"], "judul": d["judul"], "isi": d["isi"]} for _, d in scored[:k]]
