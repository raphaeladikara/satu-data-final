"""SINAPS - pelatihan U-Net 2.5D segmentasi lesi stroke akut (dijalankan di Kaggle GPU).

Masukan model: 3 slice DWI + 3 slice ADC yang bertetangga (6 kanal), resolusi 128 px.
Data: SOOP (OpenNeuro ds004889, CC0), diunduh langsung dari S3 publik OpenNeuro.
Subjek bank kasus SINAPS (30 subjek) TIDAK ikut pelatihan; dipakai sebagai data uji.

Keluaran di /kaggle/working:
  unet25d.pt           bobot model terbaik (Dice validasi)
  metrics.json         Dice, recall per lesi, IK 95% bootstrap pada data uji
  test_per_subject.csv metrik per subjek uji
  pred_bank/<sub>.npz  peta probabilitas (uint8, ruang DWI asli) untuk bank kasus
"""
import concurrent.futures as cf
import io
import json
import math
import os
import subprocess
import sys
import time
from pathlib import Path

try:
    import nibabel as nib
except ImportError:
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", "nibabel"], check=True)
    import nibabel as nib

import numpy as np
import pandas as pd
import requests
import torch
import torch.nn as nn
import torch.nn.functional as F
from scipy import ndimage

S3 = "https://s3.amazonaws.com/openneuro.org/ds004889"
BANK = "sub-3 sub-94 sub-137 sub-203 sub-267 sub-303 sub-577 sub-580 sub-652 sub-654 sub-698 sub-724 sub-754 sub-763 sub-830 sub-898 sub-901 sub-924 sub-934 sub-998 sub-1041 sub-1043 sub-1150 sub-1171 sub-1232 sub-1269 sub-1301 sub-1320 sub-1362 sub-1385 sub-1394 sub-1413 sub-1424 sub-1517 sub-1634 sub-1671".split()
RES = 128
SEED = 42
EPOCHS = int(os.environ.get("EPOCHS", 30))
OUT = Path("/kaggle/working") if Path("/kaggle/working").exists() else Path("out")
CACHE = Path("/kaggle/temp/soop") if Path("/kaggle").exists() else Path("cache")


# ---------- praproses (dipakai juga oleh pipeline lokal) ----------

def load3d(img):
    a = np.asarray(img.dataobj, dtype=np.float32)
    return a[..., 0] if a.ndim == 4 else a


def brain_mask(dwi):
    """Masker otak kasar dari DWI: ambang relatif, isi lubang, ambil komponen terbesar per volume."""
    thr = 0.15 * np.percentile(dwi[dwi > 0], 99) if (dwi > 0).any() else 0
    m = dwi > thr
    m = ndimage.binary_opening(m, iterations=1)
    lab, n = ndimage.label(m)
    if n > 1:
        sizes = ndimage.sum_labels(m, lab, range(1, n + 1))
        m = lab == (1 + int(np.argmax(sizes)))
    return ndimage.binary_fill_holes(m)


def normalize(dwi, adc):
    """DWI: z-score dalam otak. ADC: relatif terhadap median ADC otak (skala tiap pemindai berbeda)."""
    b = brain_mask(dwi)
    mu, sd = dwi[b].mean(), dwi[b].std() + 1e-6
    d = np.clip((dwi - mu) / sd, -3, 10)
    pos = adc[b & (adc > 0)]
    med = np.median(pos) if pos.size else 1.0
    a = np.clip(adc / (med + 1e-6), 0, 3)
    return d.astype(np.float32), a.astype(np.float32), b


def to_slices(vol, res=RES, mode="bilinear"):
    """(X, Y, Z) -> tensor (Z, res, res)."""
    t = torch.from_numpy(np.ascontiguousarray(vol.transpose(2, 0, 1)))[:, None].float()
    return F.interpolate(t, size=(res, res), mode=mode, align_corners=False if mode == "bilinear" else None)[:, 0]


def stack25d(d, a):
    """d, a: (Z, H, W) -> (Z, 6, H, W) dengan slice tetangga (tepi direplikasi)."""
    z = d.shape[0]
    idx = lambda k: torch.clamp(torch.arange(z) + k, 0, z - 1)
    return torch.stack([d[idx(-1)], d, d[idx(1)], a[idx(-1)], a, a[idx(1)]], dim=1)


# ---------- model ----------

class Block(nn.Module):
    def __init__(self, i, o):
        super().__init__()
        self.net = nn.Sequential(
            nn.Conv2d(i, o, 3, padding=1, bias=False), nn.BatchNorm2d(o), nn.ReLU(inplace=True),
            nn.Conv2d(o, o, 3, padding=1, bias=False), nn.BatchNorm2d(o), nn.ReLU(inplace=True))

    def forward(self, x):
        return self.net(x)


