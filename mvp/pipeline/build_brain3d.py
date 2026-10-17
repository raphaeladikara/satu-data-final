"""Aset viewer 3D untuk halaman depan dan modul belajar.

Hanya untuk tiga kasus contoh modul (sub-754, sub-1320, sub-652). Kasus ini sudah dikeluarkan dari
latihan bernilai dan kuncinya memang ditampilkan di modul, jadi mask ahlinya boleh publik.

Keluaran: public/brain3d/<sub>.bin (gzip) = DWI | FLAIR | mask, masing-masing uint8 X*Y*Z (x tercepat),
diperkecil 2x di bidang aksial, dan public/brain3d/index.json berisi dimensi dan spacing.
"""
import gzip
import hashlib
import json
from pathlib import Path

import numpy as np

MVP = Path(__file__).resolve().parents[1]
PUB = MVP / "public" / "cases"
SRV = MVP / "server_data" / "cases"
OUT = MVP / "public" / "brain3d"
CASES = ["sub-754", "sub-1320", "sub-652"]


def seq_id(sub, name):
    return hashlib.sha256(f"sinaps-{sub}-{name}".encode()).hexdigest()[:10]


def load_vol(sub, name, dims):
    raw = gzip.decompress((PUB / sub / f"{seq_id(sub, name)}.bin").read_bytes())
    return np.frombuffer(raw, dtype=np.uint8).reshape(dims, order="F")


def down2(v, how):
    X, Y, Z = v.shape
    v = v[: X // 2 * 2, : Y // 2 * 2].reshape(X // 2, 2, Y // 2, 2, Z)
    return (v.max(axis=(1, 3)) if how == "max" else v.mean(axis=(1, 3))).astype(np.uint8)


def main():
    meta = {c["id"]: c for c in json.loads((PUB / "index.json").read_text())["cases"]}
    OUT.mkdir(parents=True, exist_ok=True)
    index = {}
    for sub in CASES:
        dims = tuple(meta[sub]["dimensions"])
        dwi = down2(load_vol(sub, "DWI", dims), "mean")
        flair = down2(load_vol(sub, "FLAIR", dims), "mean")
        mask = down2(np.load(SRV / f"{sub}.npz")["gt"].astype(np.uint8) * 255, "max")
        raw = b"".join(np.asfortranarray(v).tobytes(order="F") for v in (dwi, flair, mask))
        (OUT / f"{sub}.bin").write_bytes(gzip.compress(raw, compresslevel=9, mtime=0))
        sp = meta[sub]["spacing"]
        index[sub] = {"dimensions": list(dwi.shape), "spacing": [sp[0] * 2, sp[1] * 2, sp[2]]}
        print(sub, dwi.shape, f"{len(raw) / 1e3:.0f} kB mentah")
    (OUT / "index.json").write_text(json.dumps(index, indent=1))


if __name__ == "__main__":
    main()
