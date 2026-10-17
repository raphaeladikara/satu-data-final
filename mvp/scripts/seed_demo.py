"""Isi basis data dengan data demo untuk presentasi: 1 dosen, 1 kelas, 10 mahasiswa fiktif.

Percobaan mahasiswa disimulasikan lewat API yang sama dengan aplikasi (penilaian, BKT, log tutor
sungguhan). Anotasinya dibuat dari mask ahli yang sengaja diganggu (dilatasi, erosi, fokus kecil
dibuang, digeser) sesuai tingkat kemampuan tiap mahasiswa, lalu waktu percobaan disebar ke 14 hari
terakhir. Semua nama fiktif; data ini hanya untuk demo, bukan hasil uji coba.

    cd mvp
    .venv/Scripts/python scripts/seed_demo.py            # DATABASE_URL dipakai bila ada, selain itu SQLite lokal
    .venv/Scripts/python scripts/seed_demo.py --hapus    # hapus data demo saja

Akun demo (kata sandi sama untuk semua): dosen `demo.dosen`, mahasiswa NIM DEMO0001 s.d. DEMO0010,
kata sandi `sinaps-demo`.
"""
import argparse
import os
import random
import sys
import time
from pathlib import Path

import numpy as np

MVP = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(MVP))
os.environ.pop("OPENAI_API_KEY", None)  # tutor demo memakai templat offline, tanpa biaya API

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import delete, update  # noqa: E402

from api.index import app  # noqa: E402
from sinaps import auth, cases, db, grading  # noqa: E402
from sinaps.ndi import erode26, label26  # noqa: E402

PASSWORD = "sinaps-demo"
DOSEN = "demo.dosen"
STUDENTS = [  # nama fiktif, kemampuan awal 0-1, jumlah kasus, hari sejak terakhir aktif
    ("Alya Ramadhani", 0.85, 9, 0), ("Bima Pratama", 0.55, 7, 1), ("Citra Lestari", 0.7, 8, 0),
    ("Dimas Saputra", 0.35, 5, 2), ("Eka Wulandari", 0.9, 10, 0), ("Fajar Nugroho", 0.45, 3, 9),
    ("Gita Maharani", 0.65, 6, 1), ("Hendra Wijaya", 0.25, 4, 3), ("Intan Permata", 0.75, 7, 0),
    ("Joko Susilo", 0.5, 0, 12),
]
QUESTIONS = ["Bagian mana yang terlewat?", "Kenapa tandaanku dianggap terlalu luas?",
             "Apakah lesinya di hemisfer kiri?", "Bagaimana membedakan restriksi sejati dan T2 shine-through?"]


def dilate(m):
    out = m.copy()
    for ax in range(2):  # dilatasi di bidang aksial saja, seperti kuas yang kebesaran
        out |= np.roll(m, 1, ax) | np.roll(m, -1, ax)
    return out


