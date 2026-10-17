"""SINAPS - orkestrator API (FastAPI). Di Vercel berjalan sebagai Python Function; lokal: uvicorn api.index:app."""
import csv
import io
import os
import random
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import Depends, FastAPI, Header, HTTPException  # noqa: E402
from fastapi.responses import Response  # noqa: E402
from pydantic import BaseModel  # noqa: E402

from sinaps import auth, bkt, cases, db, grading, tutor  # noqa: E402

app = FastAPI(title="SINAPS API", version="0.2.0")
LABELS = ["A", "B", "C"]
JENJANG = {"praklinik": "Mahasiswa praklinik", "klinik": "Mahasiswa klinik (koas)", "internsip": "Dokter internsip",
           "residen": "Residen"}
# kasus contoh di modul belajar: kuncinya ditampilkan, jadi tidak dipakai untuk latihan bernilai
TEACHING = {"sub-754": "Restriksi difusi sejati", "sub-1320": "T2 shine-through", "sub-652": "Lesi tiga fokus"}
LESSON_IDS = ["orientasi", "k1", "k2", "k3", "k6", "k4k5"]
REVIEW_STATUS = ("disetujui", "perlu_tinjau", "ditolak")


# --- util ---------------------------------------------------------------------

def profile(m, acct=None):
    active = {k: v for k, v in m.items() if bkt.KC[k]["aktif"]}
    weakest = min(active, key=active.get)
    p = {"kc_terlemah": f"{weakest} {bkt.KC[weakest]['nama']}", "penguasaan": {k: round(v, 2) for k, v in m.items()}}
    if acct and acct.get("jenjang"):
        p["jenjang"] = JENJANG.get(acct["jenjang"], acct["jenjang"])
    return p


def practice_cases():
    """Bank kasus untuk latihan: tanpa kasus contoh ajar dan kasus yang ditolak dosen pada verifikasi."""
    rejected = {k for k, r in db.case_review_map().items() if r["status"] == "ditolak"}
    return [c for c in cases.all_cases() if c["id"] not in TEACHING and c["id"] not in rejected]


def public_user(a):
    out = {"id": a["id"], "role": a["role"], "nama": a["nama"], "jenjang": a.get("jenjang"),
           "username": a.get("username")}
    if a["role"] == "mahasiswa":
        k = db.get_class(a["kelas_id"]) if a.get("kelas_id") else None
        dosen = db.get_account(k["dosen_id"]) if k else None
        out["kelas"] = {"id": k["id"], "nama": k["nama"], "kode": k["kode"],
                        "dosen": dosen["nama"] if dosen else None} if k else None
    return out


def current(authorization: str | None = Header(default=None)):
    token = (authorization or "").removeprefix("Bearer ").strip()
    body = auth.read_token(token) if token else None
    if not body:
        raise HTTPException(401, "Sesi berakhir, silakan masuk lagi")
    a = db.get_account(body["sub"])
    if not a or auth.pw_version(a["pw_hash"]) != body.get("v"):
        raise HTTPException(401, "Sesi berakhir, silakan masuk lagi")
    now = time.time()
    if now - (a.get("last_seen") or 0) > 300:
        db.update_account(a["id"], last_seen=now)
    return a


def student(a=Depends(current)):
    if a["role"] != "mahasiswa":
        raise HTTPException(403, "Halaman ini untuk akun mahasiswa")
    return a


def dosen(a=Depends(current)):
    if a["role"] != "dosen":
        raise HTTPException(403, "Halaman ini untuk akun dosen")
    return a


def my_classes(d):
    return {k["id"]: k for k in db.list_classes(d["id"])}


def my_students(d, kelas_id=None):
    ks = my_classes(d)
    ids = [kelas_id] if kelas_id in ks else list(ks)
    return db.list_accounts("mahasiswa", ids), ks


def own_student(d, sid):
    s = db.get_account(sid)
    if not s or s["role"] != "mahasiswa" or s.get("kelas_id") not in my_classes(d):
        raise HTTPException(404, "Mahasiswa tidak ditemukan di kelas Anda")
    return s


def _dl(a):
    return (a.get("result") or {}).get("delineasi") or {}


def attempt_row(a):
    d = _dl(a)
    return {"id": a["id"], "case_id": a["case_id"], "target_kc": a["target_kc"], "tier": a["tier"],
            "started_at": a["started_at"], "submitted_at": a["submitted_at"],
            "kc": {k: v["benar"] for k, v in ((a.get("result") or {}).get("kc") or {}).items()},
            "dice": d.get("dice"), "lesion_recall": d.get("lesion_recall"), "jenis": d.get("jenis_kesalahan_label")}


def assignment_status(t, done_cases, lesson_done):
    cs = t.get("case_ids") or []
    ls = t.get("lesson_ids") or []
    n_done = sum(1 for c in cs if c in done_cases) + sum(1 for l in ls if l in lesson_done)
    total = len(cs) + len(ls)
    return {"selesai": n_done, "total": total, "tuntas": total > 0 and n_done == total}


# --- publik -------------------------------------------------------------------

@app.get("/api/health")
def health():
    return {"ok": True, "db": db.backend(), "llm": bool(os.environ.get("OPENAI_API_KEY")), "model": tutor.MODEL,
            "cases": len(cases.all_cases()), "dosen_key_default": auth.DOSEN_KEY_DEFAULT}


@app.get("/api/kc")
def kc():
    return {"kc": bkt.KC, "params": bkt.PARAMS, "mastered": bkt.MASTERED, "adc_bins": [b[0] for b in grading.ADC_BINS],
            "error_types": grading.ERROR_TYPES, "thresholds": grading.THRESHOLDS, "jenjang": JENJANG}


