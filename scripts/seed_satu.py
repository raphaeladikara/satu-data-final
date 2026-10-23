"""Kosongkan seluruh basis data lalu isi satu dosen, satu kelas, satu mahasiswa untuk demo alur.

Skenario: dosen membuat kelas dan satu tugas (modul + tiga kasus), mahasiswa bergabung lewat kode kelas,
menyelesaikan modul, mengerjakan ketiga kasus tugas plus beberapa kasus latihan, dan bertanya ke tutor.
Dosen lalu bisa melihat progres, nilai per KC, dan log tutor mahasiswa tersebut.

    DATABASE_URL=... .venv/Scripts/python scripts/seed_satu.py

PERINGATAN: semua akun, kelas, tugas, percobaan, dan log dihapus.
Akun: dosen `dosen.demo`, mahasiswa NIM `2210211021`, kata sandi `sinaps-demo`.
"""
import random
import time

import numpy as np
from sqlalchemy import delete, update

from seed_demo import PASSWORD, simulate_attempt, simulate_wow
from fastapi.testclient import TestClient
from api.index import app
from sinaps import auth, db

DOSEN = ("dosen.demo", "dr. Ratna Pengampu, Sp.Rad.")
MHS = ("Alya Ramadhani", "2210211021", "klinik")


def kosongkan():
    with db.engine().begin() as c:
        for t in (db.tutor_logs, db.attempts, db.mastery, db.lessons, db.assignments, db.case_reviews,
                  db.classes, db.login_fails, db.accounts):
            c.execute(delete(t))
    print("basis data dikosongkan")


def main():
    kosongkan()
    rng, nrng = random.Random(7), np.random.default_rng(7)
    c = TestClient(app)

    def ok(r):
        if r.status_code >= 300:
            raise SystemExit(f"{r.request.method} {r.request.url} -> {r.status_code} {r.text[:200]}")
        return r.json()

    d = ok(c.post("/api/auth/register-dosen", json={"nama": DOSEN[1], "username": DOSEN[0],
                                                     "password": PASSWORD, "kode_dosen": auth.DOSEN_KEY}))
    H = {"Authorization": f"Bearer {d['token']}"}
    now = time.time()
    kelas = ok(c.post("/api/dosen/kelas", json={"nama": "Blok Neurologi 2026"}, headers=H))
    pool = [x["id"] for x in ok(c.get("/api/dosen/cases", headers=H)) if not x["contoh_ajar"] and x["id"] != "sub-934"]
    rng.shuffle(pool)
    tugas_cases = pool[:3]
    t = ok(c.post("/api/dosen/assignments", json={
        "kelas_id": kelas["id"], "judul": "Minggu 2: restriksi difusi dan delineasi",
        "catatan": "Baca modul K3 dan K6, lalu kerjakan tiga kasus berikut. Perhatikan fokus kecil.",
        "lesson_ids": ["k3", "k6"], "case_ids": tugas_cases, "due_at": now + 3 * 86400}, headers=H))
    with db.engine().begin() as conn:
        conn.execute(update(db.assignments).where(db.assignments.c.id == t["id"]).values(created_at=now - 6 * 86400))

    nama, nim, jenjang = MHS
    s = ok(c.post("/api/auth/register", json={"nama": nama, "nim": nim, "password": PASSWORD,
                                              "jenjang": jenjang, "kode_kelas": kelas["kode"]}))
    S, sid = {"Authorization": f"Bearer {s['token']}"}, s["user"]["id"]
    for lid in ["orientasi", "k1", "k3", "k6"]:
        ok(c.post(f"/api/lessons/{lid}", json={"quiz_score": 1.0, "completed": True}, headers=S))
    times = sorted(rng.uniform(now - 5 * 86400, now - 3600) for _ in range(5))
    for j, (t_submit, cid) in enumerate(zip(times, tugas_cases + [None, None])):
        simulate_attempt(c, S, ok, 0.6 + 0.05 * j, t_submit, rng, nrng, cid)
    if "sub-1150" not in db.submitted_case_ids(sid):
        simulate_wow(c, S, ok, "sub-1150", now - 2 * 86400)
    db.update_account(sid, last_seen=now - 1800, created_at=now - 7 * 86400)
    print(f"kelas {kelas['nama']} kode {kelas['kode']}; tugas kasus {tugas_cases}")
    print(f"selesai. Dosen '{DOSEN[0]}', mahasiswa NIM '{nim}', kata sandi '{PASSWORD}'.")


if __name__ == "__main__":
    main()
