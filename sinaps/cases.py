"""Bank kasus: metadata publik, kunci jawaban (server saja), dan enkode RLE untuk mask."""
import json
from functools import lru_cache
from pathlib import Path

import numpy as np

MVP = Path(__file__).resolve().parents[1]
PUBLIC_INDEX = MVP / "public" / "cases" / "index.json"
SERVER = MVP / "server_data"


@lru_cache(maxsize=1)
def index():
    data = json.loads(PUBLIC_INDEX.read_text(encoding="utf-8"))
    return {c["id"]: c for c in data["cases"]}, data["tertiles_D"]


@lru_cache(maxsize=1)
def secrets():
    return json.loads((SERVER / "cases.json").read_text(encoding="utf-8"))


def public_case(case_id):
    return index()[0][case_id]


def all_cases():
    return list(index()[0].values())


@lru_cache(maxsize=8)
def masks(case_id):
    z = np.load(SERVER / "cases" / f"{case_id}.npz")
    return {k: z[k].astype(bool) for k in z.files}


def spacing(case_id):
    return tuple(public_case(case_id)["spacing"])


# RLE: panjang run bergantian 0,1,0,1,... pada urutan voxel x tercepat (sama dengan buffer viewer)
def rle_encode(mask):
    flat = np.asarray(mask, dtype=np.uint8).ravel(order="F")
    if flat.size == 0:
        return []
    change = np.flatnonzero(np.diff(flat)) + 1
    bounds = np.concatenate([[0], change, [flat.size]])
    runs = np.diff(bounds).tolist()
    return runs if flat[0] == 0 else [0] + runs


def rle_decode(runs, shape):
    total = int(np.prod(shape))
    if len(runs) > total + 1 or any(type(r) is not int or r < 0 for r in runs):
        raise ValueError("RLE harus berisi bilangan bulat >= 0")
    if sum(runs) != total:
        raise ValueError(f"panjang RLE {sum(runs)} != {total}")
    vals = np.zeros(len(runs), dtype=np.uint8)
    vals[1::2] = 1
    flat = np.repeat(vals, runs)
    return flat.reshape(shape, order="F").astype(bool)