@app.get("/api/stats")
def stats():
    """Angka ringkas untuk halaman depan."""
    return {"cases": len(cases.all_cases()), "practice_cases": len(practice_cases()),
            "kc_aktif": sum(1 for v in bkt.KC.values() if v["aktif"]), "kc_total": len(bkt.KC)}


# --- autentikasi --------------------------------------------------------------

class RegisterStudent(BaseModel):
    nama: str
    nim: str
    password: str
    jenjang: str = "klinik"
    kode_kelas: str | None = None


class RegisterDosen(BaseModel):
    nama: str
    username: str
    password: str
    kode_dosen: str


class LoginReq(BaseModel):
    role: str = "mahasiswa"
    id: str            # NIM (mahasiswa) atau username (dosen)
    password: str


def _check_pw(pw):
    if len(pw) < 6:
        raise HTTPException(400, "Kata sandi minimal 6 karakter")


@app.post("/api/auth/register")
def register(body: RegisterStudent):
    nama = body.nama.strip()
    nim = body.nim.strip()
    if len(nama) < 2:
        raise HTTPException(400, "Nama wajib diisi")
    if not re.fullmatch(r"[A-Za-z0-9.\-]{4,24}", nim):
        raise HTTPException(400, "NIM hanya boleh huruf/angka, 4-24 karakter")
    _check_pw(body.password)
    if body.jenjang not in JENJANG:
        raise HTTPException(400, "Jenjang tidak dikenal")
    kelas_id = None
    if body.kode_kelas and body.kode_kelas.strip():
        k = db.get_class(kode=body.kode_kelas)
        if not k:
            raise HTTPException(400, "Kode kelas tidak ditemukan. Tanyakan kode kelas kepada dosen Anda.")
        kelas_id = k["id"]
    sid = auth.pseudonym(nim)
    if db.get_account(sid):
        raise HTTPException(409, "NIM ini sudah terdaftar. Silakan masuk.")
    a = db.create_account(id=sid, role="mahasiswa", nama=nama[:120], jenjang=body.jenjang,
                          pw_hash=auth.hash_password(body.password), kelas_id=kelas_id)
    return {"token": auth.make_token(a), "user": public_user(a)}


@app.post("/api/auth/register-dosen")
def register_dosen(body: RegisterDosen):
    if body.kode_dosen.strip() != auth.DOSEN_KEY:
        raise HTTPException(403, "Kode pendaftaran dosen salah")
    nama, user = body.nama.strip(), body.username.strip().lower()
    if len(nama) < 2:
        raise HTTPException(400, "Nama wajib diisi")
    if not re.fullmatch(r"[a-z0-9._\-]{3,32}", user):
        raise HTTPException(400, "Username 3-32 karakter: huruf kecil, angka, titik, garis bawah")
    _check_pw(body.password)
    did = auth.dosen_id(user)
    if db.get_account(did):
        raise HTTPException(409, "Username sudah dipakai")
    a = db.create_account(id=did, role="dosen", username=user, nama=nama[:120],
                          pw_hash=auth.hash_password(body.password))
    return {"token": auth.make_token(a), "user": public_user(a)}


@app.post("/api/auth/login")
def login(body: LoginReq):
    aid = auth.dosen_id(body.id) if body.role == "dosen" else auth.pseudonym(body.id)
    a = db.get_account(aid)
    if not a or a["role"] != body.role or not auth.check_password(body.password, a["pw_hash"]):
        raise HTTPException(401, ("Username" if body.role == "dosen" else "NIM") + " atau kata sandi salah")
    db.update_account(a["id"], last_seen=time.time())
    return {"token": auth.make_token(a), "user": public_user(a)}


@app.get("/api/auth/me")
def auth_me(a=Depends(current)):
    return public_user(a)


class PasswordReq(BaseModel):
    lama: str
    baru: str


@app.post("/api/auth/password")
def change_password(body: PasswordReq, a=Depends(current)):
    if not auth.check_password(body.lama, a["pw_hash"]):
        raise HTTPException(400, "Kata sandi lama salah")
    _check_pw(body.baru)
    a["pw_hash"] = auth.hash_password(body.baru)
    db.update_account(a["id"], pw_hash=a["pw_hash"])
    return {"token": auth.make_token(a)}


class ProfileReq(BaseModel):
    nama: str | None = None
    jenjang: str | None = None


@app.patch("/api/auth/profile")
def update_profile(body: ProfileReq, a=Depends(current)):
    kw = {}
    if body.nama is not None and len(body.nama.strip()) >= 2:
        kw["nama"] = body.nama.strip()[:120]
    if body.jenjang is not None and a["role"] == "mahasiswa":
        if body.jenjang not in JENJANG:
            raise HTTPException(400, "Jenjang tidak dikenal")
        kw["jenjang"] = body.jenjang
    if kw:
        db.update_account(a["id"], **kw)
    return public_user(db.get_account(a["id"]))


class JoinReq(BaseModel):
    kode: str


@app.post("/api/kelas/join")
def join_class(body: JoinReq, a=Depends(student)):
    k = db.get_class(kode=body.kode)
    if not k:
        raise HTTPException(404, "Kode kelas tidak ditemukan")
    db.update_account(a["id"], kelas_id=k["id"])
    return public_user(db.get_account(a["id"]))


# --- mahasiswa: progres, tugas, modul -------------------------------------------

