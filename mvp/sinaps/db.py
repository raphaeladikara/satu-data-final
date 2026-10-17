"""Penyimpanan log belajar berpseudonim.

DATABASE_URL (Postgres: Supabase/Neon) dipakai bila ada; tanpa itu jatuh ke SQLite lokal
(di Vercel: /tmp, sementara). Log belajar hanya memuat pseudonim. NIM tidak pernah disimpan; nama
tampilan hanya ada di tabel akun supaya dosen bisa mengenali mahasiswanya sendiri.
"""
import json
import os
import time
from functools import lru_cache
from pathlib import Path

from sqlalchemy import (JSON, Column, Float, Integer, MetaData, String, Table, Text, create_engine, delete,
                        insert, select, update)
from sqlalchemy.pool import NullPool

meta = MetaData()

students = Table(
    "sinaps_students", meta,
    Column("id", String(32), primary_key=True),
    Column("kelas", String(64)),
    Column("created_at", Float),
)
mastery = Table(
    "sinaps_mastery", meta,
    Column("student_id", String(32), primary_key=True),
    Column("kc", String(4), primary_key=True),
    Column("p", Float),
    Column("n_obs", Integer),
    Column("updated_at", Float),
)
attempts = Table(
    "sinaps_attempts", meta,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("student_id", String(32), index=True),
    Column("case_id", String(16)),
    Column("target_kc", String(8)),  # "K1".."K6" atau "bebas"
    Column("tier", String(8)),
    Column("started_at", Float),
    Column("submitted_at", Float),
    Column("answers", JSON),
    Column("result", JSON),
    Column("mastery_before", JSON),
    Column("mastery_after", JSON),
    Column("seq_order", JSON),
)
tutor_logs = Table(
    "sinaps_tutor_logs", meta,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("student_id", String(32), index=True),
    Column("attempt_id", Integer),
    Column("case_id", String(16)),
    Column("mode", String(16)),
    Column("phase", String(16)),
    Column("message", Text),
    Column("response", Text),
    Column("model", String(64)),
    Column("latency_ms", Integer),
    Column("facts", JSON),
    Column("created_at", Float),
)
# akun: mahasiswa ber-ID pseudonim NIM (NIM tidak disimpan), dosen ber-ID hash username
accounts = Table(
    "sinaps_accounts", meta,
    Column("id", String(32), primary_key=True),
    Column("role", String(12)),          # mahasiswa | dosen
    Column("username", String(64)),      # hanya dosen
    Column("nama", String(120)),
    Column("jenjang", String(24)),       # praklinik | klinik | internsip | residen
    Column("pw_hash", String(200)),
    Column("kelas_id", Integer),
    Column("created_at", Float),
    Column("last_seen", Float),
)
classes = Table(
    "sinaps_classes", meta,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("kode", String(8), unique=True),
    Column("nama", String(120)),
    Column("dosen_id", String(32), index=True),
    Column("created_at", Float),
)
assignments = Table(
    "sinaps_assignments", meta,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("kelas_id", Integer, index=True),
    Column("dosen_id", String(32)),
    Column("judul", String(160)),
    Column("catatan", Text),
    Column("case_ids", JSON),
    Column("lesson_ids", JSON),
    Column("due_at", Float),
    Column("created_at", Float),
)
lessons = Table(
    "sinaps_lessons", meta,
    Column("student_id", String(32), primary_key=True),
    Column("lesson_id", String(32), primary_key=True),
    Column("quiz_score", Float),
    Column("best_score", Float),
    Column("n_tries", Integer),
    Column("completed_at", Float),
    Column("updated_at", Float),
)
case_reviews = Table(
    "sinaps_case_reviews", meta,
    Column("case_id", String(16), primary_key=True),
    Column("status", String(16)),        # disetujui | perlu_tinjau | ditolak
    Column("catatan", Text),
    Column("dosen_id", String(32)),
    Column("updated_at", Float),
)


def _url():
    url = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
    if url:
        if url.startswith("postgres://"):
            url = "postgresql://" + url[len("postgres://"):]
        if url.startswith("postgresql://"):
            url = "postgresql+psycopg://" + url[len("postgresql://"):]
        return url
    base = Path("/tmp") if os.environ.get("VERCEL") else Path(__file__).resolve().parents[1] / ".local"
    base.mkdir(parents=True, exist_ok=True)
    return f"sqlite:///{base / 'sinaps.db'}"


