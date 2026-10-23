"""Modul penilaian otomatis: segmentasi mahasiswa P dibandingkan kunci jawaban G (lesion mask ahli).

Empat metrik (Subbab III.E): Dice, recall per lesi, galat volume relatif, HD95.
Keempatnya dipetakan ke lima jenis kesalahan dengan aturan keputusan transparan berambang.
"""
import math

import numpy as np

from .lesion import foci, voxel_ml
from .ndi import erode26, nearest_dist

ERROR_TYPES = {
    "hampir_benar": "Hampir benar",
    "terlalu_luas": "Terlalu luas (ikut menandai tepi/edema)",
    "terlalu_sempit": "Terlalu sempit (hanya inti lesi)",
    "lesi_terlewat": "Lesi kecil terlewat",
    "salah_lokasi": "Salah lokasi",
    "kosong": "Belum ada anotasi",
}

# Ambang aturan keputusan. Disetel pada anotasi sintetis (pipeline/eval_error_rules.py),
# dikalibrasi ulang setelah ada anotasi mahasiswa sungguhan.
THRESHOLDS = {
    "loc_dice": 0.70,   # Dice rendah ...
    "loc_vol": 0.10,    # ... padahal volume hampir sama (|galat| <= 10%) -> salah lokasi
    "miss_vol": -0.10,  # ada fokus terlewat: volume tidak menyusut ...
    "miss_dice": 0.90,  # ... atau fokus yang ditandai tertutup rapi (Dice fokus tersentuh >= 0,9) -> lesi terlewat,
                        # selain itu terlalu sempit. Syarat kedua ditambahkan 18 Okt: fokus terlewat yang besar
                        # menyusutkan volume, sehingga aturan volume saja melabelinya terlalu sempit
                        # (validasi silang 5 fold, 672 anotasi: akurasi 94,6% -> 97,8%).
    "over_vol": 0.10,   # galat volume > +10% -> terlalu luas
    "under_vol": -0.10, # galat volume < -10% -> terlalu sempit
}

# Batas benar/salah tiap KC untuk BKT (Subbab III.F). Syarat galat volume ditambahkan setelah uji Bab IV menemukan
# 26 dari 33 anotasi terlalu luas lolos dengan Dice + recall saja (uji pertama 18 Okt). Ambang +25% dipilih pada anotasi sintetis seed lain
# (bukan data uji): seluruh anotasi hampir benar tetap lolos (galat maks +22%), anotasi terlalu luas yang lolos 78% -> 7%.
K6_PASS = {"dice": 0.6, "lesion_recall": 1.0, "vol_err_max": 0.25}


def _surface(m):
    return m & ~erode26(m)


def hd95(p, g, spacing):
    """Jarak Hausdorff persentil ke-95 (mm) antara permukaan P dan G."""
    if not p.any() or not g.any():
        return None
    sp, sg = _surface(p), _surface(g)
    d = np.concatenate([nearest_dist(sp, sg, spacing), nearest_dist(sg, sp, spacing)])
    return float(np.percentile(d, 95))


def metrics(p, g, spacing):
    p, g = p > 0, g > 0
    vp, vg = int(p.sum()), int(g.sum())
    inter = int(np.logical_and(p, g).sum())
    # kunci tanpa lesi: Dice 1 hanya bila tandaan juga kosong (dibuat eksplisit, bukan kebetulan pembagian)
    dice = 2 * inter / (vp + vg) if (vp + vg) else 1.0
    labels, fs = foci(g, spacing)
    per_focus = []
    for f in fs:
        comp = labels == f["label"]
        hit = bool(np.logical_and(comp, p).any())
        vox = np.argwhere(comp)
        per_focus.append({"ml": round(f["ml"], 2), "tersentuh": hit,
                          "slice_terbesar": int(np.argmax(np.bincount(vox[:, 2]))) + 1,
                          "pusat_voxel": vox.mean(0).round(1).tolist()})
    recall = sum(f["tersentuh"] for f in per_focus) / len(per_focus) if per_focus else 1.0
    # Dice terhadap fokus yang tersentuh saja: tinggi bila mahasiswa menandai rapi tetapi melewatkan fokus lain
    touched = np.zeros_like(g)
    for f, pf in zip(fs, per_focus):
        if pf["tersentuh"]:
            touched |= labels == f["label"]
    vt = int(touched.sum())
    dice_touched = 2 * int(np.logical_and(p, touched).sum()) / (vp + vt) if (vp + vt) else 1.0
    return {
        "dice": dice,
        "dice_tersentuh": dice_touched,
        "lesion_recall": recall,
        "vol_err": (vp - vg) / vg if vg else 0.0,
        "hd95": hd95(p, g, spacing),
        "precision": inter / vp if vp else 0.0,
        "volume_mahasiswa_ml": vp * voxel_ml(spacing),
        "volume_kunci_ml": vg * voxel_ml(spacing),
        "fokus": per_focus,
    }