@app.get("/api/me")
def me(a=Depends(student)):
    sid = a["id"]
    m, n = db.get_mastery(sid, bkt.initial())
    atts = db.list_attempts(sid, 300)
    done = [x for x in atts if x["submitted_at"]]
    les = {r["lesson_id"]: r for r in db.list_lessons([sid])}
    k, blocked = bkt.choose_target(m)
    dices = [_dl(x)["dice"] for x in done if _dl(x).get("dice") is not None]
    return {
        "user": public_user(a), "mastery": m, "n_obs": n, "kc": bkt.KC,
        "attempts": [attempt_row(x) for x in atts if x["submitted_at"]],
        "lessons": {lid: {"best_score": r["best_score"], "completed": r["completed_at"] is not None,
                          "n_tries": r["n_tries"]} for lid, r in les.items()},
        "rekomendasi": {"kc": k, "nama": bkt.KC[k]["nama"], "p": m[k],
                        "lesson": k.lower() if k.lower() in LESSON_IDS else None},
        "ringkas": {"n_kasus": len(done), "mean_dice": sum(dices) / len(dices) if dices else None,
                    "kc_dikuasai": sum(1 for kk, v in m.items() if bkt.KC[kk]["aktif"] and v >= bkt.MASTERED)},
        "assignments": _student_assignments(a, done, les),
    }


def _student_assignments(a, done=None, les=None):
    if not a.get("kelas_id"):
        return []
    if done is None:
        done = [x for x in db.list_attempts(a["id"], 500) if x["submitted_at"]]
    if les is None:
        les = {r["lesson_id"]: r for r in db.list_lessons([a["id"]])}
    out = []
    for t in db.list_assignments([a["kelas_id"]]):
        done_cases = {x["case_id"] for x in done if x["submitted_at"] >= t["created_at"]}
        lesson_done = {lid for lid, r in les.items() if r["completed_at"]}
        out.append({"id": t["id"], "judul": t["judul"], "catatan": t["catatan"], "due_at": t["due_at"],
                    "created_at": t["created_at"], "case_ids": t["case_ids"] or [], "lesson_ids": t["lesson_ids"] or [],
                    "cases_done": [c for c in (t["case_ids"] or []) if c in done_cases],
                    "lessons_done": [l for l in (t["lesson_ids"] or []) if l in lesson_done],
                    **assignment_status(t, done_cases, lesson_done)})
    return out


@app.get("/api/assignments")
def student_assignments(a=Depends(student)):
    return _student_assignments(a)


class LessonReq(BaseModel):
    quiz_score: float | None = None
    completed: bool = False


@app.post("/api/lessons/{lesson_id}")
def save_lesson(lesson_id: str, body: LessonReq, a=Depends(student)):
    if lesson_id not in LESSON_IDS:
        raise HTTPException(404, "modul tidak ditemukan")
    score = None if body.quiz_score is None else max(0.0, min(1.0, body.quiz_score))
    db.save_lesson(a["id"], lesson_id, score, body.completed)
    return {"ok": True}


@app.get("/api/contoh/{case_id}")
def teaching_case(case_id: str, a=Depends(current)):
    """Kasus contoh di modul belajar: citra + kunci jawaban + temuan terstruktur terbuka."""
    if case_id not in TEACHING:
        raise HTTPException(404, "bukan kasus contoh")
    secret = cases.secrets()[case_id]
    seqs = list(secret["sequences"].items())
    mk = cases.masks(case_id)
    return {"case": cases.public_case(case_id), "judul": TEACHING[case_id],
            "series": [{"label": name, "file": f"/cases/{case_id}/{fid}.bin"} for name, fid in seqs],
            "findings": secret["findings"], "gt_rle": cases.rle_encode(mk["gt"])}


# --- siklus latihan ----------------------------------------------------------------

def _open(a, case_id, target_kc, tier, reason, m, blocked):
    secret = cases.secrets()[case_id]
    order = list(secret["sequences"].items())
    random.shuffle(order)
    seq_order = {LABELS[i]: name for i, (name, _) in enumerate(order)}
    aid = db.start_attempt(a["id"], case_id, target_kc, tier, m, seq_order)
    return _attempt_payload(db.get_attempt(aid), reason, blocked, m)


def _attempt_payload(att, reason, blocked, m):
    case_id = att["case_id"]
    seqs = cases.secrets()[case_id]["sequences"]
    order = att["seq_order"]
    k1 = (att.get("answers") or {}).get("k1")
    return {
        "attempt_id": att["id"], "case": cases.public_case(case_id), "target_kc": att["target_kc"], "tier": att["tier"],
        "reason": reason, "blocked": blocked, "mastery": m,
        "series": [{"label": lbl, "file": f"/cases/{case_id}/{seqs[order[lbl]]}.bin"} for lbl in LABELS if lbl in order],
        # K1 yang sudah dikunci sebelum halaman dimuat ulang
        "k1": k1, "seq_order": order if k1 else None,
    }


