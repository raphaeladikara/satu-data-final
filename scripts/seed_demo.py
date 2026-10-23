"""Isi basis data dengan data demo: 2 dosen, 3 kelas, 20 mahasiswa fiktif.

Skenario yang dicakup supaya semua fitur bisa dicek:
- dosen `demo.dosen` punya dua kelas (A: 10 mahasiswa, B: 5), dosen `demo.dosen2` punya satu kelas (4);
  tiap dosen hanya melihat mahasiswa di kelasnya sendiri
- DEMO0020 terdaftar tanpa kode kelas (untuk mencoba "gabung kelas")
- DEMO0002 punya satu kasus adaptif yang belum dikirim (untuk mencoba "lanjut kasus tertunda")
- tugas lewat tenggat, tugas aktif berisi modul + kasus, tugas kasus saja; verifikasi kasus dengan tiga status

Percobaan mahasiswa disimulasikan lewat API yang sama dengan aplikasi (penilaian, BKT, log tutor
sungguhan). Anotasinya dibuat dari mask ahli yang sengaja diganggu (dilatasi, erosi, fokus kecil
dibuang, digeser) sesuai tingkat kemampuan tiap mahasiswa, lalu waktu percobaan disebar ke 14 hari
terakhir. Semua nama fiktif; data ini hanya untuk demo, bukan hasil uji coba.

    cd mvp
    .venv/Scripts/python scripts/seed_demo.py            # DATABASE_URL dipakai bila ada, selain itu SQLite lokal
    .venv/Scripts/python scripts/seed_demo.py --hapus    # hapus data demo saja

Akun demo (kata sandi sama untuk semua): dosen `demo.dosen` dan `demo.dosen2`, mahasiswa NIM DEMO0001
s.d. DEMO0020, kata sandi `sinaps-demo`.
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
if "--llm" not in sys.argv:
    os.environ.pop("OPENAI_API_KEY", None)  # bawaan: tutor demo memakai templat offline, tanpa biaya API

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import delete, update  # noqa: E402

from api.index import app  # noqa: E402
from sinaps import auth, cases, db, grading  # noqa: E402
from sinaps.ndi import erode26, label26  # noqa: E402

PASSWORD = "sinaps-demo"
DOSEN = {"demo.dosen": "dr. Demo Pengampu, Sp.Rad.", "demo.dosen2": "dr. Rina Kusuma, Sp.N."}
CLASSES = [  # dosen, nama kelas, mahasiswa: (nama fiktif, kemampuan awal 0-1, jumlah kasus, hari sejak terakhir aktif)
    ("demo.dosen", "Blok Neurologi 2026 · Kelas A", [
        ("Alya Ramadhani", 0.85, 9, 0), ("Bima Pratama", 0.55, 7, 1), ("Citra Lestari", 0.7, 8, 0),
        ("Dimas Saputra", 0.35, 5, 2), ("Eka Wulandari", 0.9, 10, 0), ("Fajar Nugroho", 0.45, 3, 9),
        ("Gita Maharani", 0.65, 6, 1), ("Hendra Wijaya", 0.25, 4, 3), ("Intan Permata", 0.75, 7, 0),
        ("Joko Susilo", 0.5, 0, 12)]),
    ("demo.dosen", "Blok Neurologi 2026 · Kelas B", [
        ("Kevin Halim", 0.6, 5, 0), ("Laras Ayuningtyas", 0.8, 6, 1), ("Made Surya", 0.3, 4, 8),
        ("Nadia Putri", 0.7, 3, 2), ("Oki Firmansyah", 0.4, 2, 4)]),
    ("demo.dosen2", "Kepaniteraan Neurologi RS Pendidikan", [
        ("Putu Ananda", 0.75, 6, 0), ("Qori Amalia", 0.5, 4, 1), ("Rizky Maulana", 0.9, 8, 0),
        ("Sari Handayani", 0.2, 2, 5)]),
]
TANPA_KELAS = ("Tegar Wibowo", "praklinik")  # NIM terakhir, belum bergabung ke kelas mana pun
N_STUDENTS = sum(len(x[2]) for x in CLASSES) + 1
VIDEO_NIM = "2210211021"  # akun yang didaftarkan langsung saat merekam video demo; ikut dihapus
WOW = ("DEMO0002", "sub-1150")  # percobaan contoh: Dice tinggi tetapi sebagian besar fokus terlewat
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
    sids = [auth.pseudonym(f"DEMO{i:04d}") for i in range(1, N_STUDENTS + 1)] + [auth.pseudonym(VIDEO_NIM)]
    dids = [auth.dosen_id(u) for u in DOSEN]
    with db.engine().begin() as c:
        for t in (db.attempts, db.tutor_logs, db.mastery, db.lessons):
            c.execute(delete(t).where(t.c.student_id.in_(sids)))
        for did in dids:
            for k in db.list_classes(did):
                c.execute(delete(db.assignments).where(db.assignments.c.kelas_id == k["id"]))
        c.execute(delete(db.classes).where(db.classes.c.dosen_id.in_(dids)))
        c.execute(delete(db.case_reviews).where(db.case_reviews.c.dosen_id.in_(dids)))
        c.execute(delete(db.accounts).where(db.accounts.c.id.in_(sids + dids)))
    print("data demo dihapus")


def simulate_attempt(c, S, ok, sk, t_submit, rng, nrng, cid=None):
    sk = min(0.95, sk)
    att = ok(c.get(f"/api/open/{cid}", headers=S) if cid else c.get("/api/next", params={"baru": "true"}, headers=S))
    cid = att["case"]["id"]
    f = cases.secrets()[cid]["findings"]
    g = cases.masks(cid)["gt"]
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


def simulate_wow(c, S, ok, cid, t_submit):
    """K1-K3 benar, K6 hanya fokus terbesar: Dice tetap tinggi padahal banyak fokus kecil terlewat."""
    att = ok(c.get(f"/api/open/{cid}", headers=S))
    f = cases.secrets()[cid]["findings"]
    g = cases.masks(cid)["gt"]
    truth = db.get_attempt(att["attempt_id"])["seq_order"]
    ok(c.post("/api/reveal", json={"attempt_id": att["attempt_id"], "k1": truth}, headers=S))
    lab, n = label26(g)
    sizes = np.bincount(lab.ravel())[1:]
    p = np.isin(lab, np.argsort(sizes)[::-1][:3] + 1)
    body = {"attempt_id": att["attempt_id"], "k1": truth, "k2_point": [round(x) for x in f["fokus"][0]["pusat_voxel"]],
            "k2_hemisfer": f["hemisfer"], "k3_adc_bin": grading.adc_bin(f["adc_relatif_lesi"]),
            "k3_restriksi": f["restriksi_sejati"], "mask_rle": cases.rle_encode(p)}
    r = ok(c.post("/api/submit", json=body, headers=S))
    ok(c.post("/api/tutor", json={"attempt_id": att["attempt_id"], "mode": "penjelasan",
                                  "message": "Dice saya sudah tinggi, kenapa K6 masih salah?"}, headers=S))
    with db.engine().begin() as conn:
        conn.execute(update(db.attempts).where(db.attempts.c.id == att["attempt_id"])
                     .values(started_at=t_submit - 840, submitted_at=t_submit))
        conn.execute(update(db.tutor_logs).where(db.tutor_logs.c.attempt_id == att["attempt_id"])
                     .values(created_at=t_submit + 60))
    d = r["delineasi"]
    print(f"    + {cid}: Dice {d['dice']:.2f}, recall fokus {d['lesion_recall']:.2f}, {d['jenis_kesalahan_label']}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--hapus", action="store_true")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--llm", action="store_true", help="tutor memakai LLM sungguhan (perlu OPENAI_API_KEY)")
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

    H = {}
    for user, nama in DOSEN.items():
        d = ok(c.post("/api/auth/register-dosen", json={"nama": nama, "username": user,
                                                         "password": PASSWORD, "kode_dosen": auth.DOSEN_KEY}))
        H[user] = {"Authorization": f"Bearer {d['token']}"}
    now = time.time()
    nim_no = 0
    kelas_of = []

    def register(nama, jenjang, kode=None):
        nonlocal nim_no
        nim_no += 1
        nim = f"DEMO{nim_no:04d}"
        s = ok(c.post("/api/auth/register", json={"nama": nama, "nim": nim, "password": PASSWORD,
                                                  "jenjang": jenjang, "kode_kelas": kode}))
        return nim, s["user"]["id"], {"Authorization": f"Bearer {s['token']}"}

    for user, nama_kelas, studs in CLASSES:
        kelas = ok(c.post("/api/dosen/kelas", json={"nama": nama_kelas}, headers=H[user]))
        kelas_of.append(kelas)
        print(f"{user}: kelas {kelas['nama']} kode {kelas['kode']}")
        for nama, skill, n_cases, idle_days in studs:
            nim, sid, S = register(nama, rng.choice(["klinik", "klinik", "praklinik", "internsip"]), kelas["kode"])
            # modul: mahasiswa yang lebih rajin menyelesaikan lebih banyak
            for lid in ["orientasi", "k1", "k2", "k3", "k6"][: max(0, round(skill * 6) - 1)]:
                score = min(1.0, round(rng.uniform(0.6, 1.0) * 3) / 3)
                ok(c.post(f"/api/lessons/{lid}", json={"quiz_score": score, "completed": score >= 2 / 3}, headers=S))
            # percobaan tersebar dari 13 hari lalu sampai hari terakhir aktif; sedikit membaik seiring latihan
            span_end = now - idle_days * 86400 - 3600
            times = sorted(rng.uniform(now - 13 * 86400, span_end) for _ in range(n_cases))
            for j, t_submit in enumerate(times):
                simulate_attempt(c, S, ok, skill + 0.04 * j, t_submit, rng, nrng)
            if nim == WOW[0] and WOW[1] not in db.submitted_case_ids(sid):
                simulate_wow(c, S, ok, WOW[1], now - 2 * 86400)
            last = times[-1] if times else now - idle_days * 86400
            db.update_account(sid, last_seen=last, created_at=now - 14 * 86400)
            print(f"  {nim} {nama}: {n_cases} kasus")
            if nim == "DEMO0002":
                ok(c.get("/api/next", headers=S))  # kasus adaptif dibuka tapi belum dikirim
                print("    + 1 kasus tertunda")

    nim, _, _ = register(*TANPA_KELAS)
    print(f"{nim} {TANPA_KELAS[0]}: tanpa kelas")

    pool = [x["id"] for x in ok(c.get("/api/dosen/cases", headers=H["demo.dosen"])) if not x["contoh_ajar"] and x["id"] != "sub-934"]
    rng.shuffle(pool)
    tolak, tinjau, setuju = pool[:3]
    pool = pool[3:]  # kasus tugas tidak boleh kasus yang nanti ditolak
    ka, kb, kc = kelas_of
    tugas = [  # dosen, kelas, judul, catatan, modul, jumlah kasus, dibuat (hari lalu), tenggat (hari dari sekarang)
        ("demo.dosen", ka, "Minggu 1: orientasi dan pengenalan sekuens",
         "Selesaikan modul orientasi dan K1 sebelum mulai latihan.", ["orientasi", "k1"], 0, 13, -2),
        ("demo.dosen", ka, "Minggu 2: restriksi difusi dan delineasi",
         "Baca modul K3 dan K6, lalu kerjakan tiga kasus berikut. Perhatikan fokus kecil.", ["k3", "k6"], 3, 13, 3),
        ("demo.dosen", kb, "Latihan awal kelas B", "Dua kasus pemanasan dan modul lokalisasi.", ["k2"], 2, 10, 5),
        ("demo.dosen2", kc, "Tugas kepaniteraan: kasus multifokal",
         "Kerjakan empat kasus. Diskusikan hasilnya saat visite.", [], 4, 9, 1),
    ]
    for user, k, judul, catatan, lids, n, made, due in tugas:
        t = ok(c.post("/api/dosen/assignments", json={
            "kelas_id": k["id"], "judul": judul, "catatan": catatan, "lesson_ids": lids,
            "case_ids": rng.sample(pool, n), "due_at": now + due * 86400}, headers=H[user]))
        with db.engine().begin() as conn:
            conn.execute(update(db.assignments).where(db.assignments.c.id == t["id"])
                         .values(created_at=now - made * 86400))
        print(f"tugas '{judul}' ({k['nama']})")

    for cid, status, catatan in [
            ("sub-934", "perlu_tinjau", "Lesi < 1 ml, Dice model 0. Minta radiolog memeriksa mask."),
            (tinjau, "perlu_tinjau", "Batas lesi di slice atas meragukan."),
            (setuju, "disetujui", "Mask sesuai, layak dipakai latihan."),
            (tolak, "ditolak", "Artefak gerak berat; keluarkan dari latihan.")]:
        ok(c.post(f"/api/dosen/cases/{cid}/review", json={"status": status, "catatan": catatan},
                  headers=H["demo.dosen"]))
    print(f"verifikasi: {setuju} disetujui, {tinjau} dan sub-934 perlu tinjau, {tolak} ditolak")
    print(f"selesai. Masuk sebagai dosen demo.dosen / demo.dosen2 atau mahasiswa DEMO0001-DEMO{N_STUDENTS:04d}, "
          f"kata sandi '{PASSWORD}'.")


if __name__ == "__main__":
    main()