def classify(m, t=THRESHOLDS):
    """Aturan keputusan: urutan pemeriksaan dari kesalahan paling mendasar."""
    if m["volume_kunci_ml"] == 0:  # kunci tanpa lesi: tandaan kosong benar, tandaan apa pun terlalu luas
        return "hampir_benar" if m["volume_mahasiswa_ml"] == 0 else "terlalu_luas"
    if m["volume_mahasiswa_ml"] == 0:
        return "kosong"
    if m["dice"] < t["loc_dice"] and abs(m["vol_err"]) <= t["loc_vol"]:
        return "salah_lokasi"
    if m["lesion_recall"] < 1:
        rapi = m.get("dice_tersentuh", 0) >= t.get("miss_dice", 9)
        return "lesi_terlewat" if (m["vol_err"] > t["miss_vol"] or rapi) else "terlalu_sempit"
    if m["vol_err"] > t["over_vol"]:
        return "terlalu_luas"
    if m["vol_err"] < t["under_vol"]:
        return "terlalu_sempit"
    return "hampir_benar"


def grade_delineation(p, g, spacing, t=THRESHOLDS):
    m = metrics(p, g, spacing)
    etype = classify(m, t)
    m["jenis_kesalahan"] = etype
    m["jenis_kesalahan_label"] = ERROR_TYPES[etype]
    if m["volume_kunci_ml"] == 0:
        m["benar"] = m["volume_mahasiswa_ml"] == 0
    else:
        m["benar"] = (m["dice"] >= K6_PASS["dice"] and m["lesion_recall"] >= K6_PASS["lesion_recall"]
                      and m["vol_err"] <= K6_PASS["vol_err_max"])
    for k in ("dice", "dice_tersentuh", "lesion_recall", "vol_err", "precision", "volume_mahasiswa_ml", "volume_kunci_ml"):
        m[k] = round(float(m[k]), 4)
    if m["hd95"] is not None:
        m["hd95"] = round(m["hd95"], 2)
    return m


def grade_point(point, g, tol_vox=1):
    """K2: titik klik (x, y, z voxel, berbasis 0) dianggap benar bila jatuh di lesi (toleransi 1 voxel in-plane)."""
    try:
        if point is None or len(point) != 3 or not all(math.isfinite(float(v)) for v in point):
            return False
        x, y, z = (int(round(float(v))) for v in point)
    except (TypeError, ValueError):
        return False
    # titik di luar volume (termasuk koordinat negatif) tidak pernah dihitung kena, walau toleransi menyentuh tepi
    if not all(0 <= v < s for v, s in zip((x, y, z), g.shape)):
        return False
    xs = slice(max(0, x - tol_vox), x + tol_vox + 1)
    ys = slice(max(0, y - tol_vox), y + tol_vox + 1)
    return bool(g[xs, ys, z].any())


ADC_BINS = [("<0,6", 0, 0.6), ("0,6-0,8", 0.6, 0.8), ("0,8-1,0", 0.8, 1.0), (">1,0", 1.0, 99)]


def adc_bin(v):
    for name, lo, hi in ADC_BINS:
        if lo <= v < hi:
            return name
    return ADC_BINS[-1][0]