@app.get("/api/next")
def next_case(kc: str | None = None, baru: bool = False, a=Depends(student)):
    m, _ = db.get_mastery(a["id"], bkt.initial())
    atts = db.list_attempts(a["id"], 500)
    if not baru and not kc:
        # lanjutkan kasus adaptif yang belum dikirim (mis. setelah memuat ulang halaman)
        pending = next((x for x in atts if not x["submitted_at"] and x["target_kc"] != "bebas"
                        and time.time() - x["started_at"] < 6 * 3600), None)
        if pending and pending["case_id"] in cases.secrets():
            return _attempt_payload(pending, "Melanjutkan kasus yang belum selesai", [], m)
    seen = {x["case_id"] for x in atts if x["submitted_at"]}
    k, want, tier, case, blocked = bkt.choose_case(practice_cases(), m, seen, kc)
    if kc and k == kc:
        reason = f"Latihan terarah {k} {bkt.KC[k]['nama']} (penguasaan {m[k]:.0%}) -> tingkat {want}"
    else:
        reason = (f"KC terlemah yang prasyaratnya terpenuhi: {k} {bkt.KC[k]['nama']} "
                  f"(penguasaan {m[k]:.0%}) -> tingkat {want}")
    if tier != want:
        reason += f" (habis, dipakai {tier})"
    return _open(a, case["id"], k, tier, reason, m, blocked)


@app.get("/api/open/{case_id}")
def open_case(case_id: str, a=Depends(student)):
    if case_id not in cases.secrets() or case_id in TEACHING:
        raise HTTPException(404, "kasus tidak ditemukan")
    m, _ = db.get_mastery(a["id"], bkt.initial())
    pub = cases.public_case(case_id)
    return _open(a, case_id, "bebas", pub["tier"], "Kasus dipilih sendiri dari bank kasus", m, [])


@app.get("/api/cases")
def list_cases(a=Depends(current)):
    done = {}
    if a["role"] == "mahasiswa":
        for x in db.list_attempts(a["id"], 500):
            if x["submitted_at"]:
                done.setdefault(x["case_id"], _dl(x).get("dice"))
    return [{"id": c["id"], "tier": c["tier"], "D": c["D"], "vignette": c["vignette"],
             "dikerjakan": c["id"] in done, "dice": done.get(c["id"])} for c in practice_cases()]


def _attempt(sid, aid):
    att = db.get_attempt(aid)
    if not att or att["student_id"] != sid:
        raise HTTPException(404, "percobaan tidak ditemukan")
    return att


class Reveal(BaseModel):
    attempt_id: int
    k1: dict[str, str]


@app.post("/api/reveal")
def reveal(body: Reveal, a=Depends(student)):
    """K1: kunci jawaban pengenalan sekuens, lalu buka label seri supaya langkah berikutnya memakai nama sekuens."""
    att = _attempt(a["id"], body.attempt_id)
    answers = dict(att["answers"] or {})
    if "k1" not in answers:
        answers["k1"] = body.k1
        db.set_answers(body.attempt_id, answers)
    truth = att["seq_order"]
    return {"seq_order": truth, "benar": all(answers["k1"].get(lbl) == n for lbl, n in truth.items())}


class Submit(BaseModel):
    attempt_id: int
    k1: dict[str, str] | None = None          # {"A": "DWI", "B": "ADC", "C": "FLAIR"}
    k2_point: list[float] | None = None       # [x, y, z] voxel, berbasis 0
    k2_hemisfer: str | None = None            # kiri | kanan | bilateral
    k3_adc_bin: str | None = None
    k3_restriksi: bool | None = None
    mask_rle: list[int] | None = None


def _reveal_payload(att):
    case_id = att["case_id"]
    secret = cases.secrets()[case_id]
    mk = cases.masks(case_id)
    return {"findings": secret["findings"], "model": secret.get("model"), "luaran": secret.get("luaran"),
            "seq_order": att["seq_order"], "gt_rle": cases.rle_encode(mk["gt"]),
            "pred_rle": cases.rle_encode(mk["pred"]) if "pred" in mk else None}


@app.post("/api/submit")
def submit(body: Submit, a=Depends(student)):
    sid = a["id"]
    att = _attempt(sid, body.attempt_id)
    if att["submitted_at"]:
        raise HTTPException(409, "jawaban kasus ini sudah dikirim")
    body.k1 = (att["answers"] or {}).get("k1") or body.k1
    case_id = att["case_id"]
    pub = cases.public_case(case_id)
    f = cases.secrets()[case_id]["findings"]
    g = cases.masks(case_id)["gt"]
    shape = tuple(pub["dimensions"])
    res = {"kc": {}}

    if body.k1:
        truth = att["seq_order"]
        ok = all(body.k1.get(lbl) == name for lbl, name in truth.items())
        res["kc"]["K1"] = {"benar": ok, "jawaban": body.k1, "kunci": truth}
    if body.k2_point is not None or body.k2_hemisfer:
        in_lesion = grading.grade_point(body.k2_point, g)
        hemi_ok = body.k2_hemisfer == f["hemisfer"]
        res["kc"]["K2"] = {"benar": in_lesion and hemi_ok, "titik_di_lesi": in_lesion,
                           "hemisfer_benar": hemi_ok, "jawaban_hemisfer": body.k2_hemisfer, "kunci_hemisfer": f["hemisfer"]}
    if body.k3_adc_bin or body.k3_restriksi is not None:
        key_bin = grading.adc_bin(f["adc_relatif_lesi"])
        ok_bin = body.k3_adc_bin == key_bin
        ok_r = body.k3_restriksi == f["restriksi_sejati"]
        res["kc"]["K3"] = {"benar": ok_bin and ok_r, "rentang_benar": ok_bin, "restriksi_benar": ok_r,
                           "jawaban_rentang": body.k3_adc_bin, "kunci_rentang": key_bin,
                           "adc_relatif_lesi": f["adc_relatif_lesi"], "kunci_restriksi": f["restriksi_sejati"]}
    if body.mask_rle is not None:
        try:
            p = cases.rle_decode(body.mask_rle, shape)
        except ValueError as e:
            raise HTTPException(400, str(e))
        d = grading.grade_delineation(p, g, cases.spacing(case_id))
        res["delineasi"] = d
        res["kc"]["K6"] = {"benar": d["benar"], "dice": d["dice"], "lesion_recall": d["lesion_recall"],
                           "jenis_kesalahan": d["jenis_kesalahan_label"]}

    before, n = db.get_mastery(sid, bkt.initial())
    after = dict(before)
    for k, r in res["kc"].items():
        after[k] = bkt.update(after[k], r["benar"])
        n[k] += 1
    db.set_mastery(sid, after, n)
    res["mastery_before"], res["mastery_after"] = before, after
    # mask disimpan supaya bisa ditinjau ulang oleh mahasiswa dan dosen
    db.finish_attempt(body.attempt_id, body.model_dump(), res, after)
    return {**res, **_reveal_payload(att)}


