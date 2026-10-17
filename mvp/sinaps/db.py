"""Penyimpanan log belajar berpseudonim.

DATABASE_URL (Postgres: Supabase/Neon) dipakai bila ada; tanpa itu jatuh ke SQLite lokal
(di Vercel: /tmp, sementara). Hanya pseudonim yang disimpan, tidak pernah NIM atau nama.
"""
import json
import os
import time
from functools import lru_cache
from pathlib import Path

from sqlalchemy import (JSON, Column, Float, Integer, MetaData, String, Table, Text, create_engine,
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


def dumps(o):
    return json.dumps(o, ensure_ascii=False, default=str)
