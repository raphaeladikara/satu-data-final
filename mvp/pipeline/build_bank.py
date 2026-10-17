"""Bangun bank kasus SINAPS dari subjek SOOP terpilih.

Publik (dimuat viewer):   public/cases/<sub>/<seq-id>.bin   volume uint8 ruang DWI, x tercepat
                          public/cases/index.json             metadata geometri + vignette klinis
Server (kunci jawaban):   server_data/cases/<sub>.npz         mask GT (+ prediksi U-Net bila ada)
                          server_data/cases.json              temuan terstruktur + pemetaan sekuens

Nama berkas sekuens diacak supaya jenis sekuens (soal K1) tidak terbaca dari nama berkas.
"""
import gzip
import hashlib
import json
import sys
from pathlib import Path

import nibabel as nib
import numpy as np
import pandas as pd
from nibabel.processing import resample_from_to

HERE = Path(__file__).resolve().parent
MVP = HERE.parent
sys.path.insert(0, str(MVP))
sys.path.insert(0, str(HERE / "kaggle"))
from sinaps.lesion import difficulty_index, foci, volume_category, voxel_ml  # noqa: E402
from train_unet import brain_mask, load3d  # noqa: E402

SOOP = MVP.parent / "data" / "soop"
PUB = MVP / "public" / "cases"
SRV = MVP / "server_data"
PRED = HERE / "kaggle_out" / "pred_bank"
RAS2LPS = np.diag([-1.0, -1.0, 1.0, 1.0])
SEX = {"M": "laki-laki", "F": "perempuan"}


def seq_id(sub, name):
    return hashlib.sha256(f"sinaps-{sub}-{name}".encode()).hexdigest()[:10]


def to_u8(vol, lo, hi):
    return np.clip((vol - lo) / (hi - lo + 1e-6) * 255, 0, 255).astype(np.uint8)


def write_vol(path, u8):
    # urutan x tercepat (indeks = x + y*X + z*X*Y), sesuai scalarData Cornerstone
    raw = np.asfortranarray(u8).tobytes(order="F")
    # citra tidak berubah saat model dilatih ulang; jangan tulis ulang supaya git tidak mencatat 108 berkas biner
    if path.exists() and gzip.decompress(path.read_bytes()) == raw:
        return
    path.write_bytes(gzip.compress(raw, compresslevel=9, mtime=0))


def geometry(img, shape):
    a = RAS2LPS @ img.affine
    sp = np.asarray(img.header.get_zooms()[:3], dtype=float)
    direction = np.concatenate([a[:3, i] / sp[i] for i in range(3)])
    return {"dimensions": list(map(int, shape)), "spacing": sp.round(4).tolist(),
            "origin": a[:3, 3].round(4).tolist(), "direction": direction.round(6).tolist()}


def hemisphere_of(points_vox, affine, center_world_x):
    """RAS: x positif = sisi kanan pasien."""
    xw = (affine @ np.c_[points_vox, np.ones(len(points_vox))].T)[0]
    return "kanan" if xw.mean() > center_world_x else "kiri"


def findings_from_mask(g, spacing, affine, brain, radc):
    labels, fs = foci(g, spacing)
    bc = np.argwhere(brain).mean(0)
    center_x = (affine @ np.r_[bc, 1])[0]
    out = []
    for f in fs:
        vox = np.argwhere(labels == f["label"])
        zc = np.bincount(vox[:, 2])
        out.append({
            "ml": round(f["ml"], 2),
            "hemisfer": hemisphere_of(vox, affine, center_x),
            "slice_terbesar": int(np.argmax(zc)) + 1,
            "rentang_slice": [int(vox[:, 2].min()) + 1, int(vox[:, 2].max()) + 1],
            "pusat_voxel": vox.mean(0).round(1).tolist(),
            "radc_median": round(float(np.median(radc[labels == f["label"]])), 2),
        })
    vol = float(g.sum()) * voxel_ml(spacing)
    sides = {f["hemisfer"] for f in out}
    zc = np.bincount(np.nonzero(g)[2], minlength=g.shape[2])
    radc_all = float(np.median(radc[g > 0])) if g.any() else None
    return {
        "volume_ml": round(vol, 2),
        "kategori_volume": volume_category(vol),
        "jumlah_fokus": len(out),
        "multifokal": len(out) > 1,
        "hemisfer": sides.pop() if len(sides) == 1 else "bilateral",
        "slice_lesi_terbesar": int(np.argmax(zc)) + 1,
        "fokus": out,
        "adc_relatif_lesi": round(radc_all, 2) if radc_all is not None else None,
        "restriksi_sejati": bool(radc_all is not None and radc_all < 0.8),
        "teritori_arteri": "tidak diketahui (registrasi atlas belum tersedia di MVP)",
        "indeks_kesulitan_D": round(difficulty_index(vol, len(out)), 3),
    }


def tier_of(D, q):
    return "mudah" if D <= q[0] else ("sedang" if D <= q[1] else "sulit")