@app.get("/api/attempts/{aid}")
def attempt_detail(aid: int, a=Depends(current)):
    """Tinjau ulang satu percobaan yang sudah dikirim (mahasiswa pemiliknya atau dosen kelasnya)."""
    att = db.get_attempt(aid)
    if not att:
        raise HTTPException(404, "percobaan tidak ditemukan")
    if a["role"] == "mahasiswa" and att["student_id"] != a["id"]:
        raise HTTPException(404, "percobaan tidak ditemukan")
    if a["role"] == "dosen":
        own_student(a, att["student_id"])
    if not att["submitted_at"]:
        raise HTTPException(409, "percobaan ini belum dikirim")
    answers = dict(att["answers"] or {})
    payload = _attempt_payload(att, "", [], att["mastery_before"] or {})
    payload["seq_order"] = att["seq_order"]
    logs = db.list_tutor(100, attempt_id=aid)
    return {**payload, **att["result"], **_reveal_payload(att), "answers": answers,
            "mask_rle": answers.get("mask_rle"), "submitted_at": att["submitted_at"], "started_at": att["started_at"],
            "student_id": att["student_id"],
            "tutor": [{"mode": t["mode"], "phase": t["phase"], "message": t["message"], "response": t["response"],
                       "source": (t["facts"] or {}).get("source"),
                       "model": t["model"], "issues": (t["facts"] or {}).get("issues", []), "created_at": t["created_at"]}
                      for t in reversed(logs)]}


class TutorReq(BaseModel):
    attempt_id: int
    mode: str = "sokratik"
    message: str
    image: str | None = None
    history: list[dict] | None = None


@app.post("/api/tutor")
def ask_tutor(body: TutorReq, a=Depends(student)):
    att = _attempt(a["id"], body.attempt_id)
    if body.mode not in ("sokratik", "penjelasan", "rujukan"):
        raise HTTPException(400, "mode tidak dikenal")
    phase = "setelah_submit" if att["submitted_at"] else "sebelum_submit"
    m, _ = db.get_mastery(a["id"], bkt.initial())
    facts = tutor.build_facts(cases.public_case(att["case_id"]), cases.secrets()[att["case_id"]], phase,
                              att["result"], profile(m, a))
    out = tutor.ask(body.mode, facts, body.message[:2000], body.history, body.image)
    db.log_tutor(student_id=a["id"], attempt_id=body.attempt_id, case_id=att["case_id"], mode=body.mode[:16],
                 phase=phase, message=body.message[:2000], response=out["reply"], model=out["model"],
                 latency_ms=out["latency_ms"],
                 facts={"issues": out["issues"], "source": out["source"], "rujukan": facts.get("rujukan")})
    return {**out, "phase": phase, "rujukan": facts.get("rujukan")}


# --- dosen --------------------------------------------------------------------

def _mastery_by(sids):
    by = {}
    for r in db.mastery_for(sids):
        by.setdefault(r["student_id"], {})[r["kc"]] = {"p": r["p"], "n": r["n_obs"]}
    return by


