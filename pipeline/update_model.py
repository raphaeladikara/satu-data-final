"""Pasang hasil training Kaggle baru ke web SINAPS dalam satu perintah.

    .venv/Scripts/python update_model.py <sinaps_out.zip | folder hasil Kaggle> [--push]

Langkah:
  1. salin keluaran Kaggle ke pipeline/kaggle_out/ (isi lama dihapus)
  2. jalankan build_bank.py: prediksi model baru masuk ke server_data/ (citra tidak ditulis ulang)
  3. salin metrik uji ke pipeline/results/unet25d/ dan perbarui baris U-Net di README
  4. --push: commit server_data + metrik + README lalu push; Vercel yang terhubung ke GitHub
     otomatis redeploy
"""
import json
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
MVP = HERE.parent
OUT = HERE / "kaggle_out"
RES = HERE / "results" / "unet25d"
README = MVP / "README.md"
KEEP = ["metrics.json", "history.json", "test_per_subject.csv", "train_log.txt"]


def num(x, d=3):
    return f"{x:.{d}f}".replace(".", ",")


def unpack(src):
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    if src.is_file() and src.suffix == ".zip":
        with zipfile.ZipFile(src) as z:
            z.extractall(OUT)
    elif src.is_dir():
        for p in src.iterdir():
            if p.suffix == ".zip":
                continue
            (shutil.copytree if p.is_dir() else shutil.copy2)(p, OUT / p.name)
    else:
        sys.exit(f"bukan zip atau folder: {src}")
    # zip Kaggle kadang berisi satu folder induk
    if not (OUT / "metrics.json").exists():
        hit = next(OUT.rglob("metrics.json"), None)
        if not hit:
            sys.exit("metrics.json tidak ditemukan di keluaran Kaggle")
        for p in hit.parent.iterdir():
            shutil.move(str(p), OUT / p.name)
    n = len(list((OUT / "pred_bank").glob("*.npz")))
    if n != 36:
        sys.exit(f"pred_bank berisi {n} subjek, harusnya 36")


def update_readme(m):
    t = m["test"]
    pasien = f"{m['n_train_patients']:,}".replace(",", ".")
    gpu = m.get("gpu", "GPU").replace("Tesla ", "")
    row = (f"| Segmentasi U-Net 2.5D ({pasien} pasien latih, {m['epochs']} epoch, {gpu} "
           f"{round(m.get('train_minutes', 0))} menit) pada 36 subjek bank | `pipeline/kaggle/train_unet.py` "
           f"| Dice rerata {num(t['dice_mean'])} (IK 95% {num(t['dice_ci95'][0])}–{num(t['dice_ci95'][1])}), "
           f"median {num(t['dice_median'])}; recall per lesi {num(t['lesion_recall_mean'], 2)}; "
           f"Dice {num(t['dice_ge5ml'])} untuk lesi ≥ 5 ml (n={t['n_ge5ml']}) dan {num(t['dice_lt5ml'])} "
           f"untuk < 5 ml (n={t['n_lt5ml']}); hasil di `pipeline/results/unet25d/` |")
    lines = README.read_text(encoding="utf-8").splitlines(keepends=True)
    for i, ln in enumerate(lines):
        if ln.startswith("| Segmentasi U-Net 2.5D"):
            lines[i] = row + "\n"
            README.write_text("".join(lines), encoding="utf-8")
            return
    print("peringatan: baris U-Net di README tidak ditemukan, README tidak diubah")


def main():
    sys.stdout.reconfigure(line_buffering=True)
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 1:
        sys.exit(__doc__)
    old = json.loads((RES / "metrics.json").read_text()) if (RES / "metrics.json").exists() else None

    unpack(Path(args[0]).resolve())
    print("[1/4] keluaran Kaggle disalin ke", OUT)

    print("[2/4] membangun ulang bank kasus...")
    subprocess.run([sys.executable, str(HERE / "build_bank.py")], check=True)

    RES.mkdir(parents=True, exist_ok=True)
    for f in KEEP:
        if (OUT / f).exists():
            shutil.copy2(OUT / f, RES / f)
    m = json.loads((OUT / "metrics.json").read_text())
    update_readme(m)
    t = m["test"]
    print("[3/4] metrik disimpan, README diperbarui")
    for k in ("dice_mean", "dice_median", "lesion_recall_mean", "dice_ge5ml", "dice_lt5ml"):
        before = f"{old['test'][k]:.3f} -> " if old else ""
        print(f"      {k:20s} {before}{t[k]:.3f}")

    if "--push" in sys.argv:
        repo = MVP
        paths = ["server_data", "public/cases", "pipeline/results/unet25d", "README.md"]
        subprocess.run(["git", "add", *paths], cwd=repo, check=True)
        msg = f"Perbarui model U-Net: Dice uji {t['dice_mean']:.3f}, median {t['dice_median']:.3f}"
        subprocess.run(["git", "commit", "-m", msg], cwd=repo, check=True)
        subprocess.run(["git", "push"], cwd=repo, check=True)
        print("[4/4] sudah di-push; Vercel akan redeploy otomatis")
    else:
        print("[4/4] cek `git status`, lalu jalankan lagi dengan --push untuk commit + redeploy")


if __name__ == "__main__":
    main()
