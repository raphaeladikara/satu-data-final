"""Uji aturan jenis kesalahan pada anotasi sintetis (pengulangan uji kelayakan Subbab III.E).

Untuk tiap subjek bank: 4 anotasi per jenis kesalahan dengan keparahan acak.
Ambang disetel pada 4/5 subjek (grid search) dan diuji pada 1/5 sisanya, 5 fold tingkat subjek.
Pembanding: nearest-centroid yang hanya melihat Dice, dan aturan lama tanpa syarat Dice fokus tersentuh (miss_dice).

Keluaran: pipeline/results/error_rules.json, error_rules_confusion.csv, thresholds_tuned.json
"""
import itertools
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import ndimage

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
from sinaps.grading import THRESHOLDS, classify, metrics  # noqa: E402
from sinaps.lesion import foci  # noqa: E402

SOOP = HERE.parents[1] / "data" / "soop"
OUT = HERE / "results"
TYPES = ["hampir_benar", "terlalu_luas", "terlalu_sempit", "lesi_terlewat", "salah_lokasi"]
INPLANE = np.zeros((3, 3, 3), bool)
INPLANE[:, :, 1] = ndimage.generate_binary_structure(2, 1)


def synth(g, spacing, kind, rng):
    if kind == "hampir_benar":
        edge = g & ~ndimage.binary_erosion(g, INPLANE)
        ring = ndimage.binary_dilation(g, INPLANE) & ~g
        p = g.copy()
        p[edge & (rng.random(g.shape) < rng.uniform(0.1, 0.3))] = False
        p[ring & (rng.random(g.shape) < rng.uniform(0.1, 0.3))] = True
        return p
    if kind == "terlalu_luas":
        return ndimage.binary_dilation(g, INPLANE, iterations=int(rng.integers(2, 5)))
    if kind == "terlalu_sempit":
        return ndimage.binary_erosion(g, INPLANE, iterations=int(rng.integers(2, 5)))
    if kind == "lesi_terlewat":
        labels, fs = foci(g, spacing)
        if len(fs) < 2:
            return None
        k = int(rng.integers(1, len(fs)))  # hapus k fokus terkecil, fokus terbesar tetap ditandai
        p = g.copy()
        for f in fs[-k:]:
            p[labels == f["label"]] = False
        return p
    if kind == "salah_lokasi":
        ang = rng.uniform(0, 2 * np.pi)
        d = rng.uniform(8, 16)
        return ndimage.shift(g.astype(np.uint8), (d * np.cos(ang), d * np.sin(ang), 0), order=0) > 0
    raise ValueError(kind)


def masks():
    """Mask ahli subjek bank: dari data SOOP lokal bila ada, selain itu dari server_data/ (mask yang sama, tersimpan RLE)."""
    if (SOOP / "bank_subjects.txt").exists():
        import nibabel as nib
        for sub in (SOOP / "bank_subjects.txt").read_text().split():
            img = nib.load(SOOP / "derivatives" / "lesion_masks" / sub / "dwi" /
                           f"{sub}_space-TRACE_desc-lesionAcute_mask.nii.gz")
            yield sub, np.asarray(img.dataobj).squeeze() > 0, img.header.get_zooms()[:3]
    else:
        from sinaps import cases
        for c in cases.all_cases():
            yield c["id"], cases.masks(c["id"])["gt"] > 0, cases.spacing(c["id"])


def build(rng):
    rows = []
    for sub, g, sp in masks():
        for kind in TYPES:
            for rep in range(4):
                p = synth(g, sp, kind, rng)
                if p is None:
                    continue
                m = metrics(p, g, sp)
                m.pop("fokus")
                rows.append({"subject": sub, "kind": kind, **m})
        print(sub, len(rows), flush=True)
    return pd.DataFrame(rows)


GRID = {
    "loc_dice": [0.3, 0.4, 0.5, 0.6, 0.7],
    "loc_vol": [0.1, 0.25, 0.4],
    "miss_vol": [-0.1, -0.15, -0.25, -0.35],
    "miss_dice": [0.8, 0.85, 0.9, 0.95, 9.0],   # 9,0 = syarat Dice fokus tersentuh dimatikan (aturan lama)
    "over_vol": [0.1, 0.15, 0.25],
    "under_vol": [-0.1, -0.15, -0.25],
}


