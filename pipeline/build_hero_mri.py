"""Citra 'patung' untuk hero partikel di halaman depan.

Irisan aksial FLAIR kasus contoh sub-754 digambar seperti tinta di atas kertas: sinyal terang menjadi teal tua,
latar transparan, dan lesi dari mask ahli diberi warna terakota. Kasus ini kasus contoh modul (kuncinya memang publik).

Keluaran: public/hero/mri-strip.webp (lebar, 5 irisan berkipas) dan public/hero/mri-portrait.webp (1 irisan, untuk ponsel).
Jalankan dengan Python yang punya numpy, scipy, dan Pillow:  py pipeline/build_hero_mri.py
"""
import gzip
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

MVP = Path(__file__).resolve().parents[1]
PUB = MVP / "public" / "cases"
SRV = MVP / "server_data" / "cases"
OUT = MVP / "public" / "hero"
SUB = "sub-754"

INK_LO = np.array([128, 168, 116]) / 255  # sage untuk sinyal lemah
INK_HI = np.array([10, 38, 44]) / 255  # teal-900 untuk sinyal kuat
LESION = np.array([214, 104, 62]) / 255  # terakota menyala


def seq_id(sub, name):
    """Nama berkas sekuens: ambil dari server_data/cases.json (berkas acak, bukan hash nama sekuens)."""
    return json.loads((MVP / "server_data" / "cases.json").read_text(encoding="utf-8"))[sub]["sequences"][name]


def load_vol(sub, name, dims):
    raw = gzip.decompress((PUB / sub / f"{seq_id(sub, name)}.bin").read_bytes())
    return np.frombuffer(raw, dtype=np.uint8).reshape(dims, order="F").astype(np.float32) / 255


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def brain_mask(img):
    """Otak saja: buang noise latar dan cincin kulit kepala (dipisah tulang tengkorak yang gelap)."""
    m = img > np.percentile(img[img > 0.02], 20) if (img > 0.02).any() else img > 1
    m = ndimage.binary_opening(m, iterations=4)
    lab, n = ndimage.label(m)
    if n:
        sizes = ndimage.sum(m, lab, range(1, n + 1))
        m = lab == (int(np.argmax(sizes)) + 1)
    m = ndimage.binary_fill_holes(ndimage.binary_dilation(m, iterations=3))
    m = ndimage.binary_erosion(m, iterations=1)
    return ndimage.gaussian_filter(m.astype(np.float32), 1.6)


def render_slice(img, mask, px):
    """Satu irisan -> RGBA float, sisi px. Citra diputar agar anterior di atas (konvensi radiologi)."""
    bm = brain_mask(img)
    img, mask, bm = np.rot90(img), np.rot90(mask), np.rot90(bm)
    z = px / img.shape[0]
    img = np.clip(ndimage.zoom(img, z, order=3), 0, 1)
    mask = np.clip(ndimage.zoom(ndimage.gaussian_filter(mask, 0.8), z, order=3), 0, 1)
    bm = np.clip(ndimage.zoom(bm, z, order=3), 0, 1)
    inside = img[bm > 0.5]
    lo, hi = np.percentile(inside, [4, 99.6])
    t = np.clip((img - lo) / (hi - lo + 1e-6), 0, 1)
    rgb = INK_LO + (INK_HI - INK_LO) * (t[..., None] ** 1.35)
    a = smoothstep(0.42, 0.58, bm) * (0.28 + 0.7 * smoothstep(0.02, 0.75, t))
    m = ndimage.gaussian_filter(mask, px / 260)
    glow = ndimage.gaussian_filter(mask, px / 70) * 0.6
    lm = np.clip(np.maximum(smoothstep(0.2, 0.65, m) * 0.92, glow), 0, 1)[..., None]
    rgb = rgb * (1 - lm) + LESION * (1.12 - 0.3 * t[..., None]) * lm
    a = np.maximum(a, lm[..., 0] * 0.95)
    return np.dstack([rgb, a])


def over(dst, src, x, y, fade):
    """Tempel src (RGBA float) ke dst di (x, y) dengan alpha 'over'."""
    h, w = src.shape[:2]
    d = dst[y : y + h, x : x + w]
    sa = src[..., 3:4] * fade
    d[..., :3] = src[..., :3] * sa + d[..., :3] * (1 - sa)
    d[..., 3:4] = sa + d[..., 3:4] * (1 - sa)


def save(arr, path):
    rgb = arr[..., :3] / np.maximum(arr[..., 3:4], 1e-6)  # un-premultiply
    out = np.dstack([np.clip(rgb, 0, 1), arr[..., 3:4]])
    Image.fromarray((out * 255 + 0.5).astype(np.uint8), "RGBA").save(path, "WEBP", quality=88, method=6)
    print(path.relative_to(MVP), arr.shape[1], "x", arr.shape[0], f"{path.stat().st_size / 1e3:.0f} kB")


def main():
    meta = {c["id"]: c for c in json.loads((PUB / "index.json").read_text())["cases"]}
    dims = tuple(meta[SUB]["dimensions"])
    flair = load_vol(SUB, "FLAIR", dims)
    mask = np.load(SRV / f"{SUB}.npz")["gt"].astype(np.float32)
    peak = int(mask.sum(axis=(0, 1)).argmax())
    OUT.mkdir(parents=True, exist_ok=True)

    # lima irisan berkipas: tengah = irisan lesi terbesar, makin ke tepi makin kecil dan pudar
    offs = [-2, -1, 0, 2, 4]
    scale = {0: 1.0, 1: 0.8, 2: 0.62}
    fade = {0: 1.0, 1: 0.82, 2: 0.6}
    base = 900
    H = base + 40
    gap = 0.66  # jarak antar pusat relatif terhadap lebar irisan tengah
    W = int(base * (1 + 2 * gap * 0.92 + 2 * gap * 0.74)) + 40
    canvas = np.zeros((H, W, 4), np.float32)
    cx = W // 2
    xs = {0: cx, 1: base * gap * 0.92, 2: base * gap * (0.92 + 0.74)}
    order = sorted(range(5), key=lambda i: -abs(offs[i]))  # gambar tepi dulu, tengah terakhir
    for i in order:
        k = abs(i - 2)
        z = int(np.clip(peak + offs[i], 0, dims[2] - 1))
        px = int(base * scale[k])
        s = render_slice(flair[:, :, z], mask[:, :, z], px)
        x = int(cx + np.sign(i - 2) * (xs[k] if k else 0) - px / 2)
        y = int(H / 2 - px / 2)
        over(canvas, s, x, y, fade[k])
    ys, xs_ = np.where(canvas[..., 3] > 0.01)
    canvas = canvas[max(0, ys.min() - 8) : ys.max() + 8, max(0, xs_.min() - 8) : xs_.max() + 8]
    save(canvas, OUT / "mri-strip.webp")

    one = render_slice(flair[:, :, peak], mask[:, :, peak], 900)
    ys, xs_ = np.where(one[..., 3] > 0.01)
    save(one[ys.min() : ys.max() + 1, xs_.min() : xs_.max() + 1], OUT / "mri-portrait.webp")


if __name__ == "__main__":
    main()