class UNet(nn.Module):
    def __init__(self, cin=6, base=32):
        super().__init__()
        ch = [base, base * 2, base * 4, base * 8, base * 16]
        self.down = nn.ModuleList([Block(cin, ch[0])] + [Block(ch[i], ch[i + 1]) for i in range(4)])
        self.up = nn.ModuleList([nn.ConvTranspose2d(ch[i + 1], ch[i], 2, stride=2) for i in reversed(range(4))])
        self.dec = nn.ModuleList([Block(ch[i] * 2, ch[i]) for i in reversed(range(4))])
        self.head = nn.Conv2d(ch[0], 1, 1)

    def forward(self, x):
        skips = []
        for i, blk in enumerate(self.down):
            x = blk(x if i == 0 else F.max_pool2d(x, 2))
            skips.append(x)
        x = skips.pop()
        for up, dec in zip(self.up, self.dec):
            x = dec(torch.cat([up(x), skips.pop()], 1))
        return self.head(x)


@torch.no_grad()
def predict_volume(model, dwi, adc, device, batch=32):
    """Prediksi probabilitas pada ruang DWI asli. dwi, adc: (X, Y, Z) mentah."""
    d, a, b = normalize(dwi, adc)
    x = stack25d(to_slices(d), to_slices(a))
    probs = []
    model.eval()
    for i in range(0, len(x), batch):
        with torch.autocast(device_type=device.type, enabled=device.type == "cuda"):
            p = torch.sigmoid(model(x[i:i + batch].to(device)).float())
        probs.append(F.interpolate(p, size=dwi.shape[:2], mode="bilinear", align_corners=False)[:, 0].cpu())
    p = torch.cat(probs).numpy().transpose(1, 2, 0)
    return p * b


# ---------- metrik ----------

def dice(p, g):
    s = p.sum() + g.sum()
    return 1.0 if s == 0 else 2.0 * np.logical_and(p, g).sum() / s


def lesion_recall(p, g, spacing):
    lab, n = ndimage.label(g, structure=np.ones((3, 3, 3)))
    vml = float(np.prod(spacing)) / 1000
    hits = tot = 0
    for i in range(1, n + 1):
        comp = lab == i
        if comp.sum() * vml < 0.1:
            continue
        tot += 1
        hits += bool(np.logical_and(comp, p).any())
    return hits / tot if tot else 1.0


def boot_ci(x, n=2000, seed=SEED):
    rng = np.random.default_rng(seed)
    x = np.asarray(x)
    m = [x[rng.integers(0, len(x), len(x))].mean() for _ in range(n)]
    return [float(np.percentile(m, 2.5)), float(np.percentile(m, 97.5))]


# ---------- data ----------

def get(url, dest):
    if dest.exists():
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(4):
        try:
            r = requests.get(url, timeout=120)
            r.raise_for_status()
            dest.write_bytes(r.content)
            return dest
        except Exception:
            time.sleep(2 ** attempt)
    return None


def fetch_subject(s):
    paths = {
        "dwi": get(f"{S3}/{s}/dwi/{s}_rec-TRACE_dwi.nii.gz", CACHE / s / "dwi.nii.gz"),
        "adc": get(f"{S3}/{s}/dwi/{s}_rec-ADC_dwi.nii.gz", CACHE / s / "adc.nii.gz"),
        "mask": get(f"{S3}/derivatives/lesion_masks/{s}/dwi/{s}_space-TRACE_desc-lesionAcute_mask.nii.gz",
                    CACHE / s / "mask.nii.gz"),
    }
    return s, (paths if all(paths.values()) else None)


def load_subject(paths):
    di = nib.load(paths["dwi"])
    dwi, adc = load3d(di), load3d(nib.load(paths["adc"]))
    g = load3d(nib.load(paths["mask"])) > 0
    if dwi.shape != adc.shape or dwi.shape != g.shape:
        return None
    return dwi, adc, g, di.header.get_zooms()[:3]


def subjects():
    part = pd.read_csv(io.StringIO(requests.get(f"{S3}/participants.tsv", timeout=60).text), sep="\t")
    ids = [s for s in part.participant_id if s not in BANK]
    return ids[:int(os.environ["SMOKE"])] if os.environ.get("SMOKE") else ids


