"""Pengganti numpy murni untuk fungsi scipy.ndimage yang dipakai API.

scipy (114 MB) membuat fungsi Python Vercel melewati batas 225 MB. Hasilnya dicocokkan dengan
scipy pada 36 kasus bank (pipeline lokal tetap memakai scipy).
"""
import itertools

import numpy as np

# 13 offset "maju" dari 26 tetangga; pasangan mundurnya tercakup lewat sisi lain sisi graf
_FWD = [o for o in itertools.product((-1, 0, 1), repeat=3) if o > (0, 0, 0)]


def label26(mask):
    """Komponen terhubung 26-ketetanggaan. Nomor label urut raster seperti ndimage.label."""
    mask = np.asarray(mask, dtype=bool)
    shape = mask.shape
    fg = np.flatnonzero(mask)
    labels = np.zeros(shape, dtype=np.int32)
    if fg.size == 0:
        return labels, 0
    idx = np.full(mask.size, -1, dtype=np.int64)
    idx[fg] = np.arange(fg.size)
    coords = np.unravel_index(fg, shape)
    a_all, b_all = [], []
    for off in _FWD:
        nb = [c + o for c, o in zip(coords, off)]
        ok = np.ones(fg.size, dtype=bool)
        for c, n in zip(nb, shape):
            ok &= (c >= 0) & (c < n)
        j = idx[np.ravel_multi_index([c[ok] for c in nb], shape)]
        keep = j >= 0
        a_all.append(np.flatnonzero(ok)[keep])
        b_all.append(j[keep])
    a, b = np.concatenate(a_all), np.concatenate(b_all)
    # sisi dua arah, diurutkan sekali per simpul supaya min per simpul bisa pakai reduceat
    node, nb = np.concatenate([a, b]), np.concatenate([b, a])
    order = np.argsort(node, kind="stable")
    node, nb = node[order], nb[order]
    uniq_node, starts = np.unique(node, return_index=True)
    # propagasi label minimum + lompatan pointer sampai stabil
    root = np.arange(fg.size)
    while True:
        new = root.copy()
        if len(nb):
            new[uniq_node] = np.minimum(root[uniq_node], np.minimum.reduceat(root[nb], starts))
        new = new[new]
        if np.array_equal(new, root):
            break
        root = new
    # akar = voxel pertama komponen dalam urutan raster -> urutan label sama dengan scipy
    uniq, lab = np.unique(root, return_inverse=True)
    labels.flat[fg] = lab + 1
    return labels, len(uniq)


def sum_ones(labels, n):
    """Ukuran tiap label 1..n (pengganti ndimage.sum_labels(np.ones_like(labels), labels, 1..n))."""
    return np.bincount(labels.ravel(), minlength=n + 1)[1:n + 1]


def erode26(m):
    """Erosi biner dengan struktur 3x3x3, tepi dianggap 0."""
    p = np.pad(np.asarray(m, dtype=bool), 1)
    out = np.ones(m.shape, dtype=bool)
    X, Y, Z = m.shape
    for dx, dy, dz in itertools.product(range(3), repeat=3):
        out &= p[dx:dx + X, dy:dy + Y, dz:dz + Z]
    return out


def _pairwise(src, dst, spacing, chunk=1024):
    """Brute force: murah bila jumlah voxel src x dst kecil walau tersebar."""
    sp = np.asarray(spacing, dtype=np.float64)
    ps, pd = np.argwhere(src) * sp, np.argwhere(dst) * sp
    c = pd.mean(0)  # dipusatkan supaya float32 cukup presisi
    ps, pd = (ps - c).astype(np.float32), (pd - c).astype(np.float32)
    pn = (pd * pd).sum(1)
    out = np.empty(len(ps))
    for i in range(0, len(ps), chunk):
        q = ps[i:i + chunk]
        d2 = (q * q).sum(1)[:, None] + pn[None, :] - 2 * (q @ pd.T)
        out[i:i + chunk] = np.sqrt(np.maximum(d2.min(1), 0))
    return out


def _separable(src, dst, spacing, box):
    """EDT separabel (min per sumbu atas f(j) + (w*(i-j))^2) di dalam kotak pembatas src|dst;
    eksak karena semua voxel dst ada di dalam kotak."""
    f = np.where(dst[box], 0.0, np.inf).astype(np.float32)
    for ax, w in enumerate(spacing):
        f = np.moveaxis(f, ax, 0)
        n = f.shape[0]
        i = np.arange(n, dtype=np.float32)
        g = np.full_like(f, np.inf)
        for j in range(n):
            row = f[j]
            if np.isinf(row).all():
                continue
            np.minimum(g, row[None] + ((w * (i - j)) ** 2).reshape((n,) + (1,) * row.ndim), out=g)
        f = np.moveaxis(g, 0, ax)
    return np.sqrt(f[src[box]]).astype(np.float64)


def nearest_dist(src, dst, spacing):
    """Untuk tiap voxel True di src: jarak (mm) ke voxel True terdekat di dst.
    Sama dengan distance_transform_edt(~dst, sampling=spacing)[src]; memilih cara yang lebih murah."""
    both = np.argwhere(src | dst)
    lo, hi = both.min(0), both.max(0) + 1
    box = tuple(slice(a, b) for a, b in zip(lo, hi))
    cost_sep = float(np.prod(hi - lo)) * float((hi - lo).sum())
    cost_pair = float(src.sum()) * float(dst.sum()) * 3
    return _pairwise(src, dst, spacing) if cost_pair < cost_sep else _separable(src, dst, spacing, box)