@lru_cache(maxsize=1)
def engine():
    url = _url()
    kw = {}
    if url.startswith("postgresql"):
        # pooler Supabase/Neon mode transaksi: tanpa prepared statement, tanpa pool di sisi fungsi
        kw = {"poolclass": NullPool, "connect_args": {"prepare_threshold": None, "connect_timeout": 10}}
    eng = create_engine(url, **kw)
    meta.create_all(eng)
    if url.startswith("postgresql"):
        # Supabase membuka schema public lewat REST API (anon key). RLS tanpa policy menutup akses itu;
        # API ini konek sebagai pemilik tabel sehingga tidak terkena RLS.
        with eng.begin() as c:
            for t in meta.sorted_tables:
                c.exec_driver_sql(f"ALTER TABLE {t.name} ENABLE ROW LEVEL SECURITY")
    return eng


def backend():
    return "postgres" if _url().startswith("postgresql") else "sqlite"


def ensure_student(sid, kelas):
    with engine().begin() as c:
        if not c.execute(select(students.c.id).where(students.c.id == sid)).first():
            c.execute(insert(students).values(id=sid, kelas=kelas, created_at=time.time()))


def get_mastery(sid, initial):
    with engine().connect() as c:
        rows = c.execute(select(mastery).where(mastery.c.student_id == sid)).mappings().all()
    m = dict(initial)
    n = {k: 0 for k in initial}
    for r in rows:
        m[r["kc"]] = r["p"]
        n[r["kc"]] = r["n_obs"]
    return m, n


def set_mastery(sid, values, n_obs):
    now = time.time()
    with engine().begin() as c:
        for kc, p in values.items():
            res = c.execute(update(mastery).where((mastery.c.student_id == sid) & (mastery.c.kc == kc))
                            .values(p=p, n_obs=n_obs[kc], updated_at=now))
            if res.rowcount == 0:
                c.execute(insert(mastery).values(student_id=sid, kc=kc, p=p, n_obs=n_obs[kc], updated_at=now))


def start_attempt(sid, case_id, target_kc, tier, mastery_before, seq_order):
    with engine().begin() as c:
        r = c.execute(insert(attempts).values(student_id=sid, case_id=case_id, target_kc=target_kc, tier=tier,
                                              started_at=time.time(), mastery_before=mastery_before,
                                              seq_order=seq_order))
        return int(r.inserted_primary_key[0])


def get_attempt(aid):
    with engine().connect() as c:
        r = c.execute(select(attempts).where(attempts.c.id == aid)).mappings().first()
        return dict(r) if r else None


def set_answers(aid, answers):
    with engine().begin() as c:
        c.execute(update(attempts).where(attempts.c.id == aid).values(answers=answers))


def finish_attempt(aid, answers, result, mastery_after):
    with engine().begin() as c:
        c.execute(update(attempts).where(attempts.c.id == aid).values(
            submitted_at=time.time(), answers=answers, result=result, mastery_after=mastery_after))


def list_attempts(sid=None, limit=500):
    q = select(attempts).order_by(attempts.c.id.desc()).limit(limit)
    if sid:
        q = q.where(attempts.c.student_id == sid)
    with engine().connect() as c:
        return [dict(r) for r in c.execute(q).mappings().all()]


def log_tutor(**kw):
    kw["created_at"] = time.time()
    with engine().begin() as c:
        c.execute(insert(tutor_logs).values(**kw))


def list_tutor(limit=200, sid=None, attempt_id=None):
    q = select(tutor_logs).order_by(tutor_logs.c.id.desc()).limit(limit)
    if sid:
        q = q.where(tutor_logs.c.student_id == sid)
    if attempt_id:
        q = q.where(tutor_logs.c.attempt_id == attempt_id)
    with engine().connect() as c:
        return [dict(r) for r in c.execute(q).mappings().all()]


def all_mastery():
    with engine().connect() as c:
        rows = c.execute(select(mastery)).mappings().all()
        studs = c.execute(select(students)).mappings().all()
    return [dict(r) for r in rows], [dict(s) for s in studs]


# --- akun & kelas -------------------------------------------------------------

def get_account(aid):
    with engine().connect() as c:
        r = c.execute(select(accounts).where(accounts.c.id == aid)).mappings().first()
        return dict(r) if r else None


def create_account(**kw):
    kw.setdefault("created_at", time.time())
    kw.setdefault("last_seen", time.time())
    with engine().begin() as c:
        c.execute(insert(accounts).values(**kw))
    return get_account(kw["id"])


def update_account(aid, **kw):
    with engine().begin() as c:
        c.execute(update(accounts).where(accounts.c.id == aid).values(**kw))


def list_accounts(role=None, kelas_ids=None):
    q = select(accounts)
    if role:
        q = q.where(accounts.c.role == role)
    if kelas_ids is not None:
        q = q.where(accounts.c.kelas_id.in_(list(kelas_ids) or [-1]))
    with engine().connect() as c:
        return [dict(r) for r in c.execute(q).mappings().all()]


