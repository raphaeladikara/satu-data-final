"""Morfologi lesi dari mask biner: volume, fokus bermakna, indeks kesulitan D (persamaan 1)."""
import math

import numpy as np
from scipy import ndimage

MIN_FOCUS_ML = 0.1
# 26-ketetanggaan: dua voxel yang bersentuhan di sudut tetap satu fokus
STRUCT = np.ones((3, 3, 3), dtype=bool)


def voxel_ml(spacing):
    return float(np.prod(spacing)) / 1000.0


def foci(mask, spacing, min_ml=MIN_FOCUS_ML):
    """Label komponen terhubung; kembalikan (labels, daftar fokus bermakna terurut dari terbesar)."""
    labels, n = ndimage.label(mask > 0, structure=STRUCT)
    if n == 0:
        return labels, []
    vml = voxel_ml(spacing)
    sizes = ndimage.sum_labels(np.ones_like(labels), labels, index=np.arange(1, n + 1))
    out = []
    for i, sz in enumerate(sizes, start=1):
        ml = float(sz) * vml
        if ml >= min_ml:
            out.append({"label": i, "voxels": int(sz), "ml": ml})
    out.sort(key=lambda f: -f["ml"])
    return labels, out


def difficulty_index(volume_ml, n_foci):
    """D = -log10 V + log2 F. Lesi makin kecil dan makin tersebar -> D makin besar."""
    v = max(volume_ml, 1e-3)
    f = max(n_foci, 1)
    return -math.log10(v) + math.log2(f)


def volume_category(ml):
    if ml < 1:
        return "sangat kecil (<1 ml)"
    if ml < 5:
        return "kecil (1-5 ml)"
    if ml < 30:
        return "sedang (5-30 ml)"
    return "besar (>=30 ml)"


def stats(mask, spacing):
    _, fs = foci(mask, spacing)
    vol = float((mask > 0).sum()) * voxel_ml(spacing)
    return {
        "volume_ml": vol,
        "n_foci": len(fs),
        "foci_ml": [round(f["ml"], 3) for f in fs],
        "D": difficulty_index(vol, len(fs)) if vol > 0 else None,
    }
