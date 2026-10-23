"""Hitung morfologi semua lesion mask akut SOOP dan batas tersil indeks kesulitan D.

Keluaran: data/soop/mask_stats.csv dan ringkasan (median volume, IQR, % multifokal, tersil D).
"""
import sys
from pathlib import Path

import nibabel as nib
import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sinaps.lesion import stats  # noqa: E402

ROOT = Path(__file__).resolve().parents[1] / "data" / "soop"


def main():
    rows = []
    for p in sorted((ROOT / "derivatives" / "lesion_masks").glob("sub-*/dwi/*lesionAcute_mask.nii.gz")):
        img = nib.load(p)
        m = np.asarray(img.dataobj) > 0
        s = stats(m, img.header.get_zooms()[:3])
        rows.append({"participant_id": p.parts[-3], **s, "foci_ml": None, "shape": "x".join(map(str, m.shape))})
    df = pd.DataFrame(rows)
    df.to_csv(ROOT / "mask_stats.csv", index=False)

    nz = df[df.volume_ml > 0]
    q1, q2 = nz.D.quantile([1 / 3, 2 / 3])
    nz = nz.assign(tier=np.where(nz.D <= q1, "mudah", np.where(nz.D <= q2, "sedang", "sulit")))
    print(f"mask: {len(df)}, tidak kosong: {len(nz)}")
    print(f"median volume {nz.volume_ml.median():.1f} ml (IQR {nz.volume_ml.quantile(.25):.1f}-{nz.volume_ml.quantile(.75):.1f})")
    print(f"<1 ml: {(nz.volume_ml < 1).mean():.0%}, >1 fokus: {(nz.n_foci > 1).mean():.0%}")
    print(f"tersil D: {q1:.3f}, {q2:.3f}")
    print(nz.groupby("tier").agg(n=("D", "size"), vol=("volume_ml", "median"), foci=("n_foci", "median")))
    (ROOT / "d_tertiles.txt").write_text(f"{q1}\n{q2}\n")


if __name__ == "__main__":
    main()