def build_one(sub, part_row, q):
    dimg = nib.load(SOOP / sub / "dwi" / f"{sub}_rec-TRACE_dwi.nii.gz")
    dwi = load3d(dimg)
    adc = load3d(nib.load(SOOP / sub / "dwi" / f"{sub}_rec-ADC_dwi.nii.gz"))
    gimg = nib.load(SOOP / "derivatives" / "lesion_masks" / sub / "dwi" /
                    f"{sub}_space-TRACE_desc-lesionAcute_mask.nii.gz")
    g = (load3d(gimg) > 0).astype(np.uint8)
    assert dwi.shape == adc.shape == g.shape, (sub, dwi.shape, adc.shape, g.shape)
    spacing = dimg.header.get_zooms()[:3]
    affine = dimg.affine
    brain = brain_mask(dwi)

    med = np.median(adc[brain & (adc > 0)])
    radc = adc / med
    target = nib.Nifti1Image(dwi, affine)
    flair_img = nib.load(SOOP / sub / "anat" / f"{sub}_FLAIR.nii.gz")
    flair = np.asarray(resample_from_to(flair_img, target, order=1).dataobj, dtype=np.float32)

    vols = {
        "DWI": to_u8(dwi, 0, np.percentile(dwi[brain], 99.9)),
        # ADC disimpan sebagai ADC relatif x 100 (nilai 80 = 0,80 x median otak)
        "ADC": np.clip(radc * 100, 0, 255).astype(np.uint8),
        "FLAIR": to_u8(flair, 0, np.percentile(flair[brain & (flair > 0)], 99.5) if (flair > 0).any() else 1),
    }
    d = PUB / sub
    d.mkdir(parents=True, exist_ok=True)
    seqs = {}
    for name, u8 in vols.items():
        sid = seq_id(sub, name)
        write_vol(d / f"{sid}.bin", u8)
        seqs[name] = sid

    f = findings_from_mask(g, spacing, affine, brain, radc)
    srv = {"gt": g}
    pred_path = PRED / f"{sub}.npz"
    if pred_path.exists():
        prob = np.load(pred_path)["prob"]
        pm = (prob >= 128).astype(np.uint8) * brain.astype(np.uint8)
        srv["pred"] = pm
        _, pfs = foci(pm, spacing)
        pvol = float(pm.sum()) * voxel_ml(spacing)
        inter = np.logical_and(pm, g).sum()
        f_model = {
            "volume_ml": round(pvol, 2), "jumlah_fokus": len(pfs),
            "dice_terhadap_kunci": round(2 * inter / (pm.sum() + g.sum()), 3),
            "keyakinan_rendah": bool(pvol < 5 or f["volume_ml"] < 5),
        }
    else:
        f_model = None
    np.savez_compressed(SRV / "cases" / f"{sub}.npz", **srv)

    age = part_row.get("age")
    pub = {
        "id": sub, **geometry(dimg, dwi.shape),
        "tier": tier_of(f["indeks_kesulitan_D"], q),
        "D": f["indeks_kesulitan_D"],
        "vignette": {
            "usia": None if pd.isna(age) else str(age),
            "jenis_kelamin": SEX.get(part_row.get("sex"), "tidak tercatat"),
            "nihss": None if pd.isna(part_row.get("nihss")) else int(part_row["nihss"]),
        },
    }
    secret = {
        "id": sub, "sequences": seqs, "findings": f, "model": f_model,
        "luaran": {
            "rankin_pulang": None if pd.isna(part_row.get("gs_rankin_6isdeath")) else int(part_row["gs_rankin_6isdeath"]),
            "etiologi": None if pd.isna(part_row.get("etiology")) else str(part_row["etiology"]),
        },
    }
    return pub, secret


def main():
    (SRV / "cases").mkdir(parents=True, exist_ok=True)
    PUB.mkdir(parents=True, exist_ok=True)
    q = [float(x) for x in (SOOP / "d_tertiles.txt").read_text().split()]
    part = pd.read_csv(SOOP / "participants.tsv", sep="\t", na_values="n/a").set_index("participant_id")
    subs = (SOOP / "bank_subjects.txt").read_text().split()
    pubs, secrets = [], {}
    for sub in subs:
        pub, secret = build_one(sub, part.loc[sub].to_dict(), q)
        pubs.append(pub)
        secrets[sub] = secret
        f = secret["findings"]
        print(f"{sub:9s} {pub['tier']:6s} D={pub['D']:+.2f} {f['volume_ml']:7.2f} ml "
              f"fokus={f['jumlah_fokus']} {f['hemisfer']:9s} rADC={f['adc_relatif_lesi']} "
              f"model={'ya' if secret['model'] else '-'}")
    (PUB / "index.json").write_text(json.dumps({"tertiles_D": q, "cases": pubs}, indent=1))
    (SRV / "cases.json").write_text(json.dumps(secrets, indent=1, ensure_ascii=False))
    print("tingkat:", pd.Series([p["tier"] for p in pubs]).value_counts().to_dict())


if __name__ == "__main__":
    main()