@app.get("/api/dosen/overview")
def dosen_overview(kelas_id: int | None = None, d=Depends(dosen)):
    studs, ks = my_students(d, kelas_id)
    sids = [s["id"] for s in studs]
    by = _mastery_by(sids)
    atts = db.list_attempts_for(sids)
    done = [x for x in atts if x["submitted_at"]]
    les = db.list_lessons(sids)
    now = time.time()

    errs, dices = {}, []
    for x in done:
        dl = _dl(x)
        if dl:
            errs[dl["jenis_kesalahan_label"]] = errs.get(dl["jenis_kesalahan_label"], 0) + 1
            dices.append(dl["dice"])
    # aktivitas 14 hari terakhir
    days = []
    for i in range(13, -1, -1):
        start = (now // 86400 - i) * 86400
        days.append({"t": start, "n": sum(1 for x in done if start <= x["submitted_at"] < start + 86400)})
    # rerata penguasaan kelas per KC
    kc_avg = {}
    for k, info in bkt.KC.items():
        if info["aktif"]:
            vals = [by.get(s, {}).get(k, {}).get("p", bkt.PARAMS["L0"]) for s in sids]
            kc_avg[k] = {"mean": sum(vals) / len(vals) if vals else None,
                         "dikuasai": sum(1 for v in vals if v >= bkt.MASTERED)}

    rows = []
    for s in studs:
        mine = [x for x in done if x["student_id"] == s["id"]]
        dl = [_dl(x)["dice"] for x in mine if _dl(x).get("dice") is not None]
        last = max([s.get("last_seen") or 0] + [x["submitted_at"] for x in mine])
        m = {k: by.get(s["id"], {}).get(k, {}).get("p", bkt.PARAMS["L0"]) for k in bkt.KC}
        weakest = min((k for k in bkt.KC if bkt.KC[k]["aktif"]), key=lambda k: m[k])
        recent = [r["benar"] for x in mine[:5] for r in ((x["result"] or {}).get("kc") or {}).values()]
        flags = []
        if not mine:
            flags.append("belum berlatih")
        elif now - last > 7 * 86400:
            flags.append("tidak aktif > 7 hari")
        if len(recent) >= 6 and sum(recent) / len(recent) < 0.4:
            flags.append("banyak jawaban salah")
        rows.append({"sid": s["id"], "nama": s["nama"], "jenjang": s["jenjang"], "kelas_id": s["kelas_id"],
                     "kelas": ks.get(s["kelas_id"], {}).get("nama"), "mastery": by.get(s["id"], {}),
                     "n_kasus": len(mine), "mean_dice": sum(dl) / len(dl) if dl else None, "last_active": last,
                     "kc_terlemah": weakest, "flags": flags,
                     "modul_selesai": sum(1 for r in les if r["student_id"] == s["id"] and r["completed_at"])})
    logs = db.list_tutor_for(sids, 300)
    return {
        "kelas": [{"id": k["id"], "nama": k["nama"], "kode": k["kode"],
                   "n_mahasiswa": len(db.list_accounts("mahasiswa", [k["id"]]))} for k in ks.values()],
        "students": sorted(rows, key=lambda r: r["nama"].lower()),
        "kc": {k: v["nama"] for k, v in bkt.KC.items()}, "kc_avg": kc_avg,
        "error_counts": errs, "n_attempts": len(done), "mean_dice": sum(dices) / len(dices) if dices else None,
        "activity": days,
        # [mulai, kirim] tiap kasus yang dikirim, untuk peta jam belajar dan kalender aktivitas di dasbor
        "sessions": [[round(x["started_at"] or x["submitted_at"]), round(x["submitted_at"])] for x in done],
        "active_7d": sum(1 for r in rows if now - r["last_active"] <= 7 * 86400 and r["n_kasus"]),
        "flagged_tutor": sum(1 for t in logs if (t["facts"] or {}).get("issues")),
        "n_tutor": len(logs),
        "recent": [{**attempt_row(x), "sid": x["student_id"],
                    "nama": next((s["nama"] for s in studs if s["id"] == x["student_id"]), x["student_id"])}
                   for x in done[:30]],
        "db": db.backend(),
    }


@app.get("/api/dosen/students/{sid}")
def dosen_student(sid: str, d=Depends(dosen)):
    s = own_student(d, sid)
    m, n = db.get_mastery(sid, bkt.initial())
    atts = db.list_attempts(sid, 500)
    done = [x for x in atts if x["submitted_at"]]
    les = {r["lesson_id"]: r for r in db.list_lessons([sid])}
    # lintasan penguasaan: satu titik per kasus yang dikirim, urut waktu
    traj = [{"t": x["submitted_at"], "case_id": x["case_id"], "mastery": x["mastery_after"]}
            for x in sorted(done, key=lambda x: x["submitted_at"]) if x.get("mastery_after")]
    errs = {}
    for x in done:
        lbl = _dl(x).get("jenis_kesalahan_label")
        if lbl:
            errs[lbl] = errs.get(lbl, 0) + 1
    logs = db.list_tutor(200, sid=sid)
    return {
        "student": {**public_user(s), "last_seen": s.get("last_seen"), "created_at": s.get("created_at")},
        "mastery": m, "n_obs": n, "kc": bkt.KC, "trajectory": traj, "error_counts": errs,
        "attempts": [attempt_row(x) for x in done],
        "lessons": {lid: {"best_score": r["best_score"], "completed": r["completed_at"] is not None,
                          "n_tries": r["n_tries"], "updated_at": r["updated_at"]} for lid, r in les.items()},
        "assignments": _student_assignments(s, done, les),
        "tutor_logs": [{"id": t["id"], "attempt_id": t["attempt_id"], "case_id": t["case_id"], "mode": t["mode"],
                        "phase": t["phase"], "message": t["message"], "response": t["response"], "model": t["model"],
                        "latency_ms": t["latency_ms"], "issues": (t["facts"] or {}).get("issues", []),
                        "source": (t["facts"] or {}).get("source"), "created_at": t["created_at"]} for t in logs],
    }


@app.post("/api/dosen/students/{sid}/reset-password")
def dosen_reset_password(sid: str, d=Depends(dosen)):
    own_student(d, sid)
    pw = auth.temp_password()
    db.update_account(sid, pw_hash=auth.hash_password(pw))
    return {"password": pw}


class MoveReq(BaseModel):
    kelas_id: int | None = None


@app.post("/api/dosen/students/{sid}/kelas")
def dosen_move_student(sid: str, body: MoveReq, d=Depends(dosen)):
    own_student(d, sid)
    if body.kelas_id is not None and body.kelas_id not in my_classes(d):
        raise HTTPException(404, "kelas tidak ditemukan")
    db.update_account(sid, kelas_id=body.kelas_id)
    return {"ok": True}


class ClassReq(BaseModel):
    nama: str


@app.get("/api/dosen/kelas")
def dosen_classes(d=Depends(dosen)):
    return [{"id": k["id"], "nama": k["nama"], "kode": k["kode"], "created_at": k["created_at"],
             "n_mahasiswa": len(db.list_accounts("mahasiswa", [k["id"]]))} for k in my_classes(d).values()]


@app.post("/api/dosen/kelas")
def dosen_create_class(body: ClassReq, d=Depends(dosen)):
    nama = body.nama.strip()
    if len(nama) < 2:
        raise HTTPException(400, "Nama kelas wajib diisi")
    for _ in range(10):
        kode = auth.class_code()
        if not db.get_class(kode=kode):
            break
    kid = db.create_class(nama[:120], d["id"], kode)
    return db.get_class(kid)


@app.patch("/api/dosen/kelas/{kid}")
def dosen_rename_class(kid: int, body: ClassReq, d=Depends(dosen)):
    if kid not in my_classes(d):
        raise HTTPException(404, "kelas tidak ditemukan")
    db.update_class(kid, nama=body.nama.strip()[:120])
    return db.get_class(kid)


@app.post("/api/dosen/kelas/{kid}/kode-baru")
def dosen_new_code(kid: int, d=Depends(dosen)):
    if kid not in my_classes(d):
        raise HTTPException(404, "kelas tidak ditemukan")
    kode = auth.class_code()
    while db.get_class(kode=kode):
        kode = auth.class_code()
    db.update_class(kid, kode=kode)
    return db.get_class(kid)


@app.delete("/api/dosen/kelas/{kid}")
def dosen_delete_class(kid: int, d=Depends(dosen)):
    if kid not in my_classes(d):
        raise HTTPException(404, "kelas tidak ditemukan")
    db.delete_class(kid)
    return {"ok": True}


class AssignmentReq(BaseModel):
    kelas_id: int
    judul: str
    catatan: str | None = None
    case_ids: list[str] = []
    lesson_ids: list[str] = []
    due_at: float | None = None


@app.get("/api/dosen/assignments")
def dosen_assignments(d=Depends(dosen)):
    ks = my_classes(d)
    out = []
    for t in db.list_assignments(list(ks)):
        studs = db.list_accounts("mahasiswa", [t["kelas_id"]])
        sids = [s["id"] for s in studs]
        done_by = {}
        for x in db.list_attempts_for(sids):
            if x["submitted_at"] and x["submitted_at"] >= t["created_at"]:
                done_by.setdefault(x["student_id"], set()).add(x["case_id"])
        les_by = {}
        for r in db.list_lessons(sids):
            if r["completed_at"]:
                les_by.setdefault(r["student_id"], set()).add(r["lesson_id"])
        progress = [{"sid": s["id"], "nama": s["nama"],
                     **assignment_status(t, done_by.get(s["id"], set()), les_by.get(s["id"], set())),
                     "cases_done": sorted(done_by.get(s["id"], set()) & set(t["case_ids"] or [])),
                     "lessons_done": sorted(les_by.get(s["id"], set()) & set(t["lesson_ids"] or []))} for s in studs]
        out.append({**{k: t[k] for k in ("id", "kelas_id", "judul", "catatan", "case_ids", "lesson_ids", "due_at",
                                         "created_at")},
                    "kelas": ks[t["kelas_id"]]["nama"], "progress": sorted(progress, key=lambda p: p["nama"].lower()),
                    "n_tuntas": sum(1 for p in progress if p["tuntas"])})
    return out


@app.post("/api/dosen/assignments")
def dosen_create_assignment(body: AssignmentReq, d=Depends(dosen)):
    if body.kelas_id not in my_classes(d):
        raise HTTPException(404, "kelas tidak ditemukan")
    valid = {c["id"] for c in practice_cases()}
    cs = [c for c in dict.fromkeys(body.case_ids) if c in valid]
    ls = [l for l in dict.fromkeys(body.lesson_ids) if l in LESSON_IDS]
    if not body.judul.strip():
        raise HTTPException(400, "Judul tugas wajib diisi")
    if not cs and not ls:
        raise HTTPException(400, "Pilih minimal satu kasus atau modul")
    tid = db.create_assignment(kelas_id=body.kelas_id, dosen_id=d["id"], judul=body.judul.strip()[:160],
                               catatan=(body.catatan or "").strip()[:2000], case_ids=cs, lesson_ids=ls,
                               due_at=body.due_at)
    return db.get_assignment(tid)


@app.delete("/api/dosen/assignments/{tid}")
def dosen_delete_assignment(tid: int, d=Depends(dosen)):
    t = db.get_assignment(tid)
    if not t or t["kelas_id"] not in my_classes(d):
        raise HTTPException(404, "tugas tidak ditemukan")
    db.delete_assignment(tid)
    return {"ok": True}


@app.get("/api/dosen/tutor-logs")
def dosen_tutor_logs(kelas_id: int | None = None, hanya_ditandai: bool = False, d=Depends(dosen)):
    studs, _ = my_students(d, kelas_id)
    names = {s["id"]: s["nama"] for s in studs}
    logs = db.list_tutor_for(list(names), 500)
    out = []
    for t in logs:
        issues = (t["facts"] or {}).get("issues", [])
        if hanya_ditandai and not issues:
            continue
        out.append({"id": t["id"], "sid": t["student_id"], "nama": names.get(t["student_id"]),
                    "attempt_id": t["attempt_id"], "case_id": t["case_id"], "mode": t["mode"], "phase": t["phase"],
                    "message": t["message"], "response": t["response"], "model": t["model"],
                    "latency_ms": t["latency_ms"], "issues": issues, "source": (t["facts"] or {}).get("source"),
                    "created_at": t["created_at"]})
    return out


@app.get("/api/dosen/cases")
def dosen_cases(d=Depends(dosen)):
    """Antarmuka verifikasi: temuan terstruktur, pembaca kedua, dan statistik kelas per kasus."""
    studs, _ = my_students(d)
    done = [x for x in db.list_attempts_for([s["id"] for s in studs]) if x["submitted_at"]]
    reviews = db.case_review_map()
    out = []
    for c in cases.all_cases():
        sec = cases.secrets()[c["id"]]
        f = sec["findings"]
        mine = [x for x in done if x["case_id"] == c["id"]]
        dl = [_dl(x)["dice"] for x in mine if _dl(x).get("dice") is not None]
        r = reviews.get(c["id"])
        out.append({"id": c["id"], "tier": c["tier"], "D": c["D"], "vignette": c["vignette"],
                    "contoh_ajar": c["id"] in TEACHING,
                    "temuan": {k: f[k] for k in ("volume_ml", "kategori_volume", "jumlah_fokus", "hemisfer",
                                                 "adc_relatif_lesi", "restriksi_sejati", "slice_lesi_terbesar")},
                    "model": sec.get("model"), "n_percobaan": len(mine),
                    "mean_dice": sum(dl) / len(dl) if dl else None,
                    "review": {"status": r["status"], "catatan": r["catatan"], "updated_at": r["updated_at"]} if r else None})
    return out


@app.get("/api/dosen/cases/{case_id}/view")
def dosen_case_view(case_id: str, d=Depends(dosen)):
    if case_id not in cases.secrets():
        raise HTTPException(404, "kasus tidak ditemukan")
    secret = cases.secrets()[case_id]
    mk = cases.masks(case_id)
    return {"case": cases.public_case(case_id), "judul": TEACHING.get(case_id, ""),
            "series": [{"label": name, "file": f"/cases/{case_id}/{fid}.bin"} for name, fid in secret["sequences"].items()],
            "findings": secret["findings"], "model": secret.get("model"), "luaran": secret.get("luaran"),
            "gt_rle": cases.rle_encode(mk["gt"]), "pred_rle": cases.rle_encode(mk["pred"]) if "pred" in mk else None}


class ReviewReq(BaseModel):
    status: str
    catatan: str | None = None


@app.post("/api/dosen/cases/{case_id}/review")
def dosen_review_case(case_id: str, body: ReviewReq, d=Depends(dosen)):
    if case_id not in cases.secrets():
        raise HTTPException(404, "kasus tidak ditemukan")
    if body.status not in REVIEW_STATUS:
        raise HTTPException(400, "status tidak dikenal")
    db.set_case_review(case_id, body.status, (body.catatan or "").strip()[:2000], d["id"])
    return {"ok": True}


@app.get("/api/dosen/export")
def dosen_export(jenis: str = "penguasaan", kelas_id: int | None = None, d=Depends(dosen)):
    studs, ks = my_students(d, kelas_id)
    sids = [s["id"] for s in studs]
    buf = io.StringIO()
    w = csv.writer(buf)
    if jenis == "percobaan":
        names = {s["id"]: s for s in studs}
        w.writerow(["id", "pseudonim", "nama", "kelas", "kasus", "sasaran", "tingkat", "mulai", "dikirim",
                    "K1", "K2", "K3", "K6", "dice", "recall_lesi", "galat_volume", "hd95", "jenis_kesalahan"])
        for x in db.list_attempts_for(sids):
            if not x["submitted_at"]:
                continue
            s = names[x["student_id"]]
            kcr = (x["result"] or {}).get("kc") or {}
            dl = _dl(x)
            w.writerow([x["id"], s["id"], s["nama"], ks.get(s["kelas_id"], {}).get("nama"), x["case_id"],
                        x["target_kc"], x["tier"], time.strftime("%Y-%m-%d %H:%M", time.localtime(x["started_at"])),
                        time.strftime("%Y-%m-%d %H:%M", time.localtime(x["submitted_at"])),
                        *[("" if k not in kcr else int(kcr[k]["benar"])) for k in ("K1", "K2", "K3", "K6")],
                        dl.get("dice", ""), dl.get("lesion_recall", ""), dl.get("vol_err", ""), dl.get("hd95", ""),
                        dl.get("jenis_kesalahan_label", "")])
    else:
        by = _mastery_by(sids)
        active = [k for k, v in bkt.KC.items() if v["aktif"]]
        done = [x for x in db.list_attempts_for(sids) if x["submitted_at"]]
        les = db.list_lessons(sids)
        w.writerow(["pseudonim", "nama", "jenjang", "kelas", "n_kasus", "rerata_dice", "modul_selesai",
                    *[f"{k}_penguasaan" for k in active], *[f"{k}_observasi" for k in active]])
        for s in studs:
            mine = [_dl(x)["dice"] for x in done if x["student_id"] == s["id"] and _dl(x).get("dice") is not None]
            mm = by.get(s["id"], {})
            w.writerow([s["id"], s["nama"], s["jenjang"], ks.get(s["kelas_id"], {}).get("nama"),
                        sum(1 for x in done if x["student_id"] == s["id"]),
                        round(sum(mine) / len(mine), 3) if mine else "",
                        sum(1 for r in les if r["student_id"] == s["id"] and r["completed_at"]),
                        *[round(mm.get(k, {}).get("p", bkt.PARAMS["L0"]), 3) for k in active],
                        *[mm.get(k, {}).get("n", 0) for k in active]])
    name = f"sinaps_{jenis}_{time.strftime('%Y%m%d')}.csv"
    return Response("﻿" + buf.getvalue(), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="{name}"'})
