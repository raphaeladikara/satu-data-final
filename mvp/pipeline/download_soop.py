"""Unduh subset SOOP (OpenNeuro ds004889, CC0) dari S3 publik OpenNeuro.

Tahap:
  masks   participants.tsv + semua lesion mask akut (±5 MB)
  images  DWI (TRACE) + ADC untuk subjek latih, ditambah FLAIR untuk bank kasus

Pemakaian:
  python download_soop.py masks
  python download_soop.py images --n-train 250 --n-bank 30
"""
import argparse
import concurrent.futures as cf
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[2] / "data" / "soop"
S3 = "https://s3.amazonaws.com/openneuro.org"
DS = "ds004889"
NS = {"s3": "http://s3.amazonaws.com/doc/2006-03-01/"}


def list_keys(prefix):
    keys, token = [], None
    while True:
        params = {"list-type": "2", "prefix": prefix, "max-keys": "1000"}
        if token:
            params["continuation-token"] = token
        r = requests.get(S3, params=params, timeout=60)
        r.raise_for_status()
        root = ET.fromstring(r.content)
        keys += [c.find("s3:Key", NS).text for c in root.findall("s3:Contents", NS)]
        nxt = root.find("s3:NextContinuationToken", NS)
        if nxt is None:
            return keys
        token = nxt.text


def fetch(key):
    dest = ROOT / key.removeprefix(DS + "/")
    if dest.exists() and dest.stat().st_size > 0:
        return dest, False
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    with requests.get(f"{S3}/{key}", stream=True, timeout=120) as r:
        r.raise_for_status()
        with open(tmp, "wb") as f:
            for chunk in r.iter_content(1 << 16):
                f.write(chunk)
    tmp.replace(dest)
    return dest, True


def fetch_all(keys, workers=16):
    done = 0
    with cf.ThreadPoolExecutor(workers) as ex:
        for _ in ex.map(fetch, keys):
            done += 1
            if done % 50 == 0 or done == len(keys):
                print(f"  {done}/{len(keys)}", flush=True)


def stage_masks():
    fetch_all([f"{DS}/participants.tsv", f"{DS}/participants.json", f"{DS}/README.md"])
    keys = [k for k in list_keys(f"{DS}/derivatives/lesion_masks/") if "desc-lesionAcute_mask" in k]
    print(f"{len(keys)} mask akut")
    fetch_all(keys)


def stage_images(n_train, n_bank, seed):
    sys.path.insert(0, str(Path(__file__).parent))
    from select_subjects import select

    bank, train = select(n_bank=n_bank, n_train=n_train, seed=seed)
    (ROOT / "bank_subjects.txt").write_text("\n".join(bank) + "\n")
    (ROOT / "train_subjects.txt").write_text("\n".join(train) + "\n")
    keys = []
    for s in bank + train:
        for rec in ("TRACE", "ADC"):
            keys += [f"{DS}/{s}/dwi/{s}_rec-{rec}_dwi.nii.gz", f"{DS}/{s}/dwi/{s}_rec-{rec}_dwi.json"]
    for s in bank:
        keys += [f"{DS}/{s}/anat/{s}_FLAIR.nii.gz", f"{DS}/{s}/anat/{s}_FLAIR.json"]
    print(f"bank {len(bank)}, latih {len(train)}, {len(keys)} berkas")
    fetch_all(keys, workers=12)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("stage", choices=["masks", "images"])
    ap.add_argument("--n-train", type=int, default=250)
    ap.add_argument("--n-bank", type=int, default=30)
    ap.add_argument("--seed", type=int, default=42)
    a = ap.parse_args()
    if a.stage == "masks":
        stage_masks()
    else:
        stage_images(a.n_train, a.n_bank, a.seed)