def get_class(kid=None, kode=None):
    q = select(classes)
    q = q.where(classes.c.id == kid) if kid is not None else q.where(classes.c.kode == (kode or "").strip().upper())
    with engine().connect() as c:
        r = c.execute(q).mappings().first()
        return dict(r) if r else None


def create_class(nama, dosen_id, kode):
    with engine().begin() as c:
        r = c.execute(insert(classes).values(nama=nama, dosen_id=dosen_id, kode=kode, created_at=time.time()))
        return int(r.inserted_primary_key[0])


def list_classes(dosen_id=None):
    q = select(classes).order_by(classes.c.id)
    if dosen_id:
        q = q.where(classes.c.dosen_id == dosen_id)
    with engine().connect() as c:
        return [dict(r) for r in c.execute(q).mappings().all()]


def update_class(kid, **kw):
    with engine().begin() as c:
        c.execute(update(classes).where(classes.c.id == kid).values(**kw))


def delete_class(kid):
    with engine().begin() as c:
        c.execute(update(accounts).where(accounts.c.kelas_id == kid).values(kelas_id=None))
        c.execute(delete(assignments).where(assignments.c.kelas_id == kid))
        c.execute(delete(classes).where(classes.c.id == kid))


# --- tugas --------------------------------------------------------------------

def create_assignment(**kw):
    kw["created_at"] = time.time()
    with engine().begin() as c:
        r = c.execute(insert(assignments).values(**kw))
        return int(r.inserted_primary_key[0])


def list_assignments(kelas_ids):
    q = (select(assignments).where(assignments.c.kelas_id.in_(list(kelas_ids) or [-1]))
         .order_by(assignments.c.id.desc()))
    with engine().connect() as c:
        return [dict(r) for r in c.execute(q).mappings().all()]


def get_assignment(tid):
    with engine().connect() as c:
        r = c.execute(select(assignments).where(assignments.c.id == tid)).mappings().first()
        return dict(r) if r else None


def delete_assignment(tid):
    with engine().begin() as c:
        c.execute(delete(assignments).where(assignments.c.id == tid))


# --- modul belajar ----------------------------------------------------------------

def save_lesson(sid, lesson_id, score, completed):
    now = time.time()
    key = (lessons.c.student_id == sid) & (lessons.c.lesson_id == lesson_id)
    with engine().begin() as c:
        cur = c.execute(select(lessons).where(key)).mappings().first()
        if cur:
            c.execute(update(lessons).where(key).values(
                quiz_score=score if score is not None else cur["quiz_score"],
                best_score=max(cur["best_score"] or 0, score or 0),
                n_tries=(cur["n_tries"] or 0) + (1 if score is not None else 0),
                completed_at=cur["completed_at"] or (now if completed else None), updated_at=now))
        else:
            c.execute(insert(lessons).values(student_id=sid, lesson_id=lesson_id, quiz_score=score,
                                             best_score=score or 0, n_tries=1 if score is not None else 0,
                                             completed_at=now if completed else None, updated_at=now))


def list_lessons(sids):
    q = select(lessons).where(lessons.c.student_id.in_(list(sids) or ["-"]))
    with engine().connect() as c:
        return [dict(r) for r in c.execute(q).mappings().all()]


# --- verifikasi kasus ---------------------------------------------------------------

def case_review_map():
    with engine().connect() as c:
        return {r["case_id"]: dict(r) for r in c.execute(select(case_reviews)).mappings().all()}


def set_case_review(case_id, status, catatan, dosen_id):
    now = time.time()
    with engine().begin() as c:
        res = c.execute(update(case_reviews).where(case_reviews.c.case_id == case_id).values(
            status=status, catatan=catatan, dosen_id=dosen_id, updated_at=now))
        if res.rowcount == 0:
            c.execute(insert(case_reviews).values(case_id=case_id, status=status, catatan=catatan,
                                                  dosen_id=dosen_id, updated_at=now))


# --- kueri per kelompok mahasiswa (dasbor dosen) -------------------------------------

def list_attempts_for(sids, limit=5000):
    q = (select(attempts).where(attempts.c.student_id.in_(list(sids) or ["-"]))
         .order_by(attempts.c.id.desc()).limit(limit))
    with engine().connect() as c:
        return [dict(r) for r in c.execute(q).mappings().all()]


def list_tutor_for(sids, limit=300):
    q = (select(tutor_logs).where(tutor_logs.c.student_id.in_(list(sids) or ["-"]))
         .order_by(tutor_logs.c.id.desc()).limit(limit))
    with engine().connect() as c:
        return [dict(r) for r in c.execute(q).mappings().all()]


def mastery_for(sids):
    q = select(mastery).where(mastery.c.student_id.in_(list(sids) or ["-"]))
    with engine().connect() as c:
        return [dict(r) for r in c.execute(q).mappings().all()]


def dumps(o):
    return json.dumps(o, ensure_ascii=False, default=str)