def perturb(g, skill, rng):
    """Anotasi sintetis dengan jenis kesalahan yang peluangnya bergantung pada kemampuan."""
    r = rng.random()
    if r < skill * 0.6:
        p = g.copy()
        if rng.random() < 0.5:
            p = erode26(p) | (g & dilate(erode26(p)))  # tepi sedikit terpotong, hampir benar
        return p
    kind = rng.choice(["luas", "sempit", "terlewat", "geser", "luas"])
    if kind == "luas":
        p = dilate(g)
        return dilate(p) if rng.random() < 0.5 else p
    if kind == "sempit":
        return erode26(g)
    if kind == "terlewat":
        lab, n = label26(g)
        if n < 2:
            return erode26(g)
        sizes = np.bincount(lab.ravel())[1:]
        keep = np.argsort(sizes)[::-1][: max(1, n // 3)] + 1
        return np.isin(lab, keep)
    return np.roll(g, int(rng.integers(6, 14)) * (1 if rng.random() < 0.5 else -1), axis=0)


def hapus():
    sids = [auth.pseudonym(f"DEMO{i:04d}") for i in range(1, len(STUDENTS) + 1)]
    did = auth.dosen_id(DOSEN)
    with db.engine().begin() as c:
        for t in (db.attempts, db.tutor_logs, db.mastery, db.lessons):
            c.execute(delete(t).where(t.c.student_id.in_(sids)))
        for k in db.list_classes(did):
            c.execute(delete(db.assignments).where(db.assignments.c.kelas_id == k["id"]))
        c.execute(delete(db.classes).where(db.classes.c.dosen_id == did))
        c.execute(delete(db.accounts).where(db.accounts.c.id.in_(sids + [did])))
    print("data demo dihapus")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--hapus", action="store_true")
    ap.add_argument("--seed", type=int, default=7)
    a = ap.parse_args()
    hapus()
    if a.hapus:
        return
    rng = random.Random(a.seed)
    nrng = np.random.default_rng(a.seed)
    c = TestClient(app)

    def ok(r):
        if r.status_code >= 300:
            raise SystemExit(f"{r.request.method} {r.request.url} -> {r.status_code} {r.text[:200]}")
        return r.json()

    d = ok(c.post("/api/auth/register-dosen", json={"nama": "dr. Demo Pengampu, Sp.Rad.", "username": DOSEN,
                                                     "password": PASSWORD, "kode_dosen": auth.DOSEN_KEY}))
    H = {"Authorization": f"Bearer {d['token']}"}
    kelas = ok(c.post("/api/dosen/kelas", json={"nama": "Demo · Blok Neurologi 2026"}, headers=H))
    now = time.time()
    tugas_at = now - 6 * 86400
    print(f"dosen {DOSEN}, kelas {kelas['nama']} kode {kelas['kode']}")

    for i, (nama, skill, n_cases, idle_days) in enumerate(STUDENTS, 1):
        nim = f"DEMO{i:04d}"
        s = ok(c.post("/api/auth/register", json={"nama": nama, "nim": nim, "password": PASSWORD,
                                                  "jenjang": rng.choice(["klinik", "klinik", "praklinik", "internsip"]),
                                                  "kode_kelas": kelas["kode"]}))
        S = {"Authorization": f"Bearer {s['token']}"}
        sid = s["user"]["id"]
        # modul: mahasiswa yang lebih rajin menyelesaikan lebih banyak
        for lid in ["orientasi", "k1", "k2", "k3", "k6"][: max(0, round(skill * 6) - 1)]:
            score = min(1.0, round(rng.uniform(0.6, 1.0) * 3) / 3)
            ok(c.post(f"/api/lessons/{lid}", json={"quiz_score": score, "completed": score >= 2 / 3}, headers=S))
        # percobaan tersebar dari 13 hari lalu sampai hari terakhir aktif
        span_end = now - idle_days * 86400 - 3600
        times = sorted(rng.uniform(now - 13 * 86400, span_end) for _ in range(n_cases))
        for j, t_submit in enumerate(times):
            att = ok(c.get("/api/next", params={"baru": "true"}, headers=S))
            cid = att["case"]["id"]
            sec = cases.secrets()[cid]
            f = sec["findings"]
            g = cases.masks(cid)["gt"]
            sk = min(0.95, skill + 0.04 * j)  # sedikit membaik seiring latihan
            truth = db.get_attempt(att["attempt_id"])["seq_order"]
            names = list(truth.values())
            k1 = dict(truth) if rng.random() < sk + 0.1 else dict(zip(truth, rng.sample(names, len(names))))
            ok(c.post("/api/reveal", json={"attempt_id": att["attempt_id"], "k1": k1}, headers=S))
            center = f["fokus"][0]["pusat_voxel"]
            point = [round(x) for x in center] if rng.random() < sk + 0.1 else [10, 10, 2]
            hemi = f["hemisfer"] if rng.random() < sk + 0.05 else rng.choice(["kiri", "kanan", "bilateral"])
            kb = grading.adc_bin(f["adc_relatif_lesi"])
            k3b = kb if rng.random() < sk else rng.choice([b[0] for b in grading.ADC_BINS])
            k3r = f["restriksi_sejati"] if rng.random() < sk + 0.1 else not f["restriksi_sejati"]
            p = perturb(g, sk, nrng)
            body = {"attempt_id": att["attempt_id"], "k1": k1, "k2_point": point, "k2_hemisfer": hemi,
                    "k3_adc_bin": k3b, "k3_restriksi": k3r, "mask_rle": cases.rle_encode(p)}
            ok(c.post("/api/submit", json=body, headers=S))
            if rng.random() < 0.45:
                ok(c.post("/api/tutor", json={"attempt_id": att["attempt_id"], "mode": rng.choice(["sokratik", "penjelasan"]),
                                              "message": rng.choice(QUESTIONS)}, headers=S))
            dur = rng.uniform(240, 1100)
            with db.engine().begin() as conn:
                conn.execute(update(db.attempts).where(db.attempts.c.id == att["attempt_id"])
                             .values(started_at=t_submit - dur, submitted_at=t_submit))
                conn.execute(update(db.tutor_logs).where(db.tutor_logs.c.attempt_id == att["attempt_id"])
                             .values(created_at=t_submit + 60))
        last = times[-1] if times else now - idle_days * 86400
        db.update_account(sid, last_seen=last, created_at=now - 14 * 86400)
        print(f"  {nim} {nama}: {n_cases} kasus")

    # tugas: dua modul + tiga kasus, dibuat 6 hari lalu
    pool = [x["id"] for x in ok(c.get("/api/dosen/cases", headers=H)) if not x["contoh_ajar"]]
    t = ok(c.post("/api/dosen/assignments", json={
        "kelas_id": kelas["id"], "judul": "Minggu 2: restriksi difusi dan delineasi",
        "catatan": "Baca modul K3 dan K6, lalu kerjakan tiga kasus berikut. Perhatikan fokus kecil.",
        "lesson_ids": ["k3", "k6"], "case_ids": rng.sample(pool, 3), "due_at": now + 3 * 86400}, headers=H))
    with db.engine().begin() as conn:
        conn.execute(update(db.assignments).where(db.assignments.c.id == t["id"]).values(created_at=tugas_at - 7 * 86400))
    ok(c.post("/api/dosen/cases/sub-934/review", json={"status": "perlu_tinjau",
                                                        "catatan": "Lesi < 1 ml, Dice model 0. Minta radiolog memeriksa mask."}, headers=H))
    print(f"selesai. Masuk sebagai dosen '{DOSEN}' atau mahasiswa DEMO0001, kata sandi '{PASSWORD}'.")


if __name__ == "__main__":
    main()
