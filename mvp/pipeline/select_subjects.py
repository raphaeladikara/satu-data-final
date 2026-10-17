"""Pilih subjek bank kasus dan subjek latih.

Bank kasus: punya mask akut + NIHSS + Rankin, disebar merata pada Rankin 0-6 (seed 42),
sama seperti sampel uji di draf semifinal. Bank kasus tidak pernah ikut pelatihan U-Net.
Subjek latih: semua subjek lain yang punya mask akut tidak kosong.
"""
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2] / "data" / "soop"


def select(n_bank=30, n_train=0, seed=42, min_per_tier=10):
    rng = np.random.default_rng(seed)
    part = pd.read_csv(ROOT / "participants.tsv", sep="\t", na_values="n/a")
    ms = pd.read_csv(ROOT / "mask_stats.csv")
    ms = ms[ms.volume_ml > 0]
    df = part.merge(ms[["participant_id", "volume_ml"]], on="participant_id")
    ok = df.dropna(subset=["nihss", "gs_rankin_6isdeath"])
    groups = {r: g.participant_id.tolist() for r, g in ok.groupby("gs_rankin_6isdeath")}
    bank, r = [], 0
    pools = {k: list(rng.permutation(v)) for k, v in sorted(groups.items())}
    while len(bank) < n_bank:
        k = sorted(pools)[r % len(pools)]
        if pools[k]:
            bank.append(pools[k].pop())
        r += 1
    # lengkapi supaya tiap tingkat kesulitan (tersil D) punya minimal min_per_tier kasus
    q1, q2 = ms.D.quantile([1 / 3, 2 / 3])
    tier = lambda d: "mudah" if d <= q1 else ("sedang" if d <= q2 else "sulit")
    ok = ok.merge(ms[["participant_id", "D"]], on="participant_id").assign(tier=lambda x: x.D.map(tier))
    for t in ("mudah", "sedang", "sulit"):
        have = ok[ok.participant_id.isin(bank) & (ok.tier == t)]
        pool = list(rng.permutation(ok[(ok.tier == t) & ~ok.participant_id.isin(bank)].participant_id))
        bank += pool[:max(0, min_per_tier - len(have))]
    rest = sorted(set(df.participant_id) - set(bank))
    train = list(rng.permutation(rest)[:n_train]) if n_train else []
    return sorted(bank, key=lambda s: int(s[4:])), train


if __name__ == "__main__":
    b, _ = select()
    print(len(b), b)