def predict(df, t):
    return df.apply(lambda r: classify(r.to_dict(), t), axis=1)


def tune(df, grid=None):
    grid = grid or GRID
    best, best_acc = None, -1
    recs, kinds = df.to_dict("records"), df.kind.tolist()
    for vals in itertools.product(*grid.values()):
        t = dict(zip(grid, vals))
        acc = np.mean([classify(r, t) == k for r, k in zip(recs, kinds)])
        if acc > best_acc:
            best, best_acc = t, acc
    return best


def dice_only(train, test):
    cents = train.groupby("kind").dice.mean()
    return test.dice.apply(lambda d: (cents - d).abs().idxmin())


def boot(df, col, n=2000, seed=42):
    rng = np.random.default_rng(seed)
    subs = df.subject.unique()
    per = df.groupby("subject")[col].agg(["sum", "count"])
    vals = []
    for _ in range(n):
        s = rng.choice(subs, len(subs))
        vals.append(per.loc[s, "sum"].sum() / per.loc[s, "count"].sum())
    return [float(np.percentile(vals, 2.5)), float(np.percentile(vals, 97.5))]


def main():
    OUT.mkdir(exist_ok=True)
    rng = np.random.default_rng(42)
    df = build(rng)
    df.loc[df.hd95.isna(), "hd95"] = 999
    subs = np.array(sorted(df.subject.unique()))
    folds = np.array_split(np.random.default_rng(42).permutation(subs), 5)
    df["pred_rule"], df["pred_dice"], df["pred_lama"] = "", "", ""
    tuned = []
    # aturan lama (sebelum 18 Okt): fokus terlewat hanya dibedakan lewat galat volume
    lama = {**GRID, "miss_dice": [9.0]}
    for f in folds:
        te = df.subject.isin(f)
        t = tune(df[~te])
        tuned.append(t)
        df.loc[te, "pred_rule"] = predict(df[te], t).values
        df.loc[te, "pred_lama"] = predict(df[te], tune(df[~te], lama)).values
        df.loc[te, "pred_dice"] = dice_only(df[~te], df[te]).values
    df["ok_rule"] = df.pred_rule == df.kind
    df["ok_dice"] = df.pred_dice == df.kind
    df["ok_lama"] = df.pred_lama == df.kind
    final = tune(df)
    res = {
        "n_anotasi": len(df), "n_subjek": len(subs),
        "per_jenis": df.kind.value_counts().to_dict(),
        "akurasi_aturan": float(df.ok_rule.mean()), "ik95_aturan": boot(df, "ok_rule"),
        "akurasi_dice_saja": float(df.ok_dice.mean()), "ik95_dice_saja": boot(df, "ok_dice"),
        "akurasi_aturan_lama": float(df.ok_lama.mean()), "ik95_aturan_lama": boot(df, "ok_lama"),
        "recall_per_jenis_lama": df.groupby("kind").ok_lama.mean().round(3).to_dict(),
        "recall_per_jenis": df.groupby("kind").ok_rule.mean().round(3).to_dict(),
        "median_metrik_per_jenis": df.groupby("kind")[["dice", "lesion_recall", "vol_err", "hd95"]]
        .median().round(3).to_dict(orient="index"),
        "ambang_per_fold": tuned, "ambang_final_semua_data": final, "ambang_dipakai_mvp": THRESHOLDS,
    }
    (OUT / "error_rules.json").write_text(json.dumps(res, indent=2))
    pd.crosstab(df.kind, df.pred_rule).to_csv(OUT / "error_rules_confusion.csv")
    (OUT / "thresholds_tuned.json").write_text(json.dumps(final, indent=2))
    print(json.dumps({k: res[k] for k in ("n_anotasi", "akurasi_aturan", "ik95_aturan", "akurasi_dice_saja",
                                          "ik95_dice_saja", "recall_per_jenis", "ambang_final_semua_data")}, indent=1))


if __name__ == "__main__":
    main()