def main():
    torch.manual_seed(SEED)
    np.random.seed(SEED)
    OUT.mkdir(parents=True, exist_ok=True)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print("device", device, torch.cuda.get_device_name(0) if device.type == "cuda" else "")

    t0 = time.time()
    with cf.ThreadPoolExecutor(32) as ex:
        bank = BANK[:3] if os.environ.get("SMOKE") else BANK
        fetched = dict(ex.map(fetch_subject, subjects() + bank))
    print(f"unduh {len(fetched)} subjek dalam {time.time() - t0:.0f} dtk")

    rng = np.random.default_rng(SEED)
    train_ids = [s for s in fetched if s not in BANK and fetched[s]]
    train_ids = list(rng.permutation(train_ids))
    n_val = 2 if os.environ.get("SMOKE") else max(20, len(train_ids) // 20)
    val_ids, tr_ids = train_ids[:n_val], train_ids[n_val:]

    xs, ys, used = [], [], []
    for s in tr_ids:
        sub = load_subject(fetched[s])
        if sub is None or not sub[2].any():
            continue
        dwi, adc, g, _ = sub
        d, a, b = normalize(dwi, adc)
        x = stack25d(to_slices(d), to_slices(a))
        y = (to_slices(g.astype(np.float32)) > 0.5).float()
        keep = torch.from_numpy(b.any(axis=(0, 1)))  # hanya slice yang memuat otak
        xs.append(x[keep].half())
        ys.append(y[keep].bool())
        used.append(s)
    X, Y = torch.cat(xs), torch.cat(ys)
    print(f"latih: {len(used)} pasien, {len(X)} slice; validasi: {len(val_ids)} pasien")

    model = UNet().to(device)
    opt = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)
    steps = EPOCHS * math.ceil(len(X) / 64)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=2e-3, total_steps=steps, pct_start=0.1)
    scaler = torch.amp.GradScaler(enabled=device.type == "cuda")
    val = [(s, load_subject(fetched[s])) for s in val_ids]
    val = [(s, v) for s, v in val if v is not None]

    best, hist = -1.0, []
    for ep in range(EPOCHS):
        model.train()
        perm = torch.randperm(len(X))
        tot = 0.0
        for i in range(0, len(X), 64):
            idx = perm[i:i + 64]
            xb, yb = X[idx].float().to(device), Y[idx].float().to(device)[:, None]
            if torch.rand(1) < 0.5:  # flip kiri-kanan
                xb, yb = xb.flip(-2), yb.flip(-2)
            xb = xb * (1 + 0.1 * torch.randn(len(xb), 1, 1, 1, device=device))
            with torch.autocast(device_type=device.type, enabled=device.type == "cuda"):
                logit = model(xb)
                p = torch.sigmoid(logit.float())
                inter = (p * yb).sum((1, 2, 3))
                soft_dice = 1 - (2 * inter + 1) / (p.sum((1, 2, 3)) + yb.sum((1, 2, 3)) + 1)
                loss = F.binary_cross_entropy_with_logits(logit.float(), yb) + soft_dice.mean()
            opt.zero_grad(set_to_none=True)
            scaler.scale(loss).backward()
            scaler.step(opt)
            scaler.update()
            sched.step()
            tot += loss.item() * len(idx)
        vd = [dice(predict_volume(model, d, a, device) > 0.5, g) for _, (d, a, g, _) in val]
        hist.append({"epoch": ep + 1, "loss": tot / len(X), "val_dice": float(np.mean(vd))})
        print(hist[-1], f"{time.time() - t0:.0f} dtk", flush=True)
        if np.mean(vd) > best:
            best = float(np.mean(vd))
            torch.save(model.state_dict(), OUT / "unet25d.pt")

    model.load_state_dict(torch.load(OUT / "unet25d.pt", map_location=device))
    rows = []
    (OUT / "pred_bank").mkdir(exist_ok=True)
    for s in BANK:
        if not fetched.get(s):
            continue
        dwi, adc, g, sp = load_subject(fetched[s])
        p = predict_volume(model, dwi, adc, device)
        np.savez_compressed(OUT / "pred_bank" / f"{s}.npz", prob=(p * 255).astype(np.uint8))
        pm = p > 0.5
        vol = g.sum() * float(np.prod(sp)) / 1000
        rows.append({"participant_id": s, "dice": dice(pm, g), "lesion_recall": lesion_recall(pm, g, sp),
                     "gt_ml": vol, "pred_ml": pm.sum() * float(np.prod(sp)) / 1000})
    df = pd.DataFrame(rows)
    df.to_csv(OUT / "test_per_subject.csv", index=False)
    big, small = df[df.gt_ml >= 5], df[df.gt_ml < 5]
    metrics = {
        "n_train_patients": len(used), "n_train_slices": len(X), "n_val": len(val), "epochs": EPOCHS,
        "best_val_dice": best, "history": hist,
        "test": {
            "n": len(df), "dice_mean": float(df.dice.mean()), "dice_median": float(df.dice.median()),
            "dice_ci95": boot_ci(df.dice), "lesion_recall_mean": float(df.lesion_recall.mean()),
            "dice_ge5ml": float(big.dice.mean()) if len(big) else None, "n_ge5ml": len(big),
            "dice_lt5ml": float(small.dice.mean()) if len(small) else None, "n_lt5ml": len(small),
        },
    }
    (OUT / "metrics.json").write_text(json.dumps(metrics, indent=2))
    print(json.dumps(metrics["test"], indent=2))


if __name__ == "__main__":
    main()
